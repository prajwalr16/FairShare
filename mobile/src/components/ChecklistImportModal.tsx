import React, { useState, useMemo } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  CHECKLIST_TEMPLATE_PACKS,
  ChecklistTemplatePack,
  CATEGORY_ICONS,
  CATEGORY_COLORS,
  TemplateItem,
} from '../constants/checklistTemplates';
import { hapticSelection, hapticSuccess } from '../utils/haptics';

type Props = {
  visible: boolean;
  onClose: () => void;
  onImport: (items: TemplateItem[]) => Promise<void>;
};

export default function ChecklistImportModal({ visible, onClose, onImport }: Props) {
  const [selectedPackId, setSelectedPackId] = useState<string>(CHECKLIST_TEMPLATE_PACKS[0].id);
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(() => {
    return new Set(CHECKLIST_TEMPLATE_PACKS[0].items.map((it) => it.id));
  });
  const [importing, setImporting] = useState<boolean>(false);
  const [editedTitles, setEditedTitles] = useState<Record<string, string>>({});
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState<string>('');

  const currentPack = useMemo<ChecklistTemplatePack>(() => {
    return (
      CHECKLIST_TEMPLATE_PACKS.find((p) => p.id === selectedPackId) ||
      CHECKLIST_TEMPLATE_PACKS[0]
    );
  }, [selectedPackId]);

  const categories = useMemo<string[]>(() => {
    const cats = new Set<string>();
    currentPack.items.forEach((it) => cats.add(it.category));
    return ['All', ...Array.from(cats)];
  }, [currentPack]);

  const visibleItems = useMemo<TemplateItem[]>(() => {
    if (activeCategory === 'All') return currentPack.items;
    return currentPack.items.filter((it) => it.category === activeCategory);
  }, [currentPack, activeCategory]);

  const handleSelectPack = (packId: string) => {
    void hapticSelection();
    setSelectedPackId(packId);
    setActiveCategory('All');
    setEditingItemId(null);
    const pack = CHECKLIST_TEMPLATE_PACKS.find((p) => p.id === packId);
    if (pack) {
      setSelectedItemIds(new Set(pack.items.map((it) => it.id)));
    }
  };

  const startEditing = (itemId: string, currentTitle: string) => {
    void hapticSelection();
    setEditingItemId(itemId);
    setEditingText(editedTitles[itemId] || currentTitle);
  };

  const saveEditing = (itemId: string) => {
    if (editingText.trim().length > 0) {
      setEditedTitles((prev) => ({
        ...prev,
        [itemId]: editingText.trim(),
      }));
    }
    setEditingItemId(null);
    setEditingText('');
  };

  const toggleItem = (itemId: string) => {
    void hapticSelection();
    setSelectedItemIds((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  };

  const handleToggleSelectAll = () => {
    void hapticSelection();
    const visibleIds = visibleItems.map((it) => it.id);
    const allSelected = visibleIds.every((id) => selectedItemIds.has(id));

    setSelectedItemIds((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        visibleIds.forEach((id) => next.delete(id));
      } else {
        visibleIds.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  const handleImport = async () => {
    const itemsToImport = currentPack.items
      .filter((it) => selectedItemIds.has(it.id))
      .map((it) => ({
        ...it,
        title: editedTitles[it.id]?.trim() || it.title,
      }));
    if (itemsToImport.length === 0) return;
    setImporting(true);
    try {
      await onImport(itemsToImport);
      void hapticSuccess();
      onClose();
    } finally {
      setImporting(false);
    }
  };

  const countSelected = selectedItemIds.size;
  const isAllVisibleSelected =
    visibleItems.length > 0 && visibleItems.every((it) => selectedItemIds.has(it.id));

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={styles.dismissArea} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.handle} />

          {/* Header */}
          <View style={styles.header}>
            <View>
              <Text style={styles.sheetTitle}>Import Packing Template</Text>
              <Text style={styles.sheetSubtitle}>Choose a curated template or pick selective items</Text>
            </View>
            <Pressable style={styles.closeBtn} onPress={onClose}>
              <Ionicons name="close" size={20} color="#94A3B8" />
            </Pressable>
          </View>

          {/* Template Packs Horizontal Bar */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.packScroll}
          >
            {CHECKLIST_TEMPLATE_PACKS.map((pack) => {
              const isSelected = pack.id === selectedPackId;
              return (
                <Pressable
                  key={pack.id}
                  style={[styles.packPill, isSelected && styles.packPillActive]}
                  onPress={() => handleSelectPack(pack.id)}
                >
                  <Ionicons
                    name={pack.icon as any}
                    size={16}
                    color={isSelected ? '#06090F' : '#00E5FF'}
                  />
                  <Text style={[styles.packText, isSelected && styles.packTextActive]}>
                    {pack.name}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {/* Category Filter & Select All */}
          <View style={styles.filterBar}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.catScroll}
            >
              {categories.map((cat) => {
                const isActive = cat === activeCategory;
                return (
                  <Pressable
                    key={cat}
                    style={[styles.catPill, isActive && styles.catPillActive]}
                    onPress={() => {
                      void hapticSelection();
                      setActiveCategory(cat);
                    }}
                  >
                    <Text style={[styles.catText, isActive && styles.catTextActive]}>
                      {cat}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            <Pressable style={styles.selectAllBtn} onPress={handleToggleSelectAll}>
              <Text style={styles.selectAllText}>
                {isAllVisibleSelected ? 'Deselect in View' : 'Select All in View'}
              </Text>
            </Pressable>
          </View>

          {/* Item List */}
          <ScrollView style={styles.itemsList} showsVerticalScrollIndicator={false}>
            {visibleItems.map((item) => {
              const isChecked = selectedItemIds.has(item.id);
              const isEditing = editingItemId === item.id;
              const displayTitle = editedTitles[item.id] || item.title;
              const hasCustomName = Boolean(editedTitles[item.id] && editedTitles[item.id] !== item.title);
              const catColor = CATEGORY_COLORS[item.category] || '#00E5FF';
              const catIcon = CATEGORY_ICONS[item.category] || 'checkbox-outline';

              return (
                <Pressable
                  key={item.id}
                  style={[styles.itemRow, isChecked && styles.itemRowChecked]}
                  onPress={() => toggleItem(item.id)}
                >
                  <View style={[styles.checkbox, isChecked && styles.checkboxActive]}>
                    {isChecked ? <Ionicons name="checkmark" size={13} color="#06090F" /> : null}
                  </View>

                  <View style={styles.itemInfo}>
                    {isEditing ? (
                      <View style={styles.editRow} onStartShouldSetResponder={() => true}>
                        <TextInput
                          value={editingText}
                          onChangeText={setEditingText}
                          style={styles.editInput}
                          autoFocus
                          selectTextOnFocus
                          onSubmitEditing={() => saveEditing(item.id)}
                          placeholder="Item name"
                          placeholderTextColor="#64748B"
                        />
                        <Pressable
                          style={styles.editSaveBtn}
                          onPress={(e) => {
                            e.stopPropagation();
                            saveEditing(item.id);
                          }}
                        >
                          <Ionicons name="checkmark" size={14} color="#06090F" />
                        </Pressable>
                      </View>
                    ) : (
                      <View style={styles.titleRow}>
                        <Text style={[styles.itemTitle, isChecked && styles.itemTitleChecked]} numberOfLines={1}>
                          {displayTitle}
                        </Text>
                        {hasCustomName ? (
                          <View style={styles.editedBadge}>
                            <Text style={styles.editedBadgeText}>Custom</Text>
                          </View>
                        ) : null}
                        <Pressable
                          style={styles.renameBtn}
                          hitSlop={8}
                          onPress={(e) => {
                            e.stopPropagation();
                            startEditing(item.id, displayTitle);
                          }}
                        >
                          <Ionicons name="pencil" size={12} color="#00E5FF" />
                        </Pressable>
                      </View>
                    )}

                    <View style={styles.itemMeta}>
                      <View style={[styles.catBadge, { borderColor: catColor + '40', backgroundColor: catColor + '15' }]}>
                        <Ionicons name={catIcon as any} size={10} color={catColor} style={{ marginRight: 3 }} />
                        <Text style={[styles.catBadgeText, { color: catColor }]}>{item.category}</Text>
                      </View>

                      {item.scope === 'group' ? (
                        <View style={styles.groupBadge}>
                          <Ionicons name="people" size={10} color="#A855F7" style={{ marginRight: 3 }} />
                          <Text style={styles.groupBadgeText}>Group Gear</Text>
                        </View>
                      ) : (
                        <View style={styles.personalBadge}>
                          <Ionicons name="person" size={10} color="#64748B" style={{ marginRight: 3 }} />
                          <Text style={styles.personalBadgeText}>Personal</Text>
                        </View>
                      )}
                    </View>
                  </View>
                </Pressable>
              );
            })}
            <View style={{ height: 20 }} />
          </ScrollView>

          {/* Bottom Action Footer */}
          <View style={styles.footer}>
            <Pressable
              style={[styles.importBtn, (countSelected === 0 || importing) && styles.importBtnDisabled]}
              onPress={handleImport}
              disabled={countSelected === 0 || importing}
            >
              <Ionicons name="cloud-download-outline" size={18} color="#06090F" />
              <Text style={styles.importBtnText}>
                {importing
                  ? 'Importing...'
                  : countSelected === 0
                  ? 'Select Items to Import'
                  : `Import ${countSelected} Item${countSelected > 1 ? 's' : ''}`}
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
    maxHeight: '88%',
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 24,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#334155',
    alignSelf: 'center',
    marginBottom: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  sheetTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '800' },
  sheetSubtitle: { color: '#64748B', fontSize: 11, marginTop: 2 },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  packScroll: { gap: 8, paddingBottom: 12 },
  packPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#06090F',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  packPillActive: {
    backgroundColor: '#00E5FF',
    borderColor: '#00E5FF',
  },
  packText: { color: '#94A3B8', fontSize: 12, fontWeight: '700' },
  packTextActive: { color: '#06090F', fontWeight: '900' },
  filterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    paddingVertical: 8,
    marginBottom: 8,
    gap: 8,
  },
  catScroll: { gap: 6 },
  catPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: '#06090F',
  },
  catPillActive: { backgroundColor: 'rgba(0,229,255,0.2)', borderWidth: 1, borderColor: '#00E5FF' },
  catText: { color: '#64748B', fontSize: 11, fontWeight: '600' },
  catTextActive: { color: '#00E5FF', fontWeight: '800' },
  selectAllBtn: { paddingHorizontal: 6, paddingVertical: 4 },
  selectAllText: { color: '#00E5FF', fontSize: 11, fontWeight: '700' },
  itemsList: { maxHeight: 340 },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: '#06090F',
    marginBottom: 6,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  itemRowChecked: { borderColor: 'rgba(0,229,255,0.3)', backgroundColor: '#131D31' },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#475569',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  checkboxActive: { backgroundColor: '#00E5FF', borderColor: '#00E5FF' },
  itemInfo: { flex: 1 },
  itemTitle: { color: '#CBD5E1', fontSize: 13, fontWeight: '700', flex: 1 },
  itemTitleChecked: { color: '#FFFFFF' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  renameBtn: {
    padding: 3,
    backgroundColor: 'rgba(0, 229, 255, 0.1)',
    borderRadius: 6,
    marginLeft: 4,
  },
  editedBadge: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
    backgroundColor: 'rgba(0, 229, 255, 0.15)',
    borderWidth: 0.5,
    borderColor: '#00E5FF',
  },
  editedBadgeText: { color: '#00E5FF', fontSize: 9, fontWeight: '800' },
  editRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  editInput: {
    flex: 1,
    backgroundColor: '#06090F',
    borderWidth: 1,
    borderColor: '#00E5FF',
    borderRadius: 8,
    color: '#FFFFFF',
    fontSize: 12.5,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  editSaveBtn: {
    backgroundColor: '#00E5FF',
    borderRadius: 8,
    padding: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  catBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
    borderWidth: 1,
  },
  catBadgeText: { fontSize: 9.5, fontWeight: '700' },
  groupBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
    backgroundColor: 'rgba(168,85,247,0.15)',
  },
  groupBadgeText: { color: '#A855F7', fontSize: 9.5, fontWeight: '800' },
  personalBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  personalBadgeText: { color: '#64748B', fontSize: 9.5, fontWeight: '600' },
  footer: { marginTop: 12 },
  importBtn: {
    backgroundColor: '#00E5FF',
    borderRadius: 14,
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  importBtnDisabled: { opacity: 0.4 },
  importBtnText: { color: '#06090F', fontSize: 14, fontWeight: '900' },
});
