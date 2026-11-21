import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  getChecklists,
  createChecklistItem,
  importChecklistItems,
  toggleChecklistItem,
  assignChecklistItem,
  updateChecklistItem,
  deleteChecklistItem,
  ChecklistSummary,
  ChecklistItem,
  ChecklistCreateInput,
  ChecklistUpdateInput,
} from '../services/checklistService';
import { GroupMember } from '../services/memberService';
import {
  CATEGORY_ICONS,
  CATEGORY_COLORS,
  TemplateItem,
} from '../constants/checklistTemplates';
import ChecklistImportModal from './ChecklistImportModal';
import AddChecklistItemModal from './AddChecklistItemModal';
import EditChecklistItemModal from './EditChecklistItemModal';
import AssignMemberModal from './AssignMemberModal';
import { hapticSelection, hapticSuccess, hapticWarning } from '../utils/haptics';

type Props = {
  groupId: string;
  members: GroupMember[];
  currentUserId?: string | null;
};

export default function ChecklistView({ groupId, members, currentUserId }: Props) {
  const [data, setData] = useState<ChecklistSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'personal' | 'group'>('personal');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [showImportModal, setShowImportModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);

  // Assignment, Editing & Deleting Modals
  const [assignItem, setAssignItem] = useState<ChecklistItem | null>(null);
  const [editingItem, setEditingItem] = useState<ChecklistItem | null>(null);
  const [deletingItem, setDeletingItem] = useState<ChecklistItem | null>(null);

  const loadData = useCallback(async () => {
    try {
      const res = await getChecklists(groupId);
      if (res) {
        setData(res);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const activeItems = useMemo<ChecklistItem[]>(() => {
    if (!data) return [];
    return activeTab === 'personal' ? data.personal : data.group;
  }, [data, activeTab]);

  const availableCategories = useMemo<string[]>(() => {
    const cats = new Set<string>();
    activeItems.forEach((it) => cats.add(it.category));
    return ['All', ...Array.from(cats)];
  }, [activeItems]);

  const filteredItems = useMemo<ChecklistItem[]>(() => {
    if (selectedCategory === 'All') return activeItems;
    return activeItems.filter((it) => it.category === selectedCategory);
  }, [activeItems, selectedCategory]);

  // Group items by category for structured UX
  const groupedItems = useMemo(() => {
    const map = new Map<string, ChecklistItem[]>();
    filteredItems.forEach((item) => {
      const cat = item.category || 'General';
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(item);
    });
    return Array.from(map.entries());
  }, [filteredItems]);

  const handleToggle = async (item: ChecklistItem) => {
    void hapticSelection();
    // Optimistic local update
    setData((prev) => {
      if (!prev) return prev;
      const key = activeTab === 'personal' ? 'personal' : 'group';
      const updatedList = prev[key].map((it) => {
        if (it.id === item.id) {
          return { ...it, is_packed: !it.is_packed };
        }
        return it;
      });
      const packedCount = updatedList.filter((it) => it.is_packed).length;
      return {
        ...prev,
        [key]: updatedList,
        [`${key}_packed`]: packedCount,
      };
    });

    try {
      await toggleChecklistItem(groupId, item.id);
    } catch {
      // Revert on failure
      loadData();
    }
  };

  const handleAssignToMe = async (item: ChecklistItem) => {
    if (!currentUserId) return;
    void hapticSuccess();
    try {
      await assignChecklistItem(groupId, item.id, currentUserId);
      loadData();
    } catch {
      Alert.alert('Unable to assign item', 'Please try again.');
    }
  };

  const handleUnclaim = async (item: ChecklistItem) => {
    void hapticWarning();
    try {
      await assignChecklistItem(groupId, item.id, null);
      loadData();
    } catch {
      Alert.alert('Unable to unclaim item', 'Please try again.');
    }
  };

  const handleAssign = async (itemId: string, memberId: string | null) => {
    try {
      await assignChecklistItem(groupId, itemId, memberId);
      loadData();
    } catch {
      Alert.alert('Unable to update assignment', 'Please try again.');
    }
  };

  const handleUpdate = async (checklistId: string, payload: ChecklistUpdateInput) => {
    await updateChecklistItem(groupId, checklistId, payload);
    await loadData();
  };

  const confirmDelete = async () => {
    if (!deletingItem) return;
    const target = deletingItem;
    setDeletingItem(null);
    void hapticWarning();

    // Optimistic removal
    setData((prev) => {
      if (!prev) return prev;
      const key = target.scope === 'personal' ? 'personal' : 'group';
      const updatedList = prev[key].filter((it) => it.id !== target.id);
      const packedCount = updatedList.filter((it) => it.is_packed).length;
      return {
        ...prev,
        [key]: updatedList,
        [`${key}_total`]: updatedList.length,
        [`${key}_packed`]: packedCount,
      };
    });

    try {
      await deleteChecklistItem(groupId, target.id);
      loadData();
    } catch (e: any) {
      Alert.alert('Unable to delete item', e.message || 'Error occurred');
      loadData();
    }
  };

  const handleImport = async (templateItems: TemplateItem[]) => {
    const payload = templateItems.map((it) => ({
      title: it.title,
      category: it.category,
      scope: it.scope,
    }));
    await importChecklistItems(groupId, payload);
    await loadData();
  };

  const handleAdd = async (input: ChecklistCreateInput) => {
    await createChecklistItem(groupId, input);
    await loadData();
  };

  const total = activeTab === 'personal' ? data?.personal_total ?? 0 : data?.group_total ?? 0;
  const packed = activeTab === 'personal' ? data?.personal_packed ?? 0 : data?.group_packed ?? 0;
  const progressPercent = total > 0 ? Math.round((packed / total) * 100) : 0;

  if (loading && !data) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator size="small" color="#00E5FF" />
        <Text style={styles.loadingText}>Loading checklist...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Scope Mode Switcher */}
      <View style={styles.tabBar}>
        <Pressable
          style={[styles.tabBtn, activeTab === 'personal' && styles.tabBtnActive]}
          onPress={() => {
            void hapticSelection();
            setActiveTab('personal');
            setSelectedCategory('All');
          }}
        >
          <Ionicons
            name="person"
            size={14}
            color={activeTab === 'personal' ? '#06090F' : '#94A3B8'}
          />
          <Text style={[styles.tabBtnText, activeTab === 'personal' && styles.tabBtnTextActive]}>
            My Packing ({data?.personal_packed ?? 0}/{data?.personal_total ?? 0})
          </Text>
        </Pressable>

        <Pressable
          style={[styles.tabBtn, activeTab === 'group' && styles.tabBtnActive]}
          onPress={() => {
            void hapticSelection();
            setActiveTab('group');
            setSelectedCategory('All');
          }}
        >
          <Ionicons
            name="people"
            size={14}
            color={activeTab === 'group' ? '#06090F' : '#94A3B8'}
          />
          <Text style={[styles.tabBtnText, activeTab === 'group' && styles.tabBtnTextActive]}>
            Group Gear ({data?.group_packed ?? 0}/{data?.group_total ?? 0})
          </Text>
        </Pressable>
      </View>

      {/* Progress HUD Card */}
      <View style={styles.hudCard}>
        <View style={styles.hudRow}>
          <View>
            <Text style={styles.hudTitle}>
              {activeTab === 'personal' ? 'Your Suitcase Progress' : 'Shared Group Gear'}
            </Text>
            <Text style={styles.hudSubtitle}>
              {total === 0
                ? 'No items added yet'
                : `${packed} of ${total} items packed (${progressPercent}%)`}
            </Text>
          </View>
          <View style={styles.progressPill}>
            <Text style={styles.progressPillText}>{progressPercent}%</Text>
          </View>
        </View>

        <View style={styles.progressBarTrack}>
          <View style={[styles.progressBarFill, { width: `${progressPercent}%` }]} />
        </View>

        {activeTab === 'personal' ? (
          <Text style={styles.privacyNote}>
            🔒 Your checkmarks are private to you. Other members cannot see what you packed.
          </Text>
        ) : (
          <Text style={styles.privacyNote}>
            👥 Shared items needed once for the group. Anyone can volunteer to bring unassigned gear.
          </Text>
        )}
      </View>

      {/* Action Row */}
      <View style={styles.actionsRow}>
        <Pressable style={styles.importBtn} onPress={() => setShowImportModal(true)}>
          <Ionicons name="sparkles" size={14} color="#00E5FF" />
          <Text style={styles.importBtnText}>Import Template</Text>
        </Pressable>

        <Pressable style={styles.addBtn} onPress={() => setShowAddModal(true)}>
          <Ionicons name="add" size={16} color="#06090F" />
          <Text style={styles.addBtnText}>Add Item</Text>
        </Pressable>
      </View>

      {/* Category Filter Pills */}
      {availableCategories.length > 2 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.catFilterScroll}
        >
          {availableCategories.map((cat) => {
            const isSelected = cat === selectedCategory;
            return (
              <Pressable
                key={cat}
                style={[styles.catFilterPill, isSelected && styles.catFilterPillActive]}
                onPress={() => {
                  void hapticSelection();
                  setSelectedCategory(cat);
                }}
              >
                <Text style={[styles.catFilterText, isSelected && styles.catFilterTextActive]}>
                  {cat}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}

      {/* Item Groups */}
      {filteredItems.length === 0 ? (
        <View style={styles.emptyCard}>
          <View style={styles.emptyIconWrap}>
            <Ionicons
              name={activeTab === 'personal' ? 'bag-outline' : 'cube-outline'}
              size={28}
              color="#00E5FF"
            />
          </View>
          <Text style={styles.emptyTitle}>
            {activeTab === 'personal' ? 'Suitcase is empty' : 'No group gear added yet'}
          </Text>
          <Text style={styles.emptyDesc}>
            {activeTab === 'personal'
              ? 'Import a curated vacation pack or add custom items to track what you need to pack.'
              : 'Add shared items like speakers, tents, or first aid kits so everyone knows who is bringing what.'}
          </Text>
          <Pressable style={styles.emptyCta} onPress={() => setShowImportModal(true)}>
            <Ionicons name="sparkles" size={15} color="#06090F" />
            <Text style={styles.emptyCtaText}>Choose a Starter Template</Text>
          </Pressable>
        </View>
      ) : (
        groupedItems.map(([catName, items]) => {
          const catColor = CATEGORY_COLORS[catName] || '#00E5FF';
          const catIcon = CATEGORY_ICONS[catName] || 'checkbox-outline';

          return (
            <View key={catName} style={styles.catGroup}>
              {/* Category Header */}
              <View style={styles.catHeader}>
                <View style={[styles.catDot, { backgroundColor: catColor }]} />
                <Ionicons name={catIcon as any} size={13} color={catColor} style={{ marginRight: 5 }} />
                <Text style={styles.catHeaderText}>{catName}</Text>
                <Text style={styles.catCount}>({items.filter((i) => i.is_packed).length}/{items.length})</Text>
              </View>

              {/* Items in Category */}
              <View style={styles.itemsCard}>
                {items.map((item, idx) => {
                  const isChecked = item.is_packed;
                  const isMyPrivate = item.is_private && item.created_by === currentUserId;
                  const isAssignedToMe = item.assigned_to === currentUserId;

                  return (
                    <Pressable
                      key={item.id}
                      style={[
                        styles.itemRow,
                        idx > 0 && styles.itemRowBorder,
                        isChecked && styles.itemRowChecked,
                      ]}
                      onPress={() => handleToggle(item)}
                    >
                      {/* Checkbox */}
                      <View style={[styles.checkbox, isChecked && styles.checkboxChecked]}>
                        {isChecked ? <Ionicons name="checkmark" size={13} color="#06090F" /> : null}
                      </View>

                      {/* Title & Badges */}
                      <View style={styles.itemMain}>
                        <View style={styles.itemTitleRow}>
                          <Text
                            style={[styles.itemTitle, isChecked && styles.itemTitleDone]}
                            numberOfLines={1}
                          >
                            {item.title}
                          </Text>
                          {isMyPrivate ? (
                            <View style={styles.privateBadge}>
                              <Ionicons name="lock-closed" size={9} color="#FFB800" style={{ marginRight: 2 }} />
                              <Text style={styles.privateBadgeText}>Only you</Text>
                            </View>
                          ) : null}
                        </View>

                        {/* Group Assignment Meta */}
                        {item.scope === 'group' ? (
                          <View style={styles.groupMetaRow}>
                            {item.assigned_to ? (
                              <View style={styles.assignedBadgeGroup}>
                                <Pressable
                                  style={styles.assignedBadge}
                                  onPress={(e) => {
                                    e.stopPropagation();
                                    setAssignItem(item);
                                  }}
                                >
                                  <Ionicons name="person" size={10} color="#00E5FF" style={{ marginRight: 3 }} />
                                  <Text style={styles.assignedBadgeText} numberOfLines={1}>
                                    Brought by {isAssignedToMe ? 'You' : item.assigned_name || 'Member'} ▾
                                  </Text>
                                </Pressable>

                                {isAssignedToMe ? (
                                  <Pressable
                                    style={styles.revertChip}
                                    hitSlop={6}
                                    onPress={(e) => {
                                      e.stopPropagation();
                                      handleUnclaim(item);
                                    }}
                                  >
                                    <Ionicons name="close-circle" size={11} color="#FF4B72" style={{ marginRight: 2 }} />
                                    <Text style={styles.revertChipText}>Unclaim</Text>
                                  </Pressable>
                                ) : null}
                              </View>
                            ) : (
                              <View style={styles.unassignedRow}>
                                <Pressable
                                  style={styles.claimBtn}
                                  onPress={(e) => {
                                    e.stopPropagation();
                                    handleAssignToMe(item);
                                  }}
                                >
                                  <Ionicons name="hand-right-outline" size={10} color="#A855F7" style={{ marginRight: 3 }} />
                                  <Text style={styles.claimBtnText}>I'll bring this</Text>
                                </Pressable>

                                <Pressable
                                  style={styles.assignOtherBtn}
                                  onPress={(e) => {
                                    e.stopPropagation();
                                    setAssignItem(item);
                                  }}
                                >
                                  <Ionicons name="people-outline" size={10} color="#64748B" style={{ marginRight: 2 }} />
                                  <Text style={styles.assignOtherBtnText}>Assign ▾</Text>
                                </Pressable>
                              </View>
                            )}
                          </View>
                        ) : null}
                      </View>

                      {/* Right Side Actions: Edit & Delete */}
                      <View style={styles.itemActions}>
                        <Pressable
                          style={styles.actionIconBtn}
                          hitSlop={8}
                          onPress={(e) => {
                            e.stopPropagation();
                            setEditingItem(item);
                          }}
                        >
                          <Ionicons name="pencil-outline" size={15} color="#00E5FF" />
                        </Pressable>

                        <Pressable
                          style={styles.actionIconBtn}
                          hitSlop={8}
                          onPress={(e) => {
                            e.stopPropagation();
                            setDeletingItem(item);
                          }}
                        >
                          <Ionicons name="trash-outline" size={15} color="#FF4B72" />
                        </Pressable>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          );
        })
      )}

      {/* In-App Deletion Confirmation Modal */}
      {deletingItem ? (
        <Modal
          transparent={true}
          visible={Boolean(deletingItem)}
          animationType="fade"
          onRequestClose={() => setDeletingItem(null)}
        >
          <View style={styles.confirmBackdrop}>
            <View style={styles.confirmCard}>
              <View style={styles.confirmIconWrap}>
                <Ionicons name="trash-outline" size={26} color="#FF4B72" />
              </View>
              <Text style={styles.confirmTitle}>Delete Item?</Text>
              <Text style={styles.confirmDesc}>
                Are you sure you want to remove &quot;{deletingItem.title}&quot; from the checklist?
              </Text>

              <View style={styles.confirmActions}>
                <Pressable
                  style={styles.confirmCancelBtn}
                  onPress={() => setDeletingItem(null)}
                >
                  <Text style={styles.confirmCancelText}>Cancel</Text>
                </Pressable>

                <Pressable style={styles.confirmDeleteBtn} onPress={confirmDelete}>
                  <Text style={styles.confirmDeleteText}>Delete</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      ) : null}

      {/* Modals */}
      <ChecklistImportModal
        visible={showImportModal}
        onClose={() => setShowImportModal(false)}
        onImport={handleImport}
      />

      <AddChecklistItemModal
        visible={showAddModal}
        onClose={() => setShowAddModal(false)}
        onAdd={handleAdd}
        members={members}
        currentUserId={currentUserId}
        defaultScope={activeTab}
      />

      <EditChecklistItemModal
        visible={Boolean(editingItem)}
        item={editingItem}
        members={members}
        currentUserId={currentUserId}
        onClose={() => setEditingItem(null)}
        onSave={handleUpdate}
        onDelete={(item) => setDeletingItem(item)}
      />

      <AssignMemberModal
        visible={Boolean(assignItem)}
        item={assignItem}
        members={members}
        currentUserId={currentUserId ?? null}
        onClose={() => setAssignItem(null)}
        onAssign={handleAssign}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginTop: 4 },
  loadingWrap: { padding: 32, alignItems: 'center', gap: 8 },
  loadingText: { color: '#94A3B8', fontSize: 12 },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#0E1524',
    borderRadius: 14,
    padding: 3,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    borderRadius: 11,
  },
  tabBtnActive: { backgroundColor: '#00E5FF' },
  tabBtnText: { color: '#94A3B8', fontSize: 12, fontWeight: '700' },
  tabBtnTextActive: { color: '#06090F', fontWeight: '900' },
  hudCard: {
    backgroundColor: '#0E1524',
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  hudRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  hudTitle: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  hudSubtitle: { color: '#94A3B8', fontSize: 12, marginTop: 2 },
  progressPill: {
    backgroundColor: 'rgba(0,229,255,0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(0,229,255,0.3)',
  },
  progressPillText: { color: '#00E5FF', fontSize: 12, fontWeight: '900' },
  progressBarTrack: {
    height: 6,
    backgroundColor: '#06090F',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 10,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#00E5FF',
    borderRadius: 3,
  },
  privacyNote: {
    color: '#64748B',
    fontSize: 10.5,
    lineHeight: 15,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  importBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#0E1524',
    borderWidth: 1,
    borderColor: 'rgba(0,229,255,0.3)',
    borderRadius: 14,
    paddingVertical: 11,
  },
  importBtnText: { color: '#00E5FF', fontSize: 13, fontWeight: '800' },
  addBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#00E5FF',
    borderRadius: 14,
    paddingVertical: 11,
  },
  addBtnText: { color: '#06090F', fontSize: 13, fontWeight: '900' },
  catFilterScroll: { gap: 6, paddingBottom: 10 },
  catFilterPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: '#0E1524',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  catFilterPillActive: {
    backgroundColor: 'rgba(0,229,255,0.12)',
    borderColor: '#00E5FF',
  },
  catFilterText: { color: '#94A3B8', fontSize: 11.5, fontWeight: '700' },
  catFilterTextActive: { color: '#00E5FF' },
  catGroup: { marginBottom: 14 },
  catHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    paddingHorizontal: 2,
  },
  catDot: { width: 6, height: 6, borderRadius: 3, marginRight: 6 },
  catHeaderText: { color: '#FFFFFF', fontSize: 12.5, fontWeight: '800', flex: 1 },
  catCount: { color: '#64748B', fontSize: 11, fontWeight: '600' },
  itemsCard: {
    backgroundColor: '#0E1524',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  itemRowBorder: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.04)',
  },
  itemRowChecked: {
    opacity: 0.65,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#475569',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  checkboxChecked: {
    backgroundColor: '#00E5FF',
    borderColor: '#00E5FF',
  },
  itemMain: { flex: 1 },
  itemTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  itemTitle: { color: '#FFFFFF', fontSize: 13.5, fontWeight: '700' },
  itemTitleDone: { color: '#64748B', textDecorationLine: 'line-through' },
  privateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,184,0,0.12)',
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: 'rgba(255,184,0,0.3)',
  },
  privateBadgeText: { color: '#FFB800', fontSize: 9, fontWeight: '800' },
  groupMetaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  assignedBadgeGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  assignedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,229,255,0.1)',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(0,229,255,0.25)',
  },
  assignedBadgeText: { color: '#00E5FF', fontSize: 10.5, fontWeight: '700' },
  revertChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,75,114,0.12)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,75,114,0.3)',
  },
  revertChipText: { color: '#FF4B72', fontSize: 10, fontWeight: '800' },
  unassignedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  claimBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(168,85,247,0.12)',
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(168,85,247,0.3)',
  },
  claimBtnText: { color: '#A855F7', fontSize: 10, fontWeight: '800' },
  assignOtherBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: 6,
    paddingVertical: 2.5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  assignOtherBtnText: { color: '#94A3B8', fontSize: 10, fontWeight: '700' },
  itemActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginLeft: 8,
  },
  actionIconBtn: {
    padding: 6,
    borderRadius: 6,
  },
  emptyCard: {
    backgroundColor: '#0E1524',
    borderRadius: 18,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    marginTop: 8,
  },
  emptyIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: '#06090F',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emptyTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '800', marginBottom: 6 },
  emptyDesc: {
    color: '#94A3B8',
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    maxWidth: 280,
    marginBottom: 16,
  },
  emptyCta: {
    backgroundColor: '#00E5FF',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  emptyCtaText: { color: '#06090F', fontSize: 12.5, fontWeight: '900' },
  confirmBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  confirmCard: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#0E1524',
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  confirmIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255,75,114,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,75,114,0.25)',
  },
  confirmTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '800', marginBottom: 6 },
  confirmDesc: {
    color: '#94A3B8',
    fontSize: 12.5,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 18,
  },
  confirmActions: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  confirmCancelBtn: {
    flex: 1,
    backgroundColor: '#161F30',
    borderRadius: 12,
    paddingVertical: 11,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#243247',
  },
  confirmCancelText: { color: '#CBD5E1', fontSize: 13, fontWeight: '700' },
  confirmDeleteBtn: {
    flex: 1,
    backgroundColor: '#FF4B72',
    borderRadius: 12,
    paddingVertical: 11,
    alignItems: 'center',
  },
  confirmDeleteText: { color: '#FFFFFF', fontSize: 13, fontWeight: '900' },
});
