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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GroupDebt as Debt } from '../services/groupService';
import { formatCurrency } from '../utils/currency';
import { buildUpiUri, getUpiQrCodeUrl, openUpiApp } from '../utils/upi';
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
  const [upiStatus, setUpiStatus] = useState<string | null>(null);

  useEffect(() => {
    if (debt) {
      setAmount(Number(debt.amount).toFixed(2));
      setNote('UPI settlement');
      setShowQr(false);
      setUpiStatus(null);
      // Auto-suggest UPI ID from payee name or generic handle
      const rawName = (debt.to_name || (debt as any).to_user_name || 'member')
        .toLowerCase()
        .replace(/\s+/g, '');
      setUpiId(`${rawName}@upi`);
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

  const upiUri = buildUpiUri({
    payeeUpiId: upiId.trim() || 'payee@upi',
    payeeName,
    amount: numAmount,
    note: note || 'FairShare settlement',
  });

  const handlePayUpi = async () => {
    await hapticMedium();
    if (numAmount <= 0) {
      setUpiStatus('Enter a valid amount first');
      return;
    }

    if (Platform.OS === 'web') {
      setShowQr(!showQr);
      setUpiStatus('Scan QR code with any UPI app (GPay, PhonePe, Paytm)');
      return;
    }

    const opened = await openUpiApp({
      payeeUpiId: upiId.trim() || 'payee@upi',
      payeeName,
      amount: numAmount,
      note: note || 'FairShare settlement',
    });

    if (!opened) {
      setShowQr(true);
      setUpiStatus('UPI app not found. Scan the QR code below.');
    } else {
      setUpiStatus('Payment initiated. Record payment below once done.');
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
                  onChangeText={setUpiId}
                  placeholder="payee@okhdfcbank"
                  placeholderTextColor="#64748B"
                  style={styles.upiInput}
                  autoCapitalize="none"
                />
              </View>

              <Pressable style={styles.upiButton} onPress={handlePayUpi}>
                <Ionicons name="open-outline" size={16} color="#06090F" />
                <Text style={styles.upiButtonText}>Pay with UPI (GPay / PhonePe / Paytm)</Text>
              </Pressable>

              {showQr && (
                <View style={styles.qrContainer}>
                  <Image
                    source={{ uri: getUpiQrCodeUrl(upiUri, 200) }}
                    style={styles.qrImage}
                    resizeMode="contain"
                  />
                  <Text style={styles.qrSubtext}>Scan with any UPI app on your phone</Text>
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
  qrContainer: {
    alignItems: 'center',
    marginTop: 12,
    padding: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
  },
  qrImage: {
    width: 180,
    height: 180,
  },
  qrSubtext: {
    color: '#06090F',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 4,
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
