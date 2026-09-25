import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { GROUP_TYPES } from '../constants/groupTypes';

const CURRENCIES = ['INR', 'USD', 'EUR', 'GBP', 'AED', 'SGD'];

type Props = {
  visible: boolean;
  onClose: () => void;
  onCreate: (group: {
    name: string;
    type: string;
    currency: string;
    description: string;
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

  const submit = () => {
    const cleanName = name.trim();
    if (!cleanName) return;

    onCreate({
      name: cleanName,
      type,
      currency,
      description: desc.trim(),
    });

    setName('');
    setDesc('');
    setType('Trip');
    setCurrency('INR');
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.box}>
          <Text style={styles.title}>Create Group</Text>

          <TextInput
            style={styles.input}
            placeholder="Group Name"
            placeholderTextColor="#94A3B8"
            value={name}
            onChangeText={setName}
            maxLength={80}
          />

          <Text style={styles.label}>Group Type</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.scroll}
          >
            {GROUP_TYPES.map((groupType) => (
              <Pressable
                key={groupType}
                style={[
                  styles.chip,
                  type === groupType && styles.activeChip,
                ]}
                onPress={() => setType(groupType)}
              >
                <Text
                  style={[
                    styles.chipText,
                    type === groupType && styles.activeText,
                  ]}
                >
                  {groupType}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          <Text style={styles.label}>Base Currency</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.scroll}
          >
            {CURRENCIES.map((code) => (
              <Pressable
                key={code}
                style={[
                  styles.chip,
                  currency === code && styles.activeChip,
                ]}
                onPress={() => setCurrency(code)}
              >
                <Text
                  style={[
                    styles.chipText,
                    currency === code && styles.activeText,
                  ]}
                >
                  {code}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          <TextInput
            style={[styles.input, styles.description]}
            multiline
            placeholder="Description (optional)"
            placeholderTextColor="#94A3B8"
            value={desc}
            onChangeText={setDesc}
            maxLength={500}
          />

          <Pressable
            style={[styles.btn, !name.trim() && styles.disabled]}
            onPress={submit}
            disabled={!name.trim()}
          >
            <Text style={styles.btnText}>Create</Text>
          </Pressable>

          <Pressable onPress={onClose}>
            <Text style={styles.cancel}>Cancel</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  box: {
    backgroundColor: '#0F172A',
    padding: 24,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 20,
  },
  label: {
    color: '#94A3B8',
    marginBottom: 10,
  },
  input: {
    backgroundColor: '#1E293B',
    color: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
  },
  description: {
    height: 90,
    textAlignVertical: 'top',
  },
  scroll: {
    marginBottom: 16,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: '#1E293B',
    marginRight: 10,
  },
  activeChip: {
    backgroundColor: '#0EA5A4',
  },
  chipText: {
    color: '#CBD5E1',
  },
  activeText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  btn: {
    backgroundColor: '#0EA5A4',
    padding: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  btnText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  disabled: {
    opacity: 0.5,
  },
  cancel: {
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 18,
  },
});
