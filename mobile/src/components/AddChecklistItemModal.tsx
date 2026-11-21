import React, { useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  CATEGORY_ICONS,
  CATEGORY_COLORS,
  TemplateCategory,
} from '../constants/checklistTemplates';
import { ChecklistCreateInput } from '../services/checklistService';
import { GroupMember } from '../services/memberService';
import { hapticSelection, hapticSuccess, hapticWarning } from '../utils/haptics';

type Props = {
  visible: boolean;
  onClose: () => void;
  onAdd: (item: ChecklistCreateInput) => Promise<void>;
  members: GroupMember[];
  currentUserId?: string | null;
  defaultScope?: 'personal' | 'group';
};

const ALL_CATEGORIES: TemplateCategory[] = [
  'Clothing',
  'Toiletries',
  'Electronics',
  'Documents',
  'Medical',
  'Gear',
  'Food',
  'General',
];

export default function AddChecklistItemModal({
  visible,
  onClose,
  onAdd,
  members,
  currentUserId,
  defaultScope = 'personal',
}: Props) {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<TemplateCategory>('General');
  const [scope, setScope] = useState<'personal' | 'group'>(defaultScope);
  const [isPrivate, setIsPrivate] = useState(false);
  const [assignedTo, setAssignedTo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleScopeChange = (newScope: 'personal' | 'group') => {
    void hapticSelection();
    setScope(newScope);
    if (newScope === 'group') {
      setIsPrivate(false);
    }
  };

  const handleSave = async () => {
    const cleanTitle = title.trim();
    if (!cleanTitle) {
      void hapticWarning();
      setError('Please enter an item name.');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await onAdd({
        title: cleanTitle,
        category,
        scope,
        is_private: scope === 'personal' ? isPrivate : false,
        assigned_to: scope === 'group' ? assignedTo : null,
      });
      void hapticSuccess();
      setTitle('');
      setIsPrivate(false);
      setAssignedTo(null);
      onClose();
    } catch (e: any) {
      setError(e.message || 'Failed to save item');
    } finally {
      setSubmitting(false);
    }
  };

  const displayName = (m: GroupMember) => m.full_name?.trim() || m.email || 'Member';

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={styles.dismissArea} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.handle} />

          <View style={styles.header}>
            <Text style={styles.sheetTitle}>Add Checklist Item</Text>
            <Pressable style={styles.closeBtn} onPress={onClose}>
              <Ionicons name="close" size={20} color="#94A3B8" />
            </Pressable>
          </View>

          {error ? (
            <View style={styles.errorBanner}>
              <Ionicons name="alert-circle" size={14} color="#EF4444" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {/* Scope Mode Switcher */}
          <View style={styles.scopeSwitch}>
            <Pressable
              style={[styles.scopeBtn, scope === 'personal' && styles.scopeBtnActive]}
              onPress={() => handleScopeChange('personal')}
            >
              <Ionicons
                name="person"
                size={14}
                color={scope === 'personal' ? '#06090F' : '#94A3B8'}
              />
              <Text style={[styles.scopeText, scope === 'personal' && styles.scopeTextActive]}>
                Personal Packing
              </Text>
            </Pressable>
            <Pressable
              style={[styles.scopeBtn, scope === 'group' && styles.scopeBtnActive]}
              onPress={() => handleScopeChange('group')}
            >
              <Ionicons
                name="people"
                size={14}
                color={scope === 'group' ? '#06090F' : '#94A3B8'}
              />
              <Text style={[styles.scopeText, scope === 'group' && styles.scopeTextActive]}>
                Group Gear
              </Text>
            </Pressable>
          </View>

          {/* Title Input */}
          <Text style={styles.label}>Item Name</Text>
          <View style={styles.inputWrap}>
            <TextInput
              style={styles.input}
              placeholder="e.g. Swimwear, Bluetooth Speaker, Power Bank..."
              placeholderTextColor="#64748B"
              value={title}
              onChangeText={(t) => {
                setTitle(t);
                if (error) setError(null);
              }}
              autoFocus={true}
            />
          </View>

          {/* Category Selector */}
          <Text style={styles.label}>Category</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.catScroll}
          >
            {ALL_CATEGORIES.map((cat) => {
              const isSelected = cat === category;
              const catColor = CATEGORY_COLORS[cat] || '#00E5FF';
              const catIcon = CATEGORY_ICONS[cat] || 'checkbox-outline';

              return (
                <Pressable
                  key={cat}
                  style={[
                    styles.catPill,
                    isSelected && { backgroundColor: catColor + '20', borderColor: catColor },
                  ]}
                  onPress={() => {
                    void hapticSelection();
                    setCategory(cat);
                  }}
                >
                  <Ionicons name={catIcon as any} size={14} color={isSelected ? catColor : '#64748B'} />
                  <Text style={[styles.catText, isSelected && { color: catColor, fontWeight: '800' }]}>
                    {cat}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {/* Personal vs Group conditional controls */}
          {scope === 'personal' ? (
            <View style={styles.privacyCard}>
              <View style={styles.privacyHeader}>
                <View style={styles.privacyTitleRow}>
                  <Ionicons name="lock-closed" size={16} color="#FFB800" />
                  <Text style={styles.privacyTitle}>Private to Me Only</Text>
                </View>
                <Switch
                  value={isPrivate}
                  onValueChange={(val) => {
                    void hapticSelection();
                    setIsPrivate(val);
                  }}
                  trackColor={{ false: '#1E293B', true: '#FFB800' }}
                  thumbColor={isPrivate ? '#06090F' : '#94A3B8'}
                />
              </View>
              <Text style={styles.privacyDesc}>
                {isPrivate
                  ? '🔒 Hidden from other group members. Only you will see and tick this item.'
                  : 'Visible to the group as a common packing suggestion (your tick remains private).'}
              </Text>
            </View>
          ) : (
            <View style={styles.assignWrap}>
              <Text style={styles.label}>Who is bringing this for the group?</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.memberScroll}
              >
                <Pressable
                  style={[styles.memberPill, assignedTo === null && styles.memberPillActive]}
                  onPress={() => {
                    void hapticSelection();
                    setAssignedTo(null);
                  }}
                >
                  <Text style={[styles.memberPillText, assignedTo === null && styles.memberPillTextActive]}>
                    Unassigned (Anyone)
                  </Text>
                </Pressable>
                {members.map((m) => {
                  const uid = m.user_id as string;
                  const isAssigned = assignedTo === uid;
                  return (
                    <Pressable
                      key={m.id}
                      style={[styles.memberPill, isAssigned && styles.memberPillActive]}
                      onPress={() => {
                        void hapticSelection();
                        setAssignedTo(uid);
                      }}
                    >
                      <Text style={[styles.memberPillText, isAssigned && styles.memberPillTextActive]}>
                        {uid === currentUserId ? 'You' : displayName(m)}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          )}

          {/* Submit */}
          <Pressable
            style={[styles.saveBtn, submitting && styles.saveBtnDisabled]}
            onPress={handleSave}
            disabled={submitting}
          >
            <Ionicons name="add-circle" size={18} color="#06090F" />
            <Text style={styles.saveBtnText}>{submitting ? 'Adding...' : 'Add Item'}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end' },
  dismissArea: { flex: 1 },
  sheet: {
    backgroundColor: '#0E1524',
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 28,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#334155',
    alignSelf: 'center',
    marginBottom: 14,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sheetTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '800' },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(239,68,68,0.15)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    marginBottom: 10,
  },
  errorText: { color: '#EF4444', fontSize: 12, fontWeight: '700' },
  scopeSwitch: {
    flexDirection: 'row',
    backgroundColor: '#06090F',
    borderRadius: 12,
    padding: 3,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  scopeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
  },
  scopeBtnActive: { backgroundColor: '#00E5FF' },
  scopeText: { color: '#94A3B8', fontSize: 12, fontWeight: '700' },
  scopeTextActive: { color: '#06090F', fontWeight: '900' },
  label: { color: '#94A3B8', fontSize: 12, fontWeight: '700', marginBottom: 6 },
  inputWrap: {
    backgroundColor: '#06090F',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 14,
    marginBottom: 14,
    height: 48,
    justifyContent: 'center',
  },
  input: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  catScroll: { gap: 6, paddingBottom: 14 },
  catPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#06090F',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  catText: { color: '#94A3B8', fontSize: 12, fontWeight: '600' },
  privacyCard: {
    backgroundColor: '#06090F',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,184,0,0.25)',
    marginBottom: 16,
  },
  privacyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  privacyTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  privacyTitle: { color: '#FFB800', fontSize: 13, fontWeight: '800' },
  privacyDesc: { color: '#94A3B8', fontSize: 11, lineHeight: 16 },
  assignWrap: { marginBottom: 16 },
  memberScroll: { gap: 6, paddingVertical: 4 },
  memberPill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#06090F',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  memberPillActive: { backgroundColor: '#A855F7', borderColor: '#A855F7' },
  memberPillText: { color: '#94A3B8', fontSize: 12, fontWeight: '700' },
  memberPillTextActive: { color: '#FFFFFF', fontWeight: '800' },
  saveBtn: {
    backgroundColor: '#00E5FF',
    borderRadius: 14,
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText: { color: '#06090F', fontSize: 14, fontWeight: '900' },
});
