import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  useFocusEffect,
  useNavigation,
  useRoute,
} from '@react-navigation/native';

import { supabase } from '../../config/supabase';
import {
  getGroupMembers,
  GroupMember,
} from '../../services/memberService';
import { getGroupSettlements, GroupSettlement } from '../../services/settlementService';

type Expense = {
  id: string;
  group_id: string;
  title?: string | null;
  amount?: number | string | null;
  split_type?: string | null;
  paid_by?: string | null;
  created_at?: string | null;
};

type ActivityItem =
  | { type: 'expense'; id: string; createdAt: string; expense: Expense }
  | { type: 'settlement'; id: string; createdAt: string; settlement: GroupSettlement };

type ActivityFilter = 'all' | 'expenses' | 'settlements';
type DateFilter = 'all' | 'today' | '7days' | '30days';

function money(value: number | string | null | undefined, currency = 'INR') {
  const amount = Number(value ?? 0);
  const symbolMap: Record<string, string> = {
    INR: '₹',
    USD: '$',
    EUR: '€',
    GBP: '£',
    JPY: '¥',
    AUD: 'A$',
    CAD: 'C$',
  };
  const prefix = symbolMap[currency] || `${currency} `;
  return `${prefix}${Number.isFinite(amount) ? amount.toFixed(2) : '0.00'}`;
}

