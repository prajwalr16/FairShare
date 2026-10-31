import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GroupOverview } from '../services/groupService';
import { GroupSettlement } from '../services/settlementService';
import {
  downloadGroupCsv,
  openPrintableStatement,
  ExportExpenseItem,
} from '../utils/statementExport';
import { hapticMedium, hapticSelection, hapticSuccess } from '../utils/haptics';

interface ExportStatementModalProps {
  visible: boolean;
  onClose: () => void;
  group: GroupOverview | null;
  expenses: ExportExpenseItem[];
  settlements: GroupSettlement[];
}

export function ExportStatementModal({
  visible,
  onClose,
  group,
  expenses,
  settlements,
}: ExportStatementModalProps) {
  const [exportingCsv, setExportingCsv] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  if (!group) return null;

  const handleExportCsv = async () => {
    await hapticMedium();
    setExportingCsv(true);
    setStatusMessage('Generating CSV statement...');
    try {
      const ok = await downloadGroupCsv({ group, expenses, settlements });
      if (ok) {
        await hapticSuccess();
        setStatusMessage('CSV statement downloaded successfully!');
        setTimeout(() => {
          setStatusMessage(null);
          onClose();
        }, 1200);
      } else {
        setStatusMessage('Failed to download CSV');
      }
    } catch {
      setStatusMessage('Error exporting statement');
    } finally {
      setExportingCsv(false);
    }
  };

  const handlePrintPdf = async () => {
    await hapticMedium();
    if (Platform.OS === 'web') {
      const ok = openPrintableStatement({ group, expenses, settlements });
      if (ok) {
        await hapticSuccess();
        onClose();
      } else {
        setStatusMessage('Popup blocked. Allow popups to print report.');
      }
    } else {
      // On mobile, export formatted CSV to native share sheet
      await handleExportCsv();
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Export Statement</Text>
              <Text style={styles.subtitle}>{group.name} &bull; Activity & Balances</Text>
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

          <View style={styles.optionsContainer}>
            {/* CSV Option */}
            <Pressable
              style={styles.optionCard}
              onPress={handleExportCsv}
              disabled={exportingCsv}
            >
              <View style={styles.iconBoxCsv}>
                <Ionicons name="document-text-outline" size={24} color="#10B981" />
              </View>
              <View style={styles.optionTextContainer}>
                <Text style={styles.optionTitle}>Download CSV Spreadsheet</Text>
                <Text style={styles.optionDescription}>
                  Full itemized transactions and balances for Excel or Google Sheets
                </Text>
              </View>
              {exportingCsv ? (
                <ActivityIndicator size="small" color="#10B981" />
              ) : (
                <Ionicons name="download-outline" size={20} color="#64748B" />
              )}
            </Pressable>

            {/* Printable PDF Statement Option */}
            <Pressable style={styles.optionCard} onPress={handlePrintPdf}>
              <View style={styles.iconBoxPdf}>
                <Ionicons name="print-outline" size={24} color="#00E5FF" />
              </View>
              <View style={styles.optionTextContainer}>
                <Text style={styles.optionTitle}>
                  {Platform.OS === 'web' ? 'Print / PDF Report' : 'Share Full Statement'}
                </Text>
                <Text style={styles.optionDescription}>
                  Executive branded summary with KPI cards and balance sheet
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#64748B" />
            </Pressable>
          </View>

          {statusMessage && <Text style={styles.statusText}>{statusMessage}</Text>}

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
  sheet: {
    backgroundColor: '#0B101E',
    padding: 22,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 229, 255, 0.3)',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '900',
  },
  subtitle: {
    color: '#94A3B8',
    fontSize: 13,
    marginTop: 3,
  },
  optionsContainer: {
    gap: 12,
    marginBottom: 16,
  },
  optionCard: {
    backgroundColor: '#0E1524',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  iconBoxCsv: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconBoxPdf: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 229, 255, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionTextContainer: {
    flex: 1,
  },
  optionTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  optionDescription: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 2,
    lineHeight: 16,
  },
  statusText: {
    color: '#00E5FF',
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 12,
    fontWeight: '600',
  },
  cancelButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#94A3B8',
    fontSize: 14,
    fontWeight: '600',
  },
});
