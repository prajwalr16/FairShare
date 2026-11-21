import React, { useMemo, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { GROUP_TYPES } from '../constants/groupTypes';
import { parseBulkMemberNames } from '../utils/memberOnboarding';

const CURRENCIES = ['INR', 'USD', 'EUR', 'GBP', 'AED', 'SGD'];

type Props = {
  visible: boolean;
  onClose: () => void;
  onCreate: (group: {
    name: string;
    type: string;
    currency: string;
    description: string;
    initialMembers?: string[];
  }) => void;
};

export default function CreateGroupModal({
  visible,
  onClose,
  onCreate,
}: Props) {
  const [name, setName] = useState('');
  const [type, setType] = useState('Trip');
  const [currency, setCurrency] = useState('INR');
  const [desc, setDesc] = useState('');
  const [initialMembersText, setInitialMembersText] = useState('');

  const initialMembers = useMemo(() => parseBulkMemberNames(initialMembersText), [initialMembersText]);

  const submit = () => {
    const cleanName = name.trim();
    if (!cleanName) return;

    onCreate({
      name: cleanName,
      type,
      currency,
      description: desc.trim(),
      initialMembers: initialMembers.length > 0 ? initialMembers : undefined,
    });

    setName('');
    setDesc('');
    setInitialMembersText('');
    setType('Trip');
    setCurrency('INR');
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.box}>
          <View style={styles.handleBar} />

          <View style={styles.headerRow}>
            <View>
              <Text style={styles.eyebrow}>NEW EXPENSE CIRCLE</Text>
              <Text style={styles.title}>Create Group</Text>
            </View>
            <Pressable style={styles.closeIconBtn} onPress={onClose}>
              <Ionicons name="close" size={20} color="#94A3B8" />
            </Pressable>
          </View>

          <Text style={styles.label}>GROUP NAME</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Goa Trip 2026, Apartment 402"
            placeholderTextColor="#64748B"
            value={name}
            onChangeText={setName}
            maxLength={80}
          />

          <Text style={styles.label}>CATEGORY</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.scroll}
            contentContainerStyle={{ gap: 8 }}
          >
            {GROUP_TYPES.map((groupType) => {
              const active = type === groupType;
              return (
                <Pressable
                  key={groupType}
                  style={[styles.chip, active && styles.activeChip]}
                  onPress={() => setType(groupType)}
                >
                  <Text style={[styles.chipText, active && styles.activeText]}>
                    {groupType}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <Text style={styles.label}>PRIMARY CURRENCY</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.scroll}
            contentContainerStyle={{ gap: 8 }}
          >
            {CURRENCIES.map((code) => {
              const active = currency === code;
              return (
                <Pressable
                  key={code}
                  style={[styles.chip, active && styles.activeChip]}
                  onPress={() => setCurrency(code)}
                >
                  <Text style={[styles.chipText, active && styles.activeText]}>
                    {code}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <Text style={styles.label}>INITIAL MEMBERS (OPTIONAL)</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Rahul, Sneha, Rohan (comma separated)"
            placeholderTextColor="#64748B"
            value={initialMembersText}
            onChangeText={setInitialMembersText}
            autoCapitalize="words"
          />

          {initialMembers.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ marginBottom: 12 }}
              contentContainerStyle={{ gap: 6 }}
            >
              {initialMembers.map((m, idx) => (
                <View key={idx} style={styles.memberChip}>
                  <Ionicons name="person" size={11} color="#00E5FF" style={{ marginRight: 4 }} />
                  <Text style={styles.memberChipText}>{m}</Text>
                </View>
              ))}
            </ScrollView>
          ) : null}

          <Text style={styles.label}>NOTES & DESCRIPTION (OPTIONAL)</Text>
          <TextInput
            style={[styles.input, styles.description]}
            multiline
            placeholder="Add details, itinerary, or rules for this group…"
            placeholderTextColor="#64748B"
            value={desc}
            onChangeText={setDesc}
            maxLength={500}
          />

          <Pressable
            style={[styles.btn, !name.trim() && styles.disabled]}
            onPress={submit}
            disabled={!name.trim()}
          >
            <Ionicons name="sparkles" size={16} color="#06090F" />
            <Text style={styles.btnText}>LAUNCH CIRCLE</Text>
          </Pressable>

          <Pressable onPress={onClose} style={styles.cancelBtn}>
            <Text style={styles.cancel}>DISMISS</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  box: {
    backgroundColor: '#0B101E',
    paddingHorizontal: 22,
    paddingTop: 12,
    paddingBottom: 32,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 229, 255, 0.3)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 12,
  },
  handleBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignSelf: 'center',
    marginBottom: 16,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 18,
  },
  eyebrow: {
    color: '#00E5FF',
    fontSize: 9.5,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: -0.3,
    marginTop: 2,
  },
  closeIconBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  label: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 8,
    marginTop: 6,
  },
  input: {
    backgroundColor: '#0E1524',
    color: '#FFFFFF',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    fontSize: 14,
    fontWeight: '600',
  },
  description: {
    height: 80,
    textAlignVertical: 'top',
  },
  scroll: {
    marginBottom: 14,
  },
  memberChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 229, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.25)',
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  memberChipText: {
    color: '#E2E8F0',
    fontSize: 12,
    fontWeight: '600',
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 12,
    backgroundColor: '#0E1524',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  activeChip: {
    backgroundColor: 'rgba(0, 229, 255, 0.15)',
    borderColor: '#00E5FF',
  },
  chipText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '700',
  },
  activeText: {
    color: '#00E5FF',
    fontWeight: '800',
  },
  btn: {
    backgroundColor: '#00E5FF',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
    shadowColor: '#00E5FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  btnText: {
    color: '#06090F',
    fontWeight: '900',
    fontSize: 12,
    letterSpacing: 1,
  },
  disabled: {
    opacity: 0.4,
  },
  cancelBtn: {
    marginTop: 14,
    alignItems: 'center',
  },
  cancel: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
});
