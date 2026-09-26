import React, { useMemo, useState } from 'react';
import {
  Ionicons,
} from '@expo/vector-icons';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

export type ExpenseLocationStop = {
  id: string;
  name: string;
  label?: string | null;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  day_number?: number | null;
  stop_type?: string | null;
};

type Props = {
  stops: ExpenseLocationStop[];
  selectedStopId: string | null;
  locationName: string;
  onSelectStop: (stop: ExpenseLocationStop) => void;
  onManualChange: (value: string) => void;
  onClear: () => void;
  disabled?: boolean;
};


function getStopDayLabel(stop: ExpenseLocationStop) {
  return stop.day_number != null ? `Day ${stop.day_number}` : 'Journey';
}

function getStopDisplayLabel(stop: ExpenseLocationStop) {
  return `${getStopDayLabel(stop)} · ${stop.name}`;
}

export default function ExpenseLocationPicker({
  stops,
  selectedStopId,
  locationName,
  onSelectStop,
  onManualChange,
  onClear,
  disabled = false,
}: Props) {
  const [visible, setVisible] = useState(false);

  const selectedStop = useMemo(
    () => stops.find((stop) => stop.id === selectedStopId) || null,
    [stops, selectedStopId],
  );

  const displayValue = selectedStop
    ? getStopDisplayLabel(selectedStop)
    : locationName.trim();

  const handleSelect = (stop: ExpenseLocationStop) => {
    onSelectStop(stop);
    setVisible(false);
  };

  return (
    <View style={styles.section}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>Location</Text>
        <Text style={styles.optional}>Optional</Text>
      </View>

      {stops.length > 0 ? (
        <>
          <Pressable
            style={styles.selector}
            onPress={() => setVisible(true)}
            disabled={disabled}
          >
            <View style={styles.icon}>
              <Ionicons name="location-outline" size={20} color="#0EA5A4" />
            </View>
            <View style={styles.selectorTextWrap}>
              <Text
                style={[
                  styles.selectorValue,
                  !displayValue && styles.placeholder,
                ]}
                numberOfLines={1}
              >
                {displayValue || 'Select a journey place'}
              </Text>
              <Text style={styles.selectorMeta}>
                Choose a saved Journey place or enter another location
              </Text>
            </View>
            <Ionicons name="chevron-down" size={20} color="#94A3B8" />
          </Pressable>

          {locationName.trim() && !selectedStopId ? (
            <View style={styles.manualRow}>
              <TextInput
                value={locationName}
                onChangeText={onManualChange}
                placeholder="Enter location name"
                placeholderTextColor="#64748B"
                style={styles.manualInput}
                maxLength={200}
                editable={!disabled}
              />
              <Pressable
                style={styles.clearButton}
                onPress={onClear}
                disabled={disabled}
                hitSlop={6}
              >
                <Ionicons name="close-circle" size={20} color="#64748B" />
              </Pressable>
            </View>
          ) : null}
        </>
      ) : (
        <View style={styles.manualRow}>
          <View style={styles.manualIcon}>
            <Ionicons name="location-outline" size={19} color="#0EA5A4" />
          </View>
          <TextInput
            value={locationName}
            onChangeText={onManualChange}
            placeholder="e.g. Baga Beach or Restaurant XYZ"
            placeholderTextColor="#64748B"
            style={styles.manualInput}
            maxLength={200}
            editable={!disabled}
          />
          {locationName ? (
            <Pressable
              style={styles.clearButton}
              onPress={onClear}
              disabled={disabled}
              hitSlop={6}
            >
              <Ionicons name="close-circle" size={20} color="#64748B" />
            </Pressable>
          ) : null}
        </View>
      )}

      <Modal
        visible={visible}
        transparent
        animationType="slide"
        onRequestClose={() => setVisible(false)}
      >
        <View style={styles.backdrop}>
          <Pressable
            style={styles.dismiss}
            onPress={() => setVisible(false)}
          />
          <View style={styles.modalCard}>
            <View style={styles.handle} />

            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderCopy}>
                <Text style={styles.modalTitle}>Expense location</Text>
                <Text style={styles.modalSubtitle}>
                  Saved Journey places are labeled by day.
                </Text>
              </View>

              <Pressable
                style={styles.closeButton}
                onPress={() => setVisible(false)}
              >
                <Ionicons name="close" size={20} color="#CBD5E1" />
              </Pressable>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.list}
              keyboardShouldPersistTaps="handled"
            >
              {stops.map((stop) => {
                const selected = stop.id === selectedStopId;

                return (
                  <Pressable
                    key={stop.id}
                    style={[
                      styles.stopRow,
                      selected && styles.stopRowSelected,
                    ]}
                    onPress={() => handleSelect(stop)}
                  >
                    <View style={styles.stopIcon}>
                      <Ionicons
                        name={
                          stop.id === stops[0]?.id
                            ? 'flag-outline'
                            : 'location-outline'
                        }
                        size={20}
                        color="#0EA5A4"
                      />
                    </View>

                    <View style={styles.stopCopy}>
                      <Text style={styles.stopName} numberOfLines={1}>
                        {getStopDisplayLabel(stop)}
                      </Text>

                      <Text style={styles.stopMeta} numberOfLines={2}>
                        {[
                          stop.stop_type?.trim()
                            ? stop.stop_type.trim().toUpperCase()
                            : null,
                          stop.label?.trim() || stop.address?.trim() || 'Journey place',
                        ]
                          .filter(Boolean)
                          .join(' • ')}
                      </Text>
                    </View>

                    {selected ? (
                      <View style={styles.check}>
                        <Ionicons
                          name="checkmark"
                          size={17}
                          color="#FFFFFF"
                        />
                      </View>
                    ) : (
                      <View style={styles.emptyCheck} />
                    )}
                  </Pressable>
                );
              })}

              <View style={styles.separator} />

              <Text style={styles.manualTitle}>Enter another location</Text>

              <TextInput
                value={selectedStopId ? '' : locationName}
                onChangeText={onManualChange}
                placeholder="e.g. Cafe near the hotel"
                placeholderTextColor="#64748B"
                style={styles.modalInput}
                maxLength={200}
              />

              <Pressable
                style={styles.manualButton}
                onPress={() => {
                  if (!locationName.trim()) {
                    onClear();
                  }
                  setVisible(false);
                }}
              >
                <Ionicons
                  name="create-outline"
                  size={18}
                  color="#0EA5A4"
                />
                <Text style={styles.manualButtonText}>
                  Use manual location
                </Text>
              </Pressable>

              <Pressable
                style={styles.noLocationButton}
                onPress={() => {
                  onClear();
                  setVisible(false);
                }}
              >
                <Text style={styles.noLocationText}>Clear location</Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginBottom: 22,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 9,
  },
  label: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  optional: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '700',
  },
  selector: {
    minHeight: 70,
    borderRadius: 17,
    backgroundColor: '#1E293B',
    paddingHorizontal: 13,
    paddingVertical: 11,
    flexDirection: 'row',
    alignItems: 'center',
  },
  icon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 11,
  },
  selectorTextWrap: {
    flex: 1,
    minWidth: 0,
    marginRight: 10,
  },
  selectorValue: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  placeholder: {
    color: '#94A3B8',
    fontWeight: '600',
  },
  selectorMeta: {
    color: '#64748B',
    fontSize: 11,
    lineHeight: 16,
    marginTop: 3,
  },
  manualRow: {
    minHeight: 58,
    marginTop: 9,
    borderRadius: 15,
    backgroundColor: '#1E293B',
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  manualIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 9,
  },
  manualInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 15,
    paddingVertical: 11,
  },
  clearButton: {
    padding: 4,
    marginLeft: 6,
  },
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.58)',
  },
  dismiss: {
    flex: 1,
  },
  modalCard: {
    maxHeight: '82%',
    backgroundColor: '#0F172A',
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 28,
  },
  handle: {
    alignSelf: 'center',
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#334155',
    marginBottom: 18,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  modalHeaderCopy: {
    flex: 1,
    paddingRight: 12,
  },
  modalTitle: {
    color: '#FFFFFF',
    fontSize: 21,
    fontWeight: '800',
  },
  modalSubtitle: {
    color: '#64748B',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
  },
  closeButton: {
    width: 38,
    height: 38,
    borderRadius: 13,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    gap: 9,
    paddingBottom: 8,
  },
  stopRow: {
    minHeight: 70,
    borderRadius: 17,
    backgroundColor: '#1E293B',
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  stopRowSelected: {
    borderWidth: 1,
    borderColor: '#0EA5A4',
  },
  stopIcon: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  stopCopy: {
    flex: 1,
    minWidth: 0,
    paddingRight: 8,
  },
  stopName: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  stopMeta: {
    color: '#64748B',
    fontSize: 11,
    lineHeight: 16,
    marginTop: 3,
  },
  check: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#0EA5A4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyCheck: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#475569',
  },
  separator: {
    height: 1,
    backgroundColor: '#263247',
    marginVertical: 6,
  },
  manualTitle: {
    color: '#CBD5E1',
    fontSize: 13,
    fontWeight: '800',
    marginTop: 2,
  },
  modalInput: {
    minHeight: 52,
    borderRadius: 14,
    backgroundColor: '#1E293B',
    color: '#FFFFFF',
    paddingHorizontal: 14,
    marginTop: 2,
    fontSize: 15,
  },
  manualButton: {
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: '#123330',
    borderWidth: 1,
    borderColor: '#115E59',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 2,
  },
  manualButtonText: {
    color: '#99F6E4',
    fontWeight: '800',
  },
  noLocationButton: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noLocationText: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '700',
  },
});
