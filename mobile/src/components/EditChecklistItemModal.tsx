import React, { useEffect, useState } from 'react';
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
import { ChecklistItem, ChecklistUpdateInput } from '../services/checklistService';
import { GroupMember } from '../services/memberService';
import { hapticSelection, hapticSuccess, hapticWarning } from '../utils/haptics';

type Props = {
  visible: boolean;
  item: ChecklistItem | null;
  members: GroupMember[];
  currentUserId?: string | null;
  onClose: () => void;
  onSave: (checklistId: string, payload: ChecklistUpdateInput) => Promise<void>;
  onDelete?: (item: ChecklistItem) => void;
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

export default function EditChecklistItemModal({
  visible,
  item,
  members,
  currentUserId,
  onClose,
  onSave,
  onDelete,
}: Props) {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<TemplateCategory>('General');
  const [scope, setScope] = useState<'personal' | 'group'>('personal');
  const [isPrivate, setIsPrivate] = useState(false);
  const [assignedTo, setAssignedTo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (item) {
      setTitle(item.title);
      setCategory((item.category as TemplateCategory) || 'General');
      setScope(item.scope);
      setIsPrivate(item.is_private);
      setAssignedTo(item.assigned_to || null);
      setError(null);
    }
  }, [item, visible]);

  if (!item) return null;

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
      setError('Item title cannot be empty.');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await onSave(item.id, {
        title: cleanTitle,
        category,
        scope,
        is_private: scope === 'personal' ? isPrivate : false,
        assigned_to: scope === 'group' ? assignedTo : null,
      });
      void hapticSuccess();
      onClose();
    } catch (e: any) {
      setError(e.message || 'Failed to update item');
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

          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.sheetTitle}>Edit Checklist Item</Text>
              <Text style={styles.sheetSubtitle}>Modify item name, category, scope or assignee</Text>
            </View>
            <Pressable style={styles.closeBtn} onPress={onClose}>
              <Ionicons name="close" size={20} color="#94A3B8" />
            </Pressable>
          </View>

          <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
            {error ? (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle" size={14} color="#EF4444" />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            {/* Scope Mode Switcher */}
            <Text style={styles.label}>PACKING TYPE</Text>
            <View style={styles.scopeRow}>
              <Pressable
                style={[styles.scopeBtn, scope === 'personal' && styles.scopeBtnActive]}
                onPress={() => handleScopeChange('personal')}
              >
                <Ionicons
                  name="person"
                  size={14}
                  color={scope === 'personal' ? '#06090F' : '#94A3B8'}
                />
                <Text
                  style={[
                    styles.scopeBtnText,
                    scope === 'personal' && styles.scopeBtnTextActive,
                  ]}
                >
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
                <Text
                  style={[
                    styles.scopeBtnText,
                    scope === 'group' && styles.scopeBtnTextActive,
                  ]}
                >
                  Group Gear
                </Text>
              </Pressable>
            </View>

            {/* Title Input */}
            <Text style={styles.label}>ITEM NAME</Text>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="e.g. Toothbrush, Power Bank, Beach Towel"
              placeholderTextColor="#64748B"
              style={styles.textInput}
              maxLength={150}
              autoFocus={false}
            />

            {/* Category Selector */}
            <Text style={styles.label}>CATEGORY</Text>
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
                      styles.catChip,
                      isSelected && {
                        backgroundColor: catColor + '20',
                        borderColor: catColor,
                      },
                    ]}
                    onPress={() => {
                      void hapticSelection();
                      setCategory(cat);
                    }}
                  >
                    <Ionicons
                      name={catIcon as any}
                      size={13}
                      color={isSelected ? catColor : '#94A3B8'}
                    />
                    <Text
                      style={[
                        styles.catChipText,
                        isSelected && { color: catColor, fontWeight: '800' },
                      ]}
                    >
                      {cat}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            {/* Personal: Private Toggle */}
            {scope === 'personal' ? (
              <View style={styles.privateCard}>
                <View style={styles.privateLeft}>
                  <View style={styles.privateIconWrap}>
                    <Ionicons name="lock-closed" size={16} color="#FFB800" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.privateTitle}>Private to Me</Text>
                    <Text style={styles.privateSubtitle}>
                      When on, other trip members will not be able to see this item.
                    </Text>
                  </View>
                </View>
                <Switch
                  value={isPrivate}
                  onValueChange={(val) => {
                    void hapticSelection();
                    setIsPrivate(val);
                  }}
                  trackColor={{ false: '#1E293B', true: 'rgba(255, 184, 0, 0.4)' }}
                  thumbColor={isPrivate ? '#FFB800' : '#64748B'}
                />
              </View>
            ) : null}

            {/* Group Gear: Assignee Selector */}
            {scope === 'group' ? (
              <View style={styles.assignSection}>
                <Text style={styles.label}>WHO IS BRINGING THIS GEAR?</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.memberScroll}
                >
                  <Pressable
                    style={[
                      styles.memberChip,
                      assignedTo === null && styles.memberChipActive,
                    ]}
                    onPress={() => {
                      void hapticSelection();
                      setAssignedTo(null);
                    }}
                  >
                    <Ionicons
                      name="people-outline"
                      size={13}
                      color={assignedTo === null ? '#06090F' : '#94A3B8'}
                    />
                    <Text
                      style={[
                        styles.memberChipText,
                        assignedTo === null && styles.memberChipTextActive,
                      ]}
                    >
                      Unassigned
                    </Text>
                  </Pressable>

                  {members.map((member) => {
                    const uid = member.user_id;
                    if (!uid) return null;
                    const isSelected = assignedTo === uid;
                    const isMe = uid === currentUserId;
                    const name = isMe ? `${displayName(member)} (You)` : displayName(member);

                    return (
                      <Pressable
                        key={member.id}
                        style={[styles.memberChip, isSelected && styles.memberChipActive]}
                        onPress={() => {
                          void hapticSelection();
                          setAssignedTo(uid);
                        }}
                      >
                        <Ionicons
                          name="person"
                          size={12}
                          color={isSelected ? '#06090F' : '#00E5FF'}
                        />
                        <Text
                          style={[
                            styles.memberChipText,
                            isSelected && styles.memberChipTextActive,
                          ]}
                          numberOfLines={1}
                        >
                          {name}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>
            ) : null}

            <View style={{ height: 20 }} />
          </ScrollView>

          {/* Action Footer */}
          <View style={styles.footerRow}>
            {onDelete ? (
              <Pressable
                style={styles.deleteActionBtn}
                onPress={() => {
                  onClose();
                  onDelete(item);
                }}
              >
                <Ionicons name="trash-outline" size={17} color="#FF4B72" />
              </Pressable>
            ) : null}

            <Pressable
              style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
              onPress={handleSave}
              disabled={submitting}
            >
              <Ionicons name="checkmark-circle" size={18} color="#06090F" />
              <Text style={styles.submitBtnText}>
                {submitting ? 'Saving...' : 'Save Changes'}
              </Text>
            </Pressable>
          </View>
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
    maxHeight: '85%',
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  handle: {
    width: 38,
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
    marginBottom: 16,
  },
  sheetTitle: { color: '#FFFFFF', fontSize: 17, fontWeight: '800' },
  sheetSubtitle: { color: '#64748B', fontSize: 12, fontWeight: '600', marginTop: 2 },
  closeBtn: {
    padding: 6,
    borderRadius: 20,
    backgroundColor: '#1E293B',
  },
  scroll: { maxHeight: 420 },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(239,68,68,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.3)',
    borderRadius: 10,
    padding: 10,
    marginBottom: 14,
  },
  errorText: { color: '#EF4444', fontSize: 12, fontWeight: '600', flex: 1 },
  label: {
    color: '#64748B',
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 8,
    marginTop: 12,
  },
  scopeRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 8,
  },
  scopeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#161F30',
    borderWidth: 1,
    borderColor: '#243247',
  },
  scopeBtnActive: {
    backgroundColor: '#00E5FF',
    borderColor: '#00E5FF',
  },
  scopeBtnText: { color: '#94A3B8', fontSize: 12, fontWeight: '700' },
  scopeBtnTextActive: { color: '#06090F', fontWeight: '900' },
  textInput: {
    backgroundColor: '#06090F',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#243247',
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  catScroll: { gap: 8, paddingVertical: 4 },
  catChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: '#161F30',
    borderWidth: 1,
    borderColor: '#243247',
  },
  catChipText: { color: '#94A3B8', fontSize: 12, fontWeight: '700' },
  privateCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#161F30',
    borderRadius: 14,
    padding: 12,
    marginTop: 14,
    borderWidth: 1,
    borderColor: '#243247',
  },
  privateLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    marginRight: 10,
  },
  privateIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 184, 0, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  privateTitle: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  privateSubtitle: { color: '#64748B', fontSize: 11, fontWeight: '500', marginTop: 1 },
  assignSection: { marginTop: 4 },
  memberScroll: { gap: 8, paddingVertical: 4 },
  memberChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: '#161F30',
    borderWidth: 1,
    borderColor: '#243247',
  },
  memberChipActive: {
    backgroundColor: '#00E5FF',
    borderColor: '#00E5FF',
  },
  memberChipText: { color: '#94A3B8', fontSize: 12, fontWeight: '700' },
  memberChipTextActive: { color: '#06090F', fontWeight: '900' },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 14,
  },
  deleteActionBtn: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 75, 114, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 75, 114, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtn: {
    flex: 1,
    backgroundColor: '#00E5FF',
    borderRadius: 14,
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  submitBtnDisabled: { opacity: 0.5 },
  submitBtnText: { color: '#06090F', fontSize: 14, fontWeight: '900' },
});