function dateTimeLabel(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString([], {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function normalize(value?: string | null) {
  return value?.trim().toLowerCase() || '';
}

function memberName(member: GroupMember | undefined) {
  if (!member) return 'Member';
  const candidate = (member as GroupMember & { full_name?: string | null }).full_name;
  return candidate?.trim() || member.email?.trim() || 'Member';
}

function buildNameMap(members: GroupMember[]) {
  const map = new Map<string, string>();
  members.forEach((member) => {
    if (member.user_id) {
      map.set(member.user_id, memberName(member));
    }
  });
  return map;
}

function startOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
}

function dateFilterStart(filter: DateFilter) {
  const now = Date.now();
  if (filter === 'today') return startOfToday();
  if (filter === '7days') return now - 7 * 24 * 60 * 60 * 1000;
  if (filter === '30days') return now - 30 * 24 * 60 * 60 * 1000;
  return 0;
}

export default function HistoryScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const groupId = route.params?.groupId as string | undefined;
  const groupName = route.params?.groupName as string | undefined;

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [settlements, setSettlements] = useState<GroupSettlement[]>([]);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [currency, setCurrency] = useState('INR');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activityFilter, setActivityFilter] = useState<ActivityFilter>('all');
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const [search, setSearch] = useState('');

  const loadHistory = useCallback(async () => {
    if (!groupId) {
      setExpenses([]);
      setSettlements([]);
      setMembers([]);
      setLoading(false);
      return;
    }

    const [expenseResult, settlementResult, memberResult, groupResult] = await Promise.all([
      supabase
        .from('expenses')
        .select('id,group_id,title,amount,split_type,paid_by,created_at')
        .eq('group_id', groupId)
        .order('created_at', { ascending: false }),
      getGroupSettlements(groupId),
      getGroupMembers(groupId),
      supabase.from('groups').select('currency').eq('id', groupId).single(),
    ]);

    if (!expenseResult.error) setExpenses((expenseResult.data || []) as Expense[]);
    else console.log('Failed to load history expenses:', expenseResult.error.message);

    if (!settlementResult.error) setSettlements((settlementResult.data || []) as GroupSettlement[]);
    else console.log('Failed to load history settlements:', settlementResult.error.message);

    if (!memberResult.error) setMembers(memberResult.data || []);
    else console.log('Failed to load history members:', memberResult.error.message);

    if (!groupResult.error && groupResult.data?.currency) {
      setCurrency(groupResult.data.currency);
    }

    setLoading(false);
  }, [groupId]);

  useFocusEffect(
    useCallback(() => {
      loadHistory();
    }, [loadHistory])
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadHistory();
    setRefreshing(false);
  };

  const names = useMemo(() => buildNameMap(members), [members]);

  const items = useMemo<ActivityItem[]>(() => {
    const activity: ActivityItem[] = [];

    if (activityFilter !== 'settlements') {
      expenses.forEach((expense) => {
        activity.push({
          type: 'expense',
          id: `expense-${expense.id}`,
          createdAt: expense.created_at || '',
          expense,
        });
      });
    }

    if (activityFilter !== 'expenses') {
      settlements.forEach((settlement) => {
        activity.push({
          type: 'settlement',
          id: `settlement-${settlement.id}`,
          createdAt: settlement.created_at || '',
          settlement,
        });
      });
    }

    const query = normalize(search);
    const start = dateFilterStart(dateFilter);

    return activity
      .filter((item) => {
        const timestamp = new Date(item.createdAt).getTime();
        if (dateFilter !== 'all' && (Number.isNaN(timestamp) || timestamp < start)) {
          return false;
        }

        if (!query) return true;

        if (item.type === 'expense') {
          const payer = item.expense.paid_by ? names.get(item.expense.paid_by) || '' : '';
          return [
            item.expense.title,
            item.expense.split_type,
            payer,
          ].some((value) => normalize(value).includes(query));
        }

        const from = names.get(item.settlement.from_user_id) || '';
        const to = names.get(item.settlement.to_user_id) || '';
        return [from, to, item.settlement.note].some((value) =>
          normalize(value).includes(query)
        );
      })
      .sort((a, b) => {
        const aTime = new Date(a.createdAt).getTime();
        const bTime = new Date(b.createdAt).getTime();
        return bTime - aTime;
      });
  }, [activityFilter, dateFilter, expenses, names, search, settlements]);

  const openExpense = (expense: Expense) => {
    navigation.navigate('ExpenseDetails', {
      expenseId: expense.id,
      groupId: expense.group_id,
    });
  };

  const renderItem = ({ item }: { item: ActivityItem }) => {
    if (item.type === 'expense') {
      const payer = item.expense.paid_by
        ? names.get(item.expense.paid_by) || 'Member'
        : 'Member';

      return (
        <Pressable
          style={({ pressed }) => [styles.activityCard, pressed && styles.pressed]}
          onPress={() => openExpense(item.expense)}
        >
          <View style={styles.activityIcon}>
            <Ionicons name="receipt-outline" size={19} color="#0EA5A4" />
          </View>

          <View style={styles.activityInfo}>
            <Text style={styles.activityTitle} numberOfLines={1}>
              {item.expense.title?.trim() || 'Expense'}
            </Text>
            <Text style={styles.activityMeta} numberOfLines={2}>
              Paid by {payer}
              {'  •  '}
              {(item.expense.split_type || 'Equal').trim()}
              {'\n'}
              {dateTimeLabel(item.createdAt)}
            </Text>
          </View>

          <View style={styles.activityAmountWrap}>
            <Text style={styles.activityAmount}>
              {money(item.expense.amount, currency)}
            </Text>
            <Ionicons name="chevron-forward" size={17} color="#64748B" />
          </View>
        </Pressable>
      );
    }

    const from = names.get(item.settlement.from_user_id) || 'Member';
    const to = names.get(item.settlement.to_user_id) || 'Member';

    return (
      <View style={styles.activityCard}>
        <View style={[styles.activityIcon, styles.settlementIcon]}>
          <Ionicons name="checkmark-done-outline" size={19} color="#22C55E" />
        </View>

        <View style={styles.activityInfo}>
          <Text style={styles.activityTitle} numberOfLines={1}>
            {from} paid {to}
          </Text>
          <Text style={styles.activityMeta} numberOfLines={2}>
            {dateTimeLabel(item.createdAt)}
            {item.settlement.note?.trim()
              ? `\n${item.settlement.note.trim()}`
              : ''}
          </Text>
        </View>

        <Text style={styles.activityAmount}>
          {money(item.settlement.amount, currency)}
        </Text>
      </View>
    );
  };

  const activityFilters: Array<{ key: ActivityFilter; label: string }> = [
    { key: 'all', label: 'All' },
    { key: 'expenses', label: 'Expenses' },
    { key: 'settlements', label: 'Settlements' },
  ];

  const dateFilters: Array<{ key: DateFilter; label: string }> = [
    { key: 'all', label: 'All time' },
    { key: 'today', label: 'Today' },
    { key: '7days', label: '7 days' },
    { key: '30days', label: '30 days' },
  ];

  return (
    <>
      <StatusBar barStyle="light-content" backgroundColor="#0F172A" />
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom', 'left', 'right']}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Pressable style={styles.backButton} onPress={() => navigation.goBack()} hitSlop={10}>
              <Ionicons name="arrow-back" size={23} color="#FFFFFF" />
            </Pressable>
            <View style={styles.headerText}>
              <Text style={styles.title} numberOfLines={1}>History</Text>
              <Text style={styles.subtitle} numberOfLines={1}>{groupName || 'Group'}</Text>
            </View>
          </View>

          <View style={styles.searchBox}>
            <Ionicons name="search-outline" size={19} color="#64748B" />
            <TextInput
              style={styles.searchInput}
              value={search}
              onChangeText={setSearch}
              placeholder="Search expenses, people or notes"
              placeholderTextColor="#64748B"
              returnKeyType="search"
              clearButtonMode="never"
            />
            {search ? (
              <Pressable onPress={() => setSearch('')} hitSlop={8}>
                <Ionicons name="close-circle" size={19} color="#64748B" />
              </Pressable>
            ) : null}
          </View>

          <View style={styles.filterRow}>
            {activityFilters.map((filter) => (
              <Pressable
                key={filter.key}
                style={[styles.filterChip, activityFilter === filter.key && styles.filterChipActive]}
                onPress={() => setActivityFilter(filter.key)}
              >
                <Text style={[styles.filterText, activityFilter === filter.key && styles.filterTextActive]}>
                  {filter.label}
                </Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.dateFilterRow}>
            {dateFilters.map((filter) => (
              <Pressable
                key={filter.key}
                style={[styles.dateChip, dateFilter === filter.key && styles.dateChipActive]}
                onPress={() => setDateFilter(filter.key)}
              >
                <Text style={[styles.dateText, dateFilter === filter.key && styles.dateTextActive]}>
                  {filter.label}
                </Text>
              </Pressable>
            ))}
          </View>

          <FlatList
            data={items}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={items.length ? styles.listContent : styles.emptyListContent}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                tintColor="#0EA5A4"
              />
            }
            ListHeaderComponent={
              <View style={styles.resultsHeader}>
                <Text style={styles.resultsTitle}>Activity</Text>
                <Text style={styles.resultsCount}>
                  {items.length} {items.length === 1 ? 'item' : 'items'}
                </Text>
              </View>
            }
            ListEmptyComponent={
              loading ? (
                <View style={styles.emptyCard}>
                  <ActivityIndicator size="small" color="#0EA5A4" />
                  <Text style={styles.emptyText}>Loading history…</Text>
                </View>
              ) : (
                <View style={styles.emptyCard}>
                  <View style={styles.emptyIcon}>
                    <Ionicons name="time-outline" size={26} color="#0EA5A4" />
                  </View>
                  <Text style={styles.emptyTitle}>No activity found</Text>
                  <Text style={styles.emptyText}>
                    Try another search or filter, or add an expense to start building history.
                  </Text>
                </View>
              )
            }
          />
        </View>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#0F172A' },
  container: { flex: 1, backgroundColor: '#0F172A' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 16,
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
  headerText: { flex: 1 },
  title: { color: '#FFFFFF', fontSize: 25, fontWeight: '700' },
  subtitle: { color: '#94A3B8', fontSize: 13, marginTop: 4 },
  searchBox: {
    marginHorizontal: 20,
    minHeight: 48,
    borderRadius: 15,
    backgroundColor: '#1E293B',
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 14,
    marginLeft: 10,
    paddingVertical: 0,
  },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 8,
    gap: 8,
  },
  filterChip: {
    borderRadius: 11,
    paddingHorizontal: 13,
    paddingVertical: 9,
    backgroundColor: '#1E293B',
  },
  filterChipActive: { backgroundColor: '#0F766E' },
  filterText: { color: '#94A3B8', fontSize: 12, fontWeight: '700' },
  filterTextActive: { color: '#FFFFFF' },
  dateFilterRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 6,
    gap: 7,
  },
  dateChip: {
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: '#334155',
  },
  dateChipActive: { borderColor: '#0EA5A4', backgroundColor: '#0F172A' },
  dateText: { color: '#64748B', fontSize: 11, fontWeight: '600' },
  dateTextActive: { color: '#94A3B8' },
  listContent: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 40 },
  emptyListContent: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 40, flexGrow: 1 },
  resultsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 12,
  },
  resultsTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '700' },
  resultsCount: { color: '#64748B', fontSize: 12 },
  activityCard: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  pressed: { opacity: 0.78 },
  activityIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  settlementIcon: {},
  activityInfo: { flex: 1, minWidth: 0 },
  activityTitle: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  activityMeta: { color: '#64748B', fontSize: 11, lineHeight: 16, marginTop: 4 },
  activityAmountWrap: { flexDirection: 'row', alignItems: 'center', marginLeft: 8, gap: 5 },
  activityAmount: { color: '#FFFFFF', fontSize: 14, fontWeight: '800', marginLeft: 8 },
  emptyCard: {
    backgroundColor: '#1E293B',
    borderRadius: 18,
    padding: 28,
    alignItems: 'center',
    marginTop: 10,
  },
  emptyIcon: {
    width: 50,
    height: 50,
    borderRadius: 16,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emptyTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  emptyText: { color: '#64748B', fontSize: 12, textAlign: 'center', lineHeight: 18, marginTop: 7 },
});
