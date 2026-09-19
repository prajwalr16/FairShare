import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';

import { supabase } from '../../config/supabase';
import { formatCurrency, getCurrencySymbol } from '../../utils/currency';
import {
  getGroupMembers,
  GroupMember,
} from '../../services/memberService';
import { createExpense } from '../../services/expenseService';
import {
  buildDefaultInputs,
  calculateSplits,
  sharesTotal,
  SplitInput,
  SplitType,
  validateSplit,
} from '../../utils/expenseCalculation';

const SPLIT_OPTIONS: Array<{
  type: SplitType;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}> = [
  { type: 'Equal', label: 'Equal', icon: 'people-outline' },
  { type: 'Exact', label: 'Exact', icon: 'cash-outline' },
  { type: 'Percentage', label: '%', icon: 'pie-chart-outline' },
  { type: 'Shares', label: 'Shares', icon: 'grid-outline' },
];

export default function AddExpenseScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();

  const groupId = route.params?.groupId as string | undefined;
  const groupName = route.params?.groupName as string | undefined;

  const [title, setTitle] = useState('');
  const [amountText, setAmountText] = useState('');
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [splitType, setSplitType] = useState<SplitType>('Equal');
  const [splitInputs, setSplitInputs] = useState<SplitInput[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [payerId, setPayerId] = useState<string | null>(null);
  const [payerPickerVisible, setPayerPickerVisible] = useState(false);
  const [currency, setCurrency] = useState('INR');
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [saving, setSaving] = useState(false);
  const [valuesCustomized, setValuesCustomized] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoadingMembers(true);

      if (!groupId) {
        if (!cancelled) {
          setMembers([]);
          setSelectedIds([]);
          setSplitInputs([]);
          setCurrentUserId(null);
          setPayerId(null);
          setCurrency('INR');
          setLoadingMembers(false);
        }
        return;
      }

      const [userResult, memberResult, groupResult] = await Promise.all([
        supabase.auth.getUser(),
        getGroupMembers(groupId),
        supabase.from('groups').select('currency').eq('id', groupId).maybeSingle(),
      ]);

      if (cancelled) return;

      const userId = userResult.data.user?.id || null;
      setCurrentUserId(userId);
      if (groupResult?.data?.currency) {
        setCurrency(groupResult.data.currency);
      }
      setPayerId(userId);

      if (memberResult.error) {
        setMembers([]);
        setSelectedIds([]);
        setSplitInputs([]);
        setLoadingMembers(false);
        Alert.alert(
          'Unable to load members',
          memberResult.error.message
        );
        return;
      }

      const activeMembers = (memberResult.data || []).filter(
        (member) => member.status === 'active' && !!member.user_id
      );

      const ids = activeMembers
        .map((member) => member.user_id as string)
        .filter(Boolean);

      setMembers(activeMembers);
      setSelectedIds(ids);
      setSplitInputs(buildDefaultInputs(splitType, 0, ids));
      setValuesCustomized(false);
      setLoadingMembers(false);
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [groupId]);

  const amount = useMemo(() => {
    const normalized = amountText.replace(/,/g, '').trim();
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  }, [amountText]);

  const selectedMembers = useMemo(
    () =>
      members.filter(
        (member) =>
          !!member.user_id && selectedIds.includes(member.user_id)
      ),
    [members, selectedIds]
  );

  const payer = useMemo(
    () =>
      members.find((member) => member.user_id === payerId) || null,
    [members, payerId]
  );

  const payerName = useMemo(() => {
    if (!payer) {
      return currentUserId ? 'You' : 'Select member';
    }
    return payer.full_name?.trim() || payer.email || 'Member';
  }, [currentUserId, payer]);

  const effectiveInputs = useMemo(() => {
    const byId = new Map(
      splitInputs.map((input) => [input.userId, input.value])
    );

    return selectedIds.map((userId) => ({
      userId,
      value: byId.get(userId) ?? (splitType === 'Shares' ? 1 : 0),
    }));
  }, [selectedIds, splitInputs, splitType]);

  const calculatedSplits = useMemo(
    () => calculateSplits(splitType, amount, effectiveInputs),
    [splitType, amount, effectiveInputs]
  );

  const sharesByUserId = useMemo(
    () =>
      Object.fromEntries(
        calculatedSplits.map((share) => [share.userId, share.amount])
      ) as Record<string, number>,
    [calculatedSplits]
  );

  const splitError = useMemo(
    () => validateSplit(splitType, amount, effectiveInputs),
    [splitType, amount, effectiveInputs]
  );

  const selectedTotal = useMemo(
    () => sharesTotal(calculatedSplits),
    [calculatedSplits]
  );

  useEffect(() => {
    if (valuesCustomized || selectedIds.length === 0) {
      return;
    }

    setSplitInputs(buildDefaultInputs(splitType, amount, selectedIds));
  }, [amount, selectedIds, splitType, valuesCustomized]);

  const toggleMember = (userId: string) => {
    setSelectedIds((current) => {
      const next = current.includes(userId)
        ? current.filter((id) => id !== userId)
        : [...current, userId];

      setSplitInputs(buildDefaultInputs(splitType, amount, next));
      setValuesCustomized(false);
      return next;
    });
  };

  const changeSplitType = (type: SplitType) => {
    setSplitType(type);
    setSplitInputs(buildDefaultInputs(type, amount, selectedIds));
    setValuesCustomized(false);
  };

  const updateSplitValue = (userId: string, text: string) => {
    if (splitType === 'Shares') {
      const cleaned = text.replace(/[^0-9]/g, '');
      const value = cleaned ? Number(cleaned) : 0;

      setSplitInputs((current) =>
        current.map((input) =>
          input.userId === userId ? { ...input, value } : input
        )
      );
      setValuesCustomized(true);
      return;
    }

    const cleaned = text.replace(/[^0-9.]/g, '');
    const parts = cleaned.split('.');
    const normalized = parts.length > 2
      ? `${parts[0]}.${parts.slice(1).join('').slice(0, 2)}`
      : cleaned;
    const decimalIndex = normalized.indexOf('.');
    const limited =
      decimalIndex >= 0
        ? normalized.slice(0, decimalIndex + 3)
        : normalized;
    const value = limited ? Number(limited) : 0;

    setSplitInputs((current) =>
      current.map((input) =>
        input.userId === userId ? { ...input, value } : input
      )
    );
    setValuesCustomized(true);
  };

  const validateAmount = () => {
    const normalized = amountText.replace(/,/g, '').trim();

    if (!normalized) {
      return 'Enter an expense amount.';
    }

    if (!/^\d+(\.\d{1,2})?$/.test(normalized)) {
      return 'Enter a valid amount with up to 2 decimal places.';
    }

    if (amount <= 0) {
      return 'Amount must be greater than 0.';
    }

    return null;
  };

  const handleSave = async () => {
    const cleanTitle = title.trim();
    const amountError = validateAmount();

    if (!groupId) {
      Alert.alert('Unable to save', 'Group information is missing.');
      return;
    }

    if (!cleanTitle) {
      Alert.alert('Expense title required', 'Enter a title for this expense.');
      return;
    }

    if (cleanTitle.length > 120) {
      Alert.alert(
        'Title too long',
        'Keep the expense title within 120 characters.'
      );
      return;
    }

    if (amountError) {
      Alert.alert('Invalid amount', amountError);
      return;
    }

    if (!currentUserId) {
      Alert.alert('Not signed in', 'Please sign in again and retry.');
      return;
    }

    if (!payerId) {
      Alert.alert('Select payer', 'Choose which group member paid this expense.');
      return;
    }

    if (!members.some((member) => member.user_id === payerId)) {
      Alert.alert(
        'Invalid payer',
        'The selected payer is not an active member of this group.'
      );
      return;
    }

    if (selectedIds.length === 0) {
      Alert.alert(
        'Select members',
        'Select at least one active group member for the split.'
      );
      return;
    }

    if (splitError) {
      Alert.alert('Invalid split', splitError);
      return;
    }

    const total = selectedTotal;
    if (total !== Number(amount.toFixed(2))) {
      Alert.alert(
        'Split calculation error',
        'The split does not add up to the expense amount. Please try again.'
      );
      return;
    }

    setSaving(true);

    const { error } = await createExpense({
      groupId,
      title: cleanTitle,
      amount: Number(amount.toFixed(2)),
      paidBy: payerId,
      splitType,
      splits: effectiveInputs,
    });

    setSaving(false);

    if (error) {
      console.log(`Failed to create ${splitType} expense:`, error.message);
      Alert.alert('Unable to save expense', error.message);
      return;
    }

    navigation.goBack();
  };

  const displayName = (member: GroupMember) =>
    member.full_name?.trim() || member.email || 'Member';

  const renderValueEditor = (member: GroupMember) => {
    const userId = member.user_id as string;
    const input = effectiveInputs.find((item) => item.userId === userId);
    const amountValue = sharesByUserId[userId] ?? 0;

    if (!input) return null;

    if (splitType === 'Equal') {
      return (
        <Text style={styles.shareAmount}>
          {formatCurrency(amountValue, currency)}
        </Text>
      );
    }

    return (
      <View style={styles.valueEditorContainer}>
        <View style={styles.valueInputRow}>
          {splitType === 'Exact' ? (
            <Text style={styles.valuePrefix}>{getCurrencySymbol(currency)}</Text>
          ) : null}

          <TextInput
            value={String(input.value || 0)}
            onChangeText={(text) => updateSplitValue(userId, text)}
            keyboardType={splitType === 'Shares' ? 'number-pad' : 'decimal-pad'}
            inputMode={splitType === 'Shares' ? 'numeric' : 'decimal'}
            style={styles.valueInput}
            selectTextOnFocus
            maxLength={splitType === 'Shares' ? 4 : 10}
          />

          {splitType === 'Percentage' ? (
            <Text style={styles.valueSuffix}>%</Text>
          ) : null}

          {splitType === 'Shares' ? (
            <Text style={styles.valueSuffix}>share</Text>
          ) : null}
        </View>

        <Text style={styles.calculatedAmount}>
          {formatCurrency(amountValue, currency)}
        </Text>
      </View>
    );
  };

  return (
    <>
      <StatusBar barStyle="light-content" backgroundColor="#0F172A" />

      <SafeAreaView
        style={styles.safeArea}
        edges={['top', 'bottom', 'left', 'right']}
      >
        <View style={styles.container}>
          <View style={styles.header}>
            <Pressable
              style={styles.backButton}
              onPress={() => navigation.goBack()}
              hitSlop={10}
            >
              <Ionicons name="arrow-back" size={23} color="#FFFFFF" />
            </Pressable>

            <View style={styles.headerTextContainer}>
              <Text style={styles.headerTitle}>Add Expense</Text>
              <Text style={styles.headerSubtitle} numberOfLines={1}>
                {groupName || 'Group'}
              </Text>
            </View>
          </View>

          <ScrollView
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.section}>
              <Text style={styles.label}>Expense title</Text>
              <TextInput
                value={title}
                onChangeText={setTitle}
                placeholder="e.g. Dinner at the hotel"
                placeholderTextColor="#64748B"
                style={styles.input}
                maxLength={120}
                returnKeyType="next"
              />
            </View>

            <View style={styles.section}>
              <Text style={styles.label}>Amount</Text>
              <View style={styles.amountInputWrapper}>
                <Text style={styles.currency}>{getCurrencySymbol(currency)}</Text>
                <TextInput
                  value={amountText}
                  onChangeText={setAmountText}
                  placeholder="0.00"
                  placeholderTextColor="#64748B"
                  style={styles.amountInput}
                  keyboardType="decimal-pad"
                  inputMode="decimal"
                />
              </View>
              <Text style={styles.helperText}>Group currency: {currency}</Text>
            </View>

            <View style={styles.section}>
              <Text style={styles.label}>Paid by</Text>
              <Pressable
                style={styles.payerSelector}
                onPress={() => setPayerPickerVisible(true)}
                disabled={loadingMembers || members.length === 0}
              >
                <View style={styles.payerSelectorIcon}>
                  <Ionicons name="wallet-outline" size={20} color="#0EA5A4" />
                </View>
                <View style={styles.payerSelectorInfo}>
                  <Text style={styles.payerSelectorName} numberOfLines={1}>
                    {payerName}
                  </Text>
                  <Text style={styles.payerSelectorMeta}>
                    {payerId === currentUserId
                      ? 'You paid this expense'
                      : 'Another group member paid this expense'}
                  </Text>
                </View>
                <Ionicons name="chevron-down" size={20} color="#94A3B8" />
              </Pressable>
              <Text style={styles.helperText}>
                The payer can be different from the people sharing the expense.
              </Text>
            </View>

            <View style={styles.section}>
              <Text style={styles.label}>Split type</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.splitSelector}
              >
                {SPLIT_OPTIONS.map((option) => {
                  const active = splitType === option.type;

                  return (
                    <Pressable
                      key={option.type}
                      onPress={() => changeSplitType(option.type)}
                      style={[
                        styles.splitOption,
                        active && styles.splitOptionActive,
                      ]}
                    >
                      <Ionicons
                        name={option.icon}
                        size={17}
                        color={active ? '#FFFFFF' : '#94A3B8'}
                      />
                      <Text
                        style={[
                          styles.splitOptionText,
                          active && styles.splitOptionTextActive,
                        ]}
                      >
                        {option.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
              <Text style={styles.helperText}>
                {splitType === 'Equal'
                  ? 'Everyone selected shares the expense equally.'
                  : splitType === 'Exact'
                    ? 'Enter the exact amount each person owes.'
                    : splitType === 'Percentage'
                      ? 'Enter each person’s percentage. Total must be 100%.'
                      : 'Assign whole-number shares to each person.'}
              </Text>
            </View>

            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <View style={styles.sectionHeaderText}>
                  <Text style={styles.label}>Participants</Text>
                  <Text style={styles.helperText}>
                    Select the active members who should share this expense.
                  </Text>
                </View>
                <View style={styles.countBadge}>
                  <Text style={styles.countBadgeText}>
                    {selectedIds.length}
                  </Text>
                </View>
              </View>

              {loadingMembers ? (
                <View style={styles.loadingCard}>
                  <ActivityIndicator color="#0EA5A4" />
                  <Text style={styles.loadingText}>Loading members…</Text>
                </View>
              ) : members.length === 0 ? (
                <View style={styles.emptyCard}>
                  <Ionicons
                    name="people-outline"
                    size={25}
                    color="#0EA5A4"
                  />
                  <Text style={styles.emptyTitle}>
                    No active members found
                  </Text>
                  <Text style={styles.emptyText}>
                    Add or accept group members before creating an expense.
                  </Text>
                </View>
              ) : (
                <View style={styles.memberList}>
                  {members.map((member) => {
                    const userId = member.user_id as string;
                    const selected = selectedIds.includes(userId);
                    const isCurrentUser = userId === currentUserId;

                    return (
                      <View
                        key={member.id}
                        style={[
                          styles.memberRow,
                          selected && styles.memberRowSelected,
                        ]}
                      >
                        <Pressable
                          style={styles.memberMain}
                          onPress={() => toggleMember(userId)}
                        >
                          <View style={styles.avatar}>
                            <Text style={styles.avatarText}>
                              {displayName(member).charAt(0).toUpperCase()}
                            </Text>
                          </View>

                          <View style={styles.memberInfo}>
                            <Text style={styles.memberName} numberOfLines={1}>
                              {displayName(member)}
                            </Text>
                            <Text style={styles.memberMeta}>
                              {isCurrentUser
                                ? 'You'
                                : member.role === 'owner'
                                  ? 'Owner'
                                  : 'Member'}
                            </Text>
                          </View>

                          <View
                            style={[
                              styles.checkCircle,
                              selected && styles.checkCircleSelected,
                            ]}
                          >
                            {selected ? (
                              <Ionicons
                                name="checkmark"
                                size={16}
                                color="#FFFFFF"
                              />
                            ) : null}
                          </View>
                        </Pressable>

                        {selected ? renderValueEditor(member) : null}
                      </View>
                    );
                  })}
                </View>
              )}
            </View>

            <View style={styles.summaryCard}>
              <View style={styles.summaryTextWrap}>
                <Text style={styles.summaryLabel}>
                  {selectedMembers.length}{' '}
                  {selectedMembers.length === 1 ? 'person' : 'people'}
                </Text>
                <Text style={styles.summaryTitle}>
                  {splitType} split
                </Text>
                <Text
                  style={[
                    styles.summaryStatus,
                    splitError ? styles.summaryStatusError : null,
                  ]}
                >
                  {splitError || `Total: ${formatCurrency(selectedTotal, currency)}`}
                </Text>
              </View>

              <Text style={styles.summaryAmount}>
                {formatCurrency(amount, currency)}
              </Text>
            </View>

            <Pressable
              style={[
                styles.saveButton,
                (saving || loadingMembers || !!splitError) &&
                  styles.saveButtonDisabled,
              ]}
              onPress={handleSave}
              disabled={saving || loadingMembers || !!splitError}
            >
              {saving ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons
                    name="checkmark-circle-outline"
                    size={21}
                    color="#FFFFFF"
                  />
                  <Text style={styles.saveButtonText}>Save Expense</Text>
                </>
              )}
            </Pressable>
          </ScrollView>
        </View>
      </SafeAreaView>

      <Modal
        visible={payerPickerVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setPayerPickerVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <Pressable
            style={styles.modalDismissArea}
            onPress={() => setPayerPickerVisible(false)}
          />
          <View style={styles.payerModalCard}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Paid by</Text>
                <Text style={styles.modalSubtitle}>
                  Select the active member who paid this expense.
                </Text>
              </View>
              <Pressable
                style={styles.modalCloseButton}
                onPress={() => setPayerPickerVisible(false)}
              >
                <Ionicons name="close" size={20} color="#CBD5E1" />
              </Pressable>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.payerList}
            >
              {members.map((member) => {
                const userId = member.user_id as string;
                const selected = userId === payerId;

                return (
                  <Pressable
                    key={member.id}
                    style={[
                      styles.payerRow,
                      selected && styles.payerRowSelected,
                    ]}
                    onPress={() => {
                      setPayerId(userId);
                      setPayerPickerVisible(false);
                    }}
                  >
                    <View style={styles.avatar}>
                      <Text style={styles.avatarText}>
                        {displayName(member).charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <View style={styles.memberInfo}>
                      <Text style={styles.memberName} numberOfLines={1}>
                        {displayName(member)}
                      </Text>
                      <Text style={styles.memberMeta}>
                        {userId === currentUserId
                          ? 'You'
                          : member.role === 'owner'
                            ? 'Owner'
                            : 'Member'}
                      </Text>
                    </View>
                    {selected ? (
                      <View style={styles.payerCheck}>
                        <Ionicons name="checkmark" size={17} color="#FFFFFF" />
                      </View>
                    ) : (
                      <View style={styles.payerEmptyCheck} />
                    )}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 18,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  headerTextContainer: {
    flex: 1,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 25,
    fontWeight: '700',
  },
  headerSubtitle: {
    color: '#94A3B8',
    fontSize: 14,
    marginTop: 4,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  section: {
    marginBottom: 22,
  },
  label: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 9,
  },
  input: {
    minHeight: 54,
    backgroundColor: '#1E293B',
    borderRadius: 16,
    paddingHorizontal: 16,
    color: '#FFFFFF',
    fontSize: 16,
  },
  amountInputWrapper: {
    minHeight: 64,
    backgroundColor: '#1E293B',
    borderRadius: 18,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
  },
  currency: {
    color: '#0EA5A4',
    fontSize: 28,
    fontWeight: '800',
    marginRight: 8,
  },
  amountInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '700',
    paddingVertical: 10,
  },
  helperText: {
    color: '#64748B',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 7,
  },
  payerSelector: {
    minHeight: 72,
    borderRadius: 18,
    backgroundColor: '#1E293B',
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  payerSelectorIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 11,
  },
  payerSelectorInfo: {
    flex: 1,
    minWidth: 0,
    marginRight: 10,
  },
  payerSelectorName: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  payerSelectorMeta: {
    color: '#64748B',
    fontSize: 12,
    marginTop: 3,
  },
  splitSelector: {
    gap: 9,
    paddingBottom: 1,
  },
  splitOption: {
    minHeight: 44,
    borderRadius: 14,
    backgroundColor: '#1E293B',
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  splitOptionActive: {
    backgroundColor: '#0EA5A4',
    borderColor: '#0EA5A4',
  },
  splitOptionText: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '700',
  },
  splitOptionTextActive: {
    color: '#FFFFFF',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sectionHeaderText: {
    flex: 1,
    paddingRight: 12,
  },
  countBadge: {
    minWidth: 32,
    height: 32,
    paddingHorizontal: 8,
    borderRadius: 12,
    backgroundColor: '#0EA5A4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  countBadgeText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  memberList: {
    gap: 10,
  },
  memberRow: {
    borderRadius: 18,
    backgroundColor: '#1E293B',
    padding: 12,
  },
  memberRowSelected: {
    borderWidth: 1,
    borderColor: '#0EA5A4',
  },
  memberMain: {
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 11,
  },
  avatarText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 17,
  },
  memberInfo: {
    flex: 1,
    minWidth: 0,
  },
  memberName: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  memberMeta: {
    color: '#64748B',
    fontSize: 12,
    marginTop: 3,
  },
  shareAmount: {
    color: '#CBD5E1',
    fontSize: 14,
    fontWeight: '700',
    marginLeft: 8,
  },
  checkCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: '#475569',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkCircleSelected: {
    backgroundColor: '#0EA5A4',
    borderColor: '#0EA5A4',
  },
  valueEditorContainer: {
    marginTop: 11,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#334155',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  valueInputRow: {
    minHeight: 42,
    minWidth: 120,
    borderRadius: 12,
    backgroundColor: '#0F172A',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 11,
  },
  valuePrefix: {
    color: '#0EA5A4',
    fontSize: 15,
    fontWeight: '800',
    marginRight: 5,
  },
  valueInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    paddingVertical: 7,
    minWidth: 55,
  },
  valueSuffix: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 4,
  },
  calculatedAmount: {
    color: '#CBD5E1',
    fontSize: 14,
    fontWeight: '800',
    marginLeft: 12,
  },
  loadingCard: {
    minHeight: 94,
    borderRadius: 18,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
  },
  loadingText: {
    color: '#94A3B8',
    fontSize: 13,
  },
  emptyCard: {
    borderRadius: 18,
    backgroundColor: '#1E293B',
    padding: 22,
    alignItems: 'center',
  },
  emptyTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    marginTop: 9,
  },
  emptyText: {
    color: '#94A3B8',
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    marginTop: 6,
  },
  summaryCard: {
    minHeight: 94,
    borderRadius: 18,
    backgroundColor: '#1E293B',
    paddingHorizontal: 16,
    paddingVertical: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  summaryTextWrap: {
    flex: 1,
    paddingRight: 12,
  },
  summaryLabel: {
    color: '#64748B',
    fontSize: 12,
  },
  summaryTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    marginTop: 3,
  },
  summaryStatus: {
    color: '#94A3B8',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
  },
  summaryStatusError: {
    color: '#F87171',
  },
  summaryAmount: {
    color: '#0EA5A4',
    fontSize: 18,
    fontWeight: '800',
  },
  saveButton: {
    minHeight: 56,
    borderRadius: 17,
    backgroundColor: '#0EA5A4',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.58)',
  },
  modalDismissArea: {
    flex: 1,
  },
  payerModalCard: {
    maxHeight: '75%',
    backgroundColor: '#0F172A',
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 28,
  },
  modalHandle: {
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
    marginBottom: 12,
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
    maxWidth: 280,
  },
  modalCloseButton: {
    width: 38,
    height: 38,
    borderRadius: 13,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  payerList: {
    gap: 9,
    paddingTop: 4,
    paddingBottom: 8,
  },
  payerRow: {
    minHeight: 62,
    borderRadius: 17,
    backgroundColor: '#1E293B',
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  payerRowSelected: {
    borderWidth: 1,
    borderColor: '#0EA5A4',
  },
  payerCheck: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#0EA5A4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  payerEmptyCheck: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#475569',
  },
});