import React, { useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';

type Props = {
  value: Date;
  onChange: (date: Date) => void;
  disabled?: boolean;
};

export default function ExpenseDatePicker({
  value,
  onChange,
  disabled = false,
}: Props) {
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [iosModalVisible, setIosModalVisible] = useState(false);
  const [tempDate, setTempDate] = useState<Date>(value);

  const isToday = (d: Date) => {
    const today = new Date();
    return (
      d.getDate() === today.getDate() &&
      d.getMonth() === today.getMonth() &&
      d.getFullYear() === today.getFullYear()
    );
  };

  const isYesterday = (d: Date) => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return (
      d.getDate() === yesterday.getDate() &&
      d.getMonth() === yesterday.getMonth() &&
      d.getFullYear() === yesterday.getFullYear()
    );
  };

  const formatDateDisplay = (d: Date) => {
    if (isToday(d)) return 'Today';
    if (isYesterday(d)) return 'Yesterday';
    return d.toLocaleDateString(undefined, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const formatTimeDisplay = (d: Date) => {
    return d.toLocaleTimeString(undefined, {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const formatForDateTimeLocal = (d: Date) => {
    const pad = (n: number) => String(n).padStart(2, '0');
    const year = d.getFullYear();
    const month = pad(d.getMonth() + 1);
    const day = pad(d.getDate());
    const hours = pad(d.getHours());
    const minutes = pad(d.getMinutes());
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  const handleNativeDateChange = (
    event: DateTimePickerEvent,
    selectedDate?: Date,
  ) => {
    setShowDatePicker(false);
    if (event.type === 'set' && selectedDate) {
      const updated = new Date(value);
      updated.setFullYear(selectedDate.getFullYear());
      updated.setMonth(selectedDate.getMonth());
      updated.setDate(selectedDate.getDate());
      onChange(updated);
      if (Platform.OS === 'android') {
        setShowTimePicker(true);
      }
    }
  };

  const handleNativeTimeChange = (
    event: DateTimePickerEvent,
    selectedTime?: Date,
  ) => {
    setShowTimePicker(false);
    if (event.type === 'set' && selectedTime) {
      const updated = new Date(value);
      updated.setHours(selectedTime.getHours());
      updated.setMinutes(selectedTime.getMinutes());
      onChange(updated);
    }
  };

  const handleQuickNow = () => {
    onChange(new Date());
  };

  const handleQuickYesterday = () => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    onChange(d);
  };

  const openPicker = () => {
    if (disabled || Platform.OS === 'web') return;
    if (Platform.OS === 'ios') {
      setTempDate(new Date(value));
      setIosModalVisible(true);
    } else if (Platform.OS === 'android') {
      setShowDatePicker(true);
    }
  };

  return (
    <View style={styles.section}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>Date & Time</Text>
        <View style={styles.quickActions}>
          <Pressable
            style={[styles.quickButton, isToday(value) && styles.quickButtonActive]}
            onPress={handleQuickNow}
            disabled={disabled}
          >
            <Text style={[styles.quickButtonText, isToday(value) && styles.quickButtonTextActive]}>
              Now
            </Text>
          </Pressable>
          <Pressable
            style={[styles.quickButton, isYesterday(value) && styles.quickButtonActive]}
            onPress={handleQuickYesterday}
            disabled={disabled}
          >
            <Text style={[styles.quickButtonText, isYesterday(value) && styles.quickButtonTextActive]}>
              Yesterday
            </Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.selectorWrapper}>
        <Pressable
          style={styles.selector}
          onPress={openPicker}
          disabled={disabled}
        >
          <View style={styles.icon}>
            <Ionicons name="calendar-outline" size={20} color="#00E5FF" />
          </View>
          <View style={styles.selectorTextWrap}>
            <Text style={styles.selectorValue}>
              {formatDateDisplay(value)} at {formatTimeDisplay(value)}
            </Text>
            <Text style={styles.selectorMeta}>
              Recorded payment date and time
            </Text>
          </View>
          <View style={styles.clockBadge}>
            <Ionicons name="time-outline" size={16} color="#94A3B8" />
          </View>
        </Pressable>

        {Platform.OS === 'web' && (
          React.createElement('input', {
            type: 'datetime-local',
            value: formatForDateTimeLocal(value),
            disabled,
            onChange: (e: any) => {
              const val = e.target.value;
              if (val) {
                const d = new Date(val);
                if (!Number.isNaN(d.getTime())) {
                  onChange(d);
                }
              }
            },
            style: {
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              opacity: 0,
              cursor: disabled ? 'default' : 'pointer',
              zIndex: 2,
            },
          })
        )}
      </View>

      {/* Android Native Date Picker */}
      {showDatePicker && Platform.OS === 'android' && (
        <DateTimePicker
          value={value}
          mode="date"
          display="default"
          onChange={handleNativeDateChange}
          maximumDate={new Date(Date.now() + 86400000)}
        />
      )}

      {/* Android Native Time Picker */}
      {showTimePicker && Platform.OS === 'android' && (
        <DateTimePicker
          value={value}
          mode="time"
          display="default"
          onChange={handleNativeTimeChange}
        />
      )}

      {/* iOS Modal with Inline DateTimePicker */}
      {Platform.OS === 'ios' && (
        <Modal
          visible={iosModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setIosModalVisible(false)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Select Payment Date & Time</Text>
                <Pressable
                  onPress={() => setIosModalVisible(false)}
                  style={styles.modalClose}
                >
                  <Ionicons name="close" size={20} color="#94A3B8" />
                </Pressable>
              </View>

              <DateTimePicker
                value={tempDate}
                mode="datetime"
                display="spinner"
                themeVariant="dark"
                textColor="#FFFFFF"
                onChange={(_event, date) => {
                  if (date) setTempDate(date);
                }}
                maximumDate={new Date(Date.now() + 86400000)}
              />

              <View style={styles.modalFooter}>
                <Pressable
                  style={styles.confirmButton}
                  onPress={() => {
                    onChange(tempDate);
                    setIosModalVisible(false);
                  }}
                >
                  <Text style={styles.confirmButtonText}>Set Date & Time</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginBottom: 16,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  label: {
    color: '#CBD5E1',
    fontSize: 13,
    fontWeight: '700',
  },
  quickActions: {
    flexDirection: 'row',
    gap: 6,
  },
  quickButton: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
  },
  quickButtonActive: {
    backgroundColor: '#134E4A',
    borderColor: '#00E5FF',
  },
  quickButtonText: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '700',
  },
  quickButtonTextActive: {
    color: '#99F6E4',
  },
  selectorWrapper: {
    position: 'relative',
  },
  selector: {
    minHeight: 64,
    borderRadius: 16,
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#1E293B',
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  icon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#123330',
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectorTextWrap: {
    flex: 1,
  },
  selectorValue: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  selectorMeta: {
    color: '#64748B',
    fontSize: 12,
    marginTop: 2,
  },
  clockBadge: {
    padding: 6,
    borderRadius: 10,
    backgroundColor: '#1E293B',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 23, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#0F172A',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: '#334155',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  modalClose: {
    padding: 4,
  },
  modalFooter: {
    marginTop: 16,
  },
  confirmButton: {
    height: 48,
    borderRadius: 14,
    backgroundColor: '#00E5FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
});
