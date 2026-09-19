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
import { getGroupMembers, GroupMember } from '../../services/memberService';
import {
  ExpenseSplitRecord,
  getExpenseDetails,
  updateExpense,
} from '../../services/expenseService';
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

function money(value: number, currency: string) {
  return formatCurrency(value, currency);
}

function displayName(member: GroupMember) {
  return member.full_name?.trim() || member.email || 'Member';
}

function roundTo2(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function gcd(a: number, b: number): number {
  let x = Math.abs(Math.trunc(a));
  let y = Math.abs(Math.trunc(b));
  while (y !== 0) {
    const next = x % y;
    x = y;
    y = next;
  }
  return x;
}

function approximateShares(splits: ExpenseSplitRecord[]) {
  const amounts = splits.map((split) => Math.max(0, Number(split.amount ?? 0)));
  const total = amounts.reduce((sum, value) => sum + value, 0);

  if (amounts.length === 0) return [];
  if (total <= 0) return splits.map((split) => ({ userId: split.user_id, value: 1 }));

  let best: { values: number[]; error: number } | null = null;

  for (let totalShares = amounts.length; totalShares <= 100; totalShares += 1) {
    const raw = amounts.map((amount) => (amount / total) * totalShares);
    const values = raw.map((value) => Math.max(1, Math.floor(value)));

    let sum = values.reduce((acc, value) => acc + value, 0);
    const fractions = raw.map((value, index) => ({
      index,
      fraction: value - Math.floor(value),
    }));

    if (sum < totalShares) {
      fractions.sort((a, b) => b.fraction - a.fraction);
      let cursor = 0;
      while (sum < totalShares) {
        values[fractions[cursor % fractions.length].index] += 1;
        sum += 1;
        cursor += 1;
      }
    } else if (sum > totalShares) {
      fractions.sort((a, b) => a.fraction - b.fraction);
      let cursor = 0;
      while (sum > totalShares) {
        const index = fractions[cursor % fractions.length].index;
        if (values[index] > 1) {
          values[index] -= 1;
          sum -= 1;
        }
        cursor += 1;
        if (cursor > fractions.length * totalShares) break;
      }
    }

    const error = values.reduce((acc, value, index) => {
      const expected = raw[index];
      return acc + Math.pow(value - expected, 2);
    }, 0);

    if (!best || error < best.error) {
      best = { values, error };
    }
  }

  return splits.map((split, index) => ({
    userId: split.user_id,
    value: best?.values[index] || 1,
  }));
}

export default function EditExpenseScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();

  const expenseId = route.params?.expenseId as string | undefined;
  const groupId = route.params?.groupId as string | undefined;
  const groupName = route.params?.groupName as string | undefined;

  const [title, setTitle] = useState('');
  const [amountText, setAmountText] = useState('');
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [splitType, setSplitType] = useState<SplitType>('Equal');
  const [splitInputs, setSplitInputs] = useState<SplitInput[]>([]);
  const [payerId, setPayerId] = useState<string | null>(null);
  const [payerPickerVisible, setPayerPickerVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [valuesCustomized, setValuesCustomized] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currency, setCurrency] = useState('INR');

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!expenseId || !groupId) {
        if (!cancelled) setLoading(false);
        return;
      }

      setLoading(true);

      const [userResult, memberResult, detailResult, groupResult] = await Promise.all([
        supabase.auth.getUser(),
        getGroupMembers(groupId),
        getExpenseDetails(expenseId),
        supabase
          .from('groups')
          .select('id,owner_id,currency')
          .eq('id', groupId)
          .maybeSingle(),
      ]);

      if (cancelled) return;

      const user = userResult.data.user || null;
      const userId = user?.id || null;
      setCurrentUserId(userId);
      if (groupResult?.data?.currency) {
        setCurrency(groupResult.data.currency);
      }

      if (memberResult.error) {
        setLoading(false);
        Alert.alert('Unable to load members', memberResult.error.message);
        return;
      }

      if (detailResult.error || !detailResult.data) {
        setLoading(false);
        Alert.alert(
          'Unable to load expense',
          detailResult.error?.message || 'Expense not found.'
        );
        return;
      }

      const allLoadedMembers = (memberResult.data || []).filter(
        (member) => !!member.user_id
      );

      const activeMembers = allLoadedMembers.filter(
        (member) => member.status === 'active'
      );

      const ownerId = groupResult.data?.owner_id || null;
      const ownerAlreadyIncluded = ownerId
        ? activeMembers.some((member) => member.user_id === ownerId)
        : true;

      // Older groups can exist without an owner row in group_members.
      // Add the signed-in owner as a synthetic active member so the owner
      // always appears in both Participants and Paid by while editing.
      if (ownerId && !ownerAlreadyIncluded && ownerId === userId) {
        activeMembers.unshift({
          id: `owner-${ownerId}`,
          group_id: groupId,
          user_id: ownerId,
          email: user?.email || '',
          role: 'owner',
          status: 'active',
          full_name:
            typeof user?.user_metadata?.full_name === 'string'
              ? user.user_metadata.full_name
              : null,
        });
      }

      const detail = detailResult.data.expense;
      const storedSplits = detailResult.data.splits;
      const splitIds = storedSplits.map((split) => split.user_id);
      const activeIds = activeMembers.map((member) => member.user_id as string);
      const missingParticipant = splitIds.some(
        (splitId) => !activeIds.includes(splitId)
      );

      if (missingParticipant) {
        setLoading(false);
        Alert.alert(
          'Participant unavailable',
          'This expense includes someone who is no longer an active group member. Add them back to the group before editing this expense.'
        );
        navigation.goBack();
        return;
      }

      const ids = Array.from(new Set(splitIds));

      setMembers(activeMembers);
      setTitle(detail.title || '');
      setAmountText(Number(detail.amount).toFixed(2));
      setPayerId(detail.paid_by);
      setSelectedIds(ids);
      setSplitType(detail.split_type);

      let initialInputs: SplitInput[];

      if (detail.split_type === 'Equal') {
        initialInputs = buildDefaultInputs('Equal', Number(detail.amount), ids);
      } else if (detail.split_type === 'Exact') {
        initialInputs = storedSplits.map((split) => ({
          userId: split.user_id,
          value: roundTo2(Number(split.amount)),
        }));
      } else if (detail.split_type === 'Percentage') {
        const total = Number(detail.amount);
        const percentages: SplitInput[] = [];
        let used = 0;

        storedSplits.forEach((split, index) => {
          if (index === storedSplits.length - 1) {
            percentages.push({
              userId: split.user_id,
              value: roundTo2(Math.max(0, 100 - used)),
            });
          } else {
            const value = roundTo2((Number(split.amount) / total) * 100);
            percentages.push({ userId: split.user_id, value });
            used = roundTo2(used + value);
          }
        });

        initialInputs = percentages;
      } else {
        initialInputs = approximateShares(storedSplits);
      }

      setSplitInputs(initialInputs);
      setValuesCustomized(true);
      setLoading(false);
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [expenseId, groupId, navigation]);

  const amount = useMemo(() => {
    const normalized = amountText.replace(/,/g, '').trim();
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  }, [amountText]);

  const selectedMembers = useMemo(
    () => members.filter((member) => member.user_id && selectedIds.includes(member.user_id)),
    [members, selectedIds]
  );

  const payer = useMemo(
    () => members.find((member) => member.user_id === payerId) || null,
    [members, payerId]
  );

  const payerName = payer?.full_name?.trim() || payer?.email || 'Select member';

  const effectiveInputs = useMemo(() => {
    const byId = new Map(splitInputs.map((input) => [input.userId, input.value]));
    return selectedIds.map((userId) => ({
      userId,
      value: byId.get(userId) ?? (splitType === 'Shares' ? 1 : 0),
    }));
  }, [selectedIds, splitInputs, splitType]);

  const calculatedSplits = useMemo(
    () => calculateSplits(splitType, amount, effectiveInputs),
    [splitType, amount, effectiveInputs]
  );

  const splitError = useMemo(
    () => validateSplit(splitType, amount, effectiveInputs),
    [splitType, amount, effectiveInputs]
  );

  const total = useMemo(
    () => sharesTotal(calculatedSplits),
    [calculatedSplits]
  );

  useEffect(() => {
    if (!valuesCustomized || selectedIds.length === 0) return;
    if (splitType === 'Equal') return;
  }, [selectedIds, splitType, valuesCustomized]);

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
    const normalized =
      parts.length > 2
        ? `${parts[0]}.${parts.slice(1).join('').slice(0, 2)}`
        : cleaned;
    const decimalIndex = normalized.indexOf('.');
    const limited =
      decimalIndex >= 0 ? normalized.slice(0, decimalIndex + 3) : normalized;
    const value = limited ? Number(limited) : 0;

    setSplitInputs((current) =>
      current.map((input) =>
        input.userId === userId ? { ...input, value } : input
      )
    );
    setValuesCustomized(true);
  };

  const handleSave = async () => {
    const cleanTitle = title.trim();
    const normalizedAmount = amountText.replace(/,/g, '').trim();

    if (!expenseId || !groupId) {
      Alert.alert('Unable to save', 'Expense information is missing.');
      return;
    }

    if (!cleanTitle) {
      Alert.alert('Expense title required', 'Enter a title for this expense.');
      return;
    }

    if (cleanTitle.length > 120) {
      Alert.alert('Title too long', 'Keep the expense title within 120 characters.');
      return;
    }

    if (!/^\d+(\.\d{1,2})?$/.test(normalizedAmount) || amount <= 0) {
      Alert.alert('Invalid amount', 'Enter a valid amount with up to 2 decimal places.');
      return;
    }

    if (!currentUserId) {
      Alert.alert('Not signed in', 'Please sign in again and retry.');
      return;
    }

    if (!payerId || !members.some((member) => member.user_id === payerId)) {
      Alert.alert('Invalid payer', 'Choose an active group member as the payer.');
      return;
    }

    if (selectedIds.length === 0) {
      Alert.alert('Select members', 'Select at least one active group member for the split.');
      return;
    }

    if (splitError) {
      Alert.alert('Invalid split', splitError);
      return;
    }

    if (total !== Number(amount.toFixed(2))) {
      Alert.alert(
        'Split calculation error',
        'The split does not add up to the expense amount. Please try again.'
      );
      return;
    }

    setSaving(true);

    const { error } = await updateExpense({
      expenseId,
      groupId,
      title: cleanTitle,
      amount: Number(amount.toFixed(2)),
      paidBy: payerId,
      splitType,
      splits: effectiveInputs,
    });

    setSaving(false);

    if (error) {
      Alert.alert('Unable to update expense', error.message);
      return;
    }

    navigation.goBack();
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom', 'left', 'right']}>
        <StatusBar barStyle="light-content" backgroundColor="#0F172A" />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#0EA5A4" />
          <Text style={styles.loadingText}>Loading expense…</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom', 'left', 'right']}>
      <StatusBar barStyle="light-content" backgroundColor="#0F172A" />

      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable
            style={styles.backButton}
            onPress={() => navigation.goBack()}
            hitSlop={10}
          >
            <Ionicons name="arrow-back" size={23} color="#FFFFFF" />
          </Pressable>

          <View style={styles.headerText}>
            <Text style={styles.headerTitle}>Edit Expense</Text>
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
              editable={!saving}
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
                editable={!saving}
              />
            </View>
            <Text style={styles.helperText}>Group currency: {currency}</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>Paid by</Text>
            <Pressable
              style={styles.payerSelector}
              onPress={() => setPayerPickerVisible(true)}
              disabled={saving || members.length === 0}
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
                    style={[styles.splitOption, active && styles.splitOptionActive]}
                    onPress={() => changeSplitType(option.type)}
                    disabled={saving}
                  >
                    <Ionicons
                      name={option.icon}
                      size={17}
                      color={active ? '#FFFFFF' : '#94A3B8'}
                    />
                    <Text style={[styles.splitOptionText, active && styles.splitOptionTextActive]}>
                      {option.label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          <View style={styles.section}>
            <View style={styles.sectionLabelRow}>
              <View>
                <Text style={styles.label}>Participants</Text>
                <Text style={styles.helperText}>Choose who shares this expense.</Text>
              </View>
              <Text style={styles.countText}>{selectedMembers.length}</Text>
            </View>

            <View style={styles.participantCard}>
              {members.map((member) => {
                const userId = member.user_id as string;
                const selected = selectedIds.includes(userId);
                const input = effectiveInputs.find((item) => item.userId === userId);
                const calculated = calculatedSplits.find((share) => share.userId === userId)?.amount ?? 0;

                return (
                  <Pressable
                    key={userId}
                    style={[styles.memberRow, selected && styles.memberRowSelected]}
                    onPress={() => !saving && toggleMember(userId)}
                    disabled={saving}
                  >
                    <View style={[styles.checkbox, selected && styles.checkboxSelected]}>
                      {selected ? <Ionicons name="checkmark" size={15} color="#FFFFFF" /> : null}
                    </View>
                    <View style={styles.memberAvatar}>
                      <Text style={styles.memberAvatarText}>
                        {(member.full_name?.trim() || member.email || 'M').charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <View style={styles.memberInfo}>
                      <Text style={styles.memberName} numberOfLines={1}>
                        {member.full_name?.trim() || member.email || 'Member'}
                      </Text>
                      {selected ? (
                        splitType === 'Equal' ? (
                          <Text style={styles.calculatedText}>{money(calculated, currency)}</Text>
                        ) : (
                          <Text style={styles.calculatedText}>{money(calculated, currency)}</Text>
                        )
                      ) : null}
                    </View>
                    {selected && splitType !== 'Equal' && input ? (
                      <View style={styles.valueEditorContainer}>
                        <View style={styles.valueInputRow}>
                          {splitType === 'Exact' ? <Text style={styles.valuePrefix}>{getCurrencySymbol(currency)}</Text> : null}
                          <TextInput
                            value={String(input.value || 0)}
                            onChangeText={(text) => updateSplitValue(userId, text)}
                            keyboardType={splitType === 'Shares' ? 'number-pad' : 'decimal-pad'}
                            inputMode={splitType === 'Shares' ? 'numeric' : 'decimal'}
                            style={styles.valueInput}
                            selectTextOnFocus
                            maxLength={splitType === 'Shares' ? 4 : 10}
                            editable={!saving}
                          />
                          {splitType === 'Percentage' ? <Text style={styles.valueSuffix}>%</Text> : null}
                          {splitType === 'Shares' ? <Text style={styles.valueSuffix}>share</Text> : null}
                        </View>
                        <Text style={styles.calculatedText}>{money(calculated, currency)}</Text>
                      </View>
                    ) : null}
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Split total</Text>
              <Text style={styles.totalValue}>{money(total, currency)}</Text>
            </View>
          </View>

          <View style={styles.warningCard}>
            <Ionicons name="refresh-outline" size={18} color="#94A3B8" />
            <Text style={styles.warningText}>
              Saving will update the expense and recalculate balances automatically.
            </Text>
          </View>

          <Pressable
            style={[styles.saveButton, saving && styles.disabledButton]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Ionicons name="checkmark-circle-outline" size={19} color="#FFFFFF" />
            )}
            <Text style={styles.saveButtonText}>{saving ? 'Saving…' : 'Save Changes'}</Text>
          </Pressable>
        </ScrollView>

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
                keyboardShouldPersistTaps="handled"
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
                      disabled={saving}
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
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#0F172A' },
  container: { flex: 1, backgroundColor: '#0F172A' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  loadingText: { color: '#94A3B8', marginTop: 12, fontSize: 13 },
  header: { minHeight: 70, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center' },
  backButton: { width: 40, height: 40, borderRadius: 13, backgroundColor: '#1E293B', alignItems: 'center', justifyContent: 'center' },
  headerText: { flex: 1, paddingHorizontal: 12 },
  headerTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '800' },
  headerSubtitle: { color: '#64748B', fontSize: 11, marginTop: 3 },
  content: { padding: 18, paddingBottom: 36 },
  section: { marginBottom: 18 },
  label: { color: '#CBD5E1', fontSize: 12, fontWeight: '800', marginBottom: 8 },
  helperText: { color: '#64748B', fontSize: 11, marginTop: 5 },
  input: { backgroundColor: '#1E293B', borderRadius: 14, minHeight: 50, paddingHorizontal: 14, color: '#FFFFFF', fontSize: 15, borderWidth: 1, borderColor: '#334155' },
  amountInputWrapper: { backgroundColor: '#1E293B', borderRadius: 14, minHeight: 52, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#334155' },
  currency: { color: '#94A3B8', fontSize: 20, fontWeight: '800', marginRight: 8 },
  amountInput: { flex: 1, color: '#FFFFFF', fontSize: 18, fontWeight: '800' },
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
  splitSelector: { gap: 8, paddingVertical: 2 },
  splitOption: { minHeight: 42, borderRadius: 13, borderWidth: 1, borderColor: '#334155', paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: '#1E293B' },
  splitOptionActive: { backgroundColor: '#0EA5A4', borderColor: '#0EA5A4' },
  splitOptionText: { color: '#94A3B8', fontSize: 12, fontWeight: '700' },
  splitOptionTextActive: { color: '#FFFFFF' },
  sectionLabelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  countText: { color: '#0EA5A4', fontSize: 13, fontWeight: '900' },
  participantCard: { backgroundColor: '#1E293B', borderRadius: 18, padding: 7, marginTop: 10 },
  memberRow: { minHeight: 63, borderRadius: 13, paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center' },
  memberRowSelected: { backgroundColor: '#172438' },
  checkbox: { width: 23, height: 23, borderRadius: 8, borderWidth: 1.5, borderColor: '#475569', alignItems: 'center', justifyContent: 'center', marginRight: 9 },
  checkboxSelected: { backgroundColor: '#0EA5A4', borderColor: '#0EA5A4' },
  memberAvatar: { width: 34, height: 34, borderRadius: 12, backgroundColor: '#0F172A', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  memberAvatarText: { color: '#0EA5A4', fontSize: 12, fontWeight: '900' },
  memberInfo: { flex: 1, minWidth: 0 },
  memberName: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  calculatedText: { color: '#94A3B8', fontSize: 10, marginTop: 3 },
  valueEditorContainer: { alignItems: 'flex-end', marginLeft: 7 },
  valueInputRow: { minWidth: 92, minHeight: 34, borderRadius: 10, backgroundColor: '#0F172A', borderWidth: 1, borderColor: '#334155', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8 },
  valuePrefix: { color: '#64748B', fontSize: 11, fontWeight: '700' },
  valueInput: { color: '#FFFFFF', minWidth: 52, textAlign: 'right', fontSize: 12, fontWeight: '800', paddingVertical: 0 },
  valueSuffix: { color: '#64748B', fontSize: 10, marginLeft: 4 },
  totalRow: { marginTop: 9, paddingHorizontal: 5, flexDirection: 'row', justifyContent: 'space-between' },
  totalLabel: { color: '#64748B', fontSize: 11, fontWeight: '700' },
  totalValue: { color: '#FFFFFF', fontSize: 13, fontWeight: '900' },
  warningCard: { backgroundColor: '#111C2F', borderRadius: 15, padding: 14, flexDirection: 'row', gap: 9, marginBottom: 16 },
  warningText: { flex: 1, color: '#64748B', fontSize: 11, lineHeight: 16 },
  saveButton: { minHeight: 52, borderRadius: 15, backgroundColor: '#0EA5A4', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  saveButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' },
  disabledButton: { opacity: 0.65 },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.58)',
  },
  modalDismissArea: { flex: 1 },
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
  modalTitle: { color: '#FFFFFF', fontSize: 21, fontWeight: '800' },
  modalSubtitle: { color: '#64748B', fontSize: 12, lineHeight: 18, marginTop: 4, maxWidth: 280 },
  modalCloseButton: {
    width: 38, height: 38, borderRadius: 13, backgroundColor: '#1E293B',
    alignItems: 'center', justifyContent: 'center',
  },
  payerList: { gap: 9, paddingTop: 4, paddingBottom: 8 },
  payerRow: {
    minHeight: 62, borderRadius: 17, backgroundColor: '#1E293B',
    paddingHorizontal: 12, paddingVertical: 10, flexDirection: 'row', alignItems: 'center',
  },
  payerRowSelected: { borderWidth: 1, borderColor: '#0EA5A4' },
  avatar: { width: 38, height: 38, borderRadius: 13, backgroundColor: '#0F172A', alignItems: 'center', justifyContent: 'center', marginRight: 11 },
  avatarText: { color: '#0EA5A4', fontSize: 13, fontWeight: '900' },
  memberMeta: { color: '#64748B', fontSize: 11, marginTop: 3 },
  payerCheck: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#0EA5A4', alignItems: 'center', justifyContent: 'center' },
  payerEmptyCheck: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: '#475569' },

});