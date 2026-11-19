import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  TextInput,
  ActivityIndicator,
  Platform,
  Image,
  ScrollView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { GroupDebt as Debt } from '../services/groupService';
import { formatCurrency } from '../utils/currency';
import {
  buildUpiUri,
  getUpiQrCodeUrl,
  getUpiQrCodeFallbackUrl,
  isValidUpiId,
  openUpiApp,
  COMMON_UPI_HANDLES,
} from '../utils/upi';
import { hapticMedium, hapticSelection, hapticSuccess, hapticWarning } from '../utils/haptics';

interface SettleUpModalProps {
  visible: boolean;
  onClose: () => void;
  debt: Debt | null;
  currency: string;
  submitting: boolean;
  onSubmit: (amount: number, note: string) => Promise<void>;
}

export function SettleUpModal({
  visible,
  onClose,
  debt,
  currency,
  submitting,
  onSubmit,
}: SettleUpModalProps) {
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [upiId, setUpiId] = useState('');
  const [showQr, setShowQr] = useState(false);
  const [useFallbackQr, setUseFallbackQr] = useState(false);
  const [upiStatus, setUpiStatus] = useState<string | null>(null);

  const payeeKey = debt
    ? (debt.to_user_id || debt.to_name.toLowerCase().replace(/\s+/g, ''))
    : '';

  useEffect(() => {
    if (debt) {
      setAmount(Number(debt.amount).toFixed(2));
      setNote('UPI settlement');
      setShowQr(false);
      setUseFallbackQr(false);
      setUpiStatus(null);

      // Restore previously saved real UPI ID for this payee if available
      const key = debt.to_user_id || debt.to_name.toLowerCase().replace(/\s+/g, '');
      void AsyncStorage.getItem(`fairshare:upi_vpa:${key}`).then(saved => {
        if (saved && isValidUpiId(saved)) {
          setUpiId(saved);
        } else {
          setUpiId('');
        }
      });
    } else {
      setAmount('');
      setNote('');
      setUpiId('');
    }
  }, [debt]);

  if (!debt) return null;

  const numAmount = Number(amount.replace(/,/g, '').trim()) || 0;
  const payeeName = debt.to_name || (debt as any).to_user_name || 'Member';
  const isINR = (currency || 'INR').toUpperCase() === 'INR';
  const isUpiValid = isValidUpiId(upiId);

  const upiUri = buildUpiUri({
    payeeUpiId: upiId.trim(),
    payeeName,
    amount: numAmount,
    note: note || 'FairShare settlement',
  });

  const handleUpiChange = (text: string) => {
    setUpiId(text);
    setUseFallbackQr(false);
    if (isValidUpiId(text) && payeeKey) {
      void AsyncStorage.setItem(`fairshare:upi_vpa:${payeeKey}`, text.trim());
    }
  };

  const handleApplyHandle = (suffix: string) => {
    const raw = upiId.trim();
    const prefix = raw.includes('@') ? raw.split('@')[0] : (raw || debt.to_name.toLowerCase().replace(/\s+/g, ''));
    const complete = `${prefix.trim()}${suffix}`;
    setUpiId(complete);
    setUseFallbackQr(false);
    if (isValidUpiId(complete) && payeeKey) {
      void AsyncStorage.setItem(`fairshare:upi_vpa:${payeeKey}`, complete);
    }
  };

  const handlePayUpi = async () => {
    await hapticMedium();
    if (numAmount <= 0) {
      setUpiStatus('Enter a valid amount first');
      return;
    }

    if (!isUpiValid) {
      setShowQr(true);
      setUpiStatus('Enter payee’s actual UPI ID (e.g. 9876543210@paytm) to proceed');
      return;
    }

    if (Platform.OS === 'web') {
      setShowQr(true);
      setUpiStatus('Scan QR code with Google Pay, PhonePe, or Paytm on your phone');
      return;
    }

    const opened = await openUpiApp({
      payeeUpiId: upiId.trim(),
      payeeName,
      amount: numAmount,
      note: note || 'FairShare settlement',
    });

    if (!opened) {
      setShowQr(true);
      setUpiStatus('UPI app not found. Scan the QR code below.');
    } else {
      setUpiStatus('Payment initiated in UPI app. Record payment below once done.');
    }
  };

  const handleSubmit = async () => {
    if (numAmount <= 0) {
      await hapticWarning();
      setUpiStatus('Please enter a valid settlement amount.');
      return;
    }
    await hapticSuccess();
    await onSubmit(numAmount, note);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.settleSheet}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalTitle}>Settle Up</Text>
              <Text style={styles.modalSubtitle}>
                Pay to <Text style={styles.highlightName}>{payeeName}</Text>
              </Text>
            </View>
            <Pressable
              onPress={() => {
                hapticSelection();
                onClose();
              }}
              hitSlop={10}
            >
              <Ionicons name="close" size={24} color="#FFFFFF" />
            </Pressable>
          </View>

          {/* Amount input */}
          <Text style={styles.inputLabel}>Settlement Amount ({currency})</Text>
          <View style={styles.amountInputContainer}>
            <TextInput
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
              placeholder="0.00"
              placeholderTextColor="#64748B"
              style={styles.amountInput}
            />
          </View>
          <Text style={styles.outstandingText}>
            Outstanding Balance: {formatCurrency(debt.amount, currency)}
          </Text>

          {/* Pay with UPI section (for INR) */}
          {isINR && (
            <View style={styles.upiCard}>
              <View style={styles.upiRow}>
                <View style={styles.upiHeaderInfo}>
                  <Ionicons name="flash" size={18} color="#00E5FF" />
                  <Text style={styles.upiTitle}>Instant UPI Settlement</Text>
                </View>
                <Pressable
                  style={styles.qrToggle}
                  onPress={() => {
                    hapticSelection();
                    setShowQr(!showQr);
                  }}
                >
                  <Ionicons
                    name={showQr ? 'eye-off-outline' : 'qr-code-outline'}
                    size={16}
                    color="#00E5FF"
                  />
                  <Text style={styles.qrToggleText}>{showQr ? 'Hide QR' : 'QR Code'}</Text>
                </Pressable>
              </View>

              <View style={styles.upiInputRow}>
                <Text style={styles.upiPrefix}>VPA:</Text>
                <TextInput
                  value={upiId}
                  onChangeText={handleUpiChange}
                  placeholder="payee@okhdfcbank or 9876543210@paytm"
                  placeholderTextColor="#64748B"
                  style={styles.upiInput}
                  autoCapitalize="none"
                />
                {isUpiValid && (
                  <Ionicons name="checkmark-circle" size={18} color="#10B981" />
                )}
              </View>

              {/* Quick bank handle autocomplete chips */}
              <View style={styles.handleChipsWrapper}>
                <Text style={styles.handleChipsLabel}>Quick handle:</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.handleChipsContainer}
                >
                  {COMMON_UPI_HANDLES.map(handle => (
                    <Pressable
                      key={handle}
                      style={styles.handleChip}
                      onPress={() => handleApplyHandle(handle)}
                    >
                      <Text style={styles.handleChipText}>{handle}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>

              <Pressable style={styles.upiButton} onPress={handlePayUpi}>
                <Ionicons name="open-outline" size={16} color="#06090F" />
                <Text style={styles.upiButtonText}>Pay with UPI (GPay / PhonePe / Paytm)</Text>
              </Pressable>

              {showQr && (
                <View style={isUpiValid ? styles.qrContainer : styles.qrPlaceholderContainer}>
                  {isUpiValid ? (
                    <>
                      <Image
                        source={{ uri: useFallbackQr ? getUpiQrCodeFallbackUrl(upiUri, 240) : getUpiQrCodeUrl(upiUri, 240) }}
                        style={styles.qrImage}
                        resizeMode="contain"
                        onError={() => setUseFallbackQr(true)}
                      />
                      <View style={styles.verifiedBadge}>
                        <Ionicons name="checkmark-circle" size={14} color="#15803D" />
                        <Text style={styles.verifiedText}>Valid UPI QR • {upiId.trim()}</Text>
                      </View>
                      <Text style={styles.qrSubtext}>Scan with Google Pay, PhonePe, Paytm, or BHIM</Text>
                    </>
                  ) : (
                    <View style={styles.qrPlaceholder}>
                      <Ionicons name="qr-code-outline" size={36} color="#00E5FF" />
                      <Text style={styles.qrPlaceholderTitle}>Enter Payee’s UPI ID</Text>
                      <Text style={styles.qrPlaceholderText}>
                        Type payee’s VPA above (e.g. 9876543210@paytm or name@okaxis) to generate a scannable payment QR code.
                      </Text>
                    </View>
                  )}
                </View>
              )}

              {upiStatus && <Text style={styles.upiStatusText}>{upiStatus}</Text>}
            </View>
          )}

          {/* Note Input */}
          <Text style={styles.inputLabel}>Note (Optional)</Text>
          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder="UPI payment / cash"
            placeholderTextColor="#64748B"
            style={styles.input}
            maxLength={200}
          />

          {/* Action buttons */}
          <Pressable
            style={[styles.primaryButton, submitting && styles.disabledButton]}
            onPress={handleSubmit}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.primaryButtonText}>Record Settlement in App</Text>
            )}
          </Pressable>

          <Pressable
            style={styles.cancelButton}
            onPress={() => {
              hapticSelection();
              onClose();
            }}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  settleSheet: {
    backgroundColor: '#0B101E',
    padding: 22,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 229, 255, 0.3)',
    maxHeight: '92%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  modalTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '900',
  },
  modalSubtitle: {
    color: '#94A3B8',
    fontSize: 13,
    marginTop: 3,
  },
  highlightName: {
    color: '#00E5FF',
    fontWeight: '800',
  },
  inputLabel: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 6,
    marginTop: 8,
  },
  amountInputContainer: {
    backgroundColor: '#0E1524',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.25)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginBottom: 4,
  },
  amountInput: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '900',
  },
  outstandingText: {
    color: '#64748B',
    fontSize: 12,
    marginBottom: 14,
  },
  upiCard: {
    backgroundColor: '#0E1524',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.2)',
    padding: 14,
    marginBottom: 14,
  },
  upiRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  upiHeaderInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  upiTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  qrToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(0, 229, 255, 0.1)',
  },
  qrToggleText: {
    color: '#00E5FF',
    fontSize: 11,
    fontWeight: '700',
  },
  upiInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#06090F',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    marginBottom: 10,
  },
  upiPrefix: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '700',
    marginRight: 6,
  },
  upiInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 13,
    padding: 0,
  },
  upiButton: {
    backgroundColor: '#00E5FF',
    borderRadius: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  upiButtonText: {
    color: '#06090F',
    fontSize: 13,
    fontWeight: '800',
  },
  handleChipsWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 6,
  },
  handleChipsLabel: {
    color: '#64748B',
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  handleChipsContainer: {
    gap: 6,
  },
  handleChip: {
    backgroundColor: '#06090F',
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.25)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  handleChipText: {
    color: '#00E5FF',
    fontSize: 11,
    fontWeight: '700',
  },
  qrContainer: {
    alignItems: 'center',
    marginTop: 12,
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  qrPlaceholderContainer: {
    marginTop: 12,
  },
  qrImage: {
    width: 200,
    height: 200,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 8,
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  verifiedText: {
    color: '#15803D',
    fontSize: 11,
    fontWeight: '800',
  },
  qrSubtext: {
    color: '#334155',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 6,
    textAlign: 'center',
  },
  qrPlaceholder: {
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#0E1524',
    borderRadius: 14,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(0, 229, 255, 0.35)',
    width: '100%',
  },
  qrPlaceholderTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    marginTop: 8,
  },
  qrPlaceholderText: {
    color: '#94A3B8',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 17,
  },
  upiStatusText: {
    color: '#00E5FF',
    fontSize: 11,
    marginTop: 8,
    textAlign: 'center',
  },
  input: {
    backgroundColor: '#0E1524',
    color: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    marginBottom: 16,
  },
  primaryButton: {
    backgroundColor: '#10B981',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 10,
  },
  disabledButton: {
    opacity: 0.6,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  cancelButton: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '600',
  },
});
