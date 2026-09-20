import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
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
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';

import ExpenseCard from '../../components/ExpenseCard';
import { getGroupExpenses } from '../../services/expenseService';
import { getGroupMembers, GroupMember } from '../../services/memberService';
import { getGroupSettlements, GroupSettlement } from '../../services/settlementService';
import { getGroupSettings } from '../../services/groupService';
import { formatCurrency } from '../../utils/currency';
import { EXPENSE_CATEGORIES, EXPENSE_CATEGORY_ICONS, ExpenseCategory } from '../../constants/expenseCategories';

type Filter = 'All' | 'Expenses' | 'Settlements';
type Range = 'All time' | 'Today' | '7 days' | '30 days';

function withinRange(dateValue: string, range: Range) {
  if (range === 'All time') return true;
  const date = new Date(dateValue);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  if (range === 'Today') {
    return date.toDateString() === now.toDateString();
  }
  const days = range === '7 days' ? 7 : 30;
  return diffMs >= 0 && diffMs <= days * 24 * 60 * 60 * 1000;
}

export default function HistoryScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const groupId = route.params?.groupId as string | undefined;

  const [filter, setFilter] = useState<Filter>('All');
  const [range, setRange] = useState<Range>('All time');
  const [query, setQuery] = useState('');
  const [currency, setCurrency] = useState('INR');
  const [expenses, setExpenses] = useState<any[]>([]);
  const [settlements, setSettlements] = useState<GroupSettlement[]>([]);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [expenseCategory, setExpenseCategory] = useState<ExpenseCategory | 'All'>('All');
  const [expenseScope, setExpenseScope] = useState<'all' | 'mine'>('all');

  const load = useCallback(async () => {
    if (!groupId) return;
    setLoading(true);
    const [settings, expenseResult, settlementResult, memberResult] = await Promise.all([
      getGroupSettings(groupId),
      getGroupExpenses(groupId, 200, expenseCategory, expenseScope),
      getGroupSettlements(groupId),
      getGroupMembers(groupId),
    ]);

    if (settings.data?.currency) setCurrency(settings.data.currency);
    setExpenses(expenseResult.data || []);
    setSettlements(settlementResult.data || []);
    setMembers(memberResult.data || []);
    setLoading(false);
  }, [groupId, expenseCategory, expenseScope]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const names = useMemo(() => {
    const map = new Map<string, string>();
    members.forEach((member) => {
      if (member.user_id) {
        map.set(
          member.user_id,
          member.full_name?.trim() || member.email || 'Member',
        );
      }
    });
    return map;
  }, [members]);

  const normalizedQuery = query.trim().toLowerCase();

  const visibleExpenses = useMemo(
    () =>
      expenses.filter((expense) => {
        if (!withinRange(expense.created_at, range)) return false;
        if (!normalizedQuery) return true;
        const payer = names.get(expense.paid_by) || '';
        return `${expense.title} ${payer} ${expense.split_type}`
          .toLowerCase()
          .includes(normalizedQuery);
      }),
    [expenses, names, normalizedQuery, range],
  );

  const visibleSettlements = useMemo(
    () =>
      settlements.filter((settlement) => {
        if (!withinRange(settlement.created_at, range)) return false;
        if (!normalizedQuery) return true;
        const from = names.get(settlement.from_user_id) || '';
        const to = names.get(settlement.to_user_id) || '';
        return `${from} ${to} ${settlement.note || ''}`
          .toLowerCase()
          .includes(normalizedQuery);
      }),
    [settlements, names, normalizedQuery, range],
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#0F172A" />

      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable style={styles.headerButton} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={23} color="#FFFFFF" />
          </Pressable>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>History</Text>
            <Text style={styles.headerSubtitle}>Expenses and settlements</Text>
          </View>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.row}
        >
          {(['All', 'Expenses', 'Settlements'] as Filter[]).map((item) => (
            <Pressable
              key={item}
              style={[styles.chip, filter === item && styles.chipActive]}
              onPress={() => setFilter(item)}
            >
              <Text style={[styles.chipText, filter === item && styles.chipTextActive]}>
                {item}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={[styles.row, { paddingTop: 0 }]}
        >
          {(['All time', 'Today', '7 days', '30 days'] as Range[]).map((item) => (
            <Pressable
              key={item}
              style={[styles.filterChip, range === item && styles.filterChipActive]}
              onPress={() => setRange(item)}
            >
              <Text
                style={[
                  styles.filterChipText,
                  range === item && styles.filterChipTextActive,
                ]}
              >
                {item}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {(filter === 'All' || filter === 'Expenses') && (
          <>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.row, { paddingTop: 0 }]}>
              {(['all', 'mine'] as const).map((scope) => (
                <Pressable key={scope} style={[styles.filterChip, expenseScope === scope && styles.filterChipActive]} onPress={() => setExpenseScope(scope)}>
                  <Text style={[styles.filterChipText, expenseScope === scope && styles.filterChipTextActive]}>
                    {scope === 'all' ? 'All group' : 'Mine'}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.row, { paddingTop: 0 }]}>
              <Pressable style={[styles.filterChip, expenseCategory === 'All' && styles.filterChipActive]} onPress={() => setExpenseCategory('All')}>
                <Text style={[styles.filterChipText, expenseCategory === 'All' && styles.filterChipTextActive]}>All</Text>
              </Pressable>
              {EXPENSE_CATEGORIES.map((item) => (
                <Pressable key={item} style={[styles.filterChip, expenseCategory === item && styles.filterChipActive]} onPress={() => setExpenseCategory(item)}>
                  <Ionicons name={EXPENSE_CATEGORY_ICONS[item]} size={13} color={expenseCategory === item ? '#FFFFFF' : '#94A3B8'} />
                  <Text style={[styles.filterChipText, expenseCategory === item && styles.filterChipTextActive]}> {item}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </>
        )}

        <View style={styles.searchBox}>
          <Ionicons name="search-outline" size={19} color="#64748B" />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search expenses, people or notes"
            placeholderTextColor="#64748B"
            style={styles.searchInput}
          />
          {query ? (
            <Pressable onPress={() => setQuery('')}>
              <Ionicons name="close-circle" size={19} color="#64748B" />
            </Pressable>
          ) : null}
        </View>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color="#0EA5A4" />
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
          >
            {(filter === 'All' || filter === 'Expenses') && (
              <>
                <Text style={styles.sectionTitle}>Expenses</Text>
                {visibleExpenses.length === 0 ? (
                  <View style={styles.emptyCard}>
                    <Text style={styles.emptyText}>No matching expenses.</Text>
                  </View>
                ) : (
                  visibleExpenses.map((expense) => (
                    <ExpenseCard key={expense.id} expense={expense} currency={currency} />
                  ))
                )}
              </>
            )}

            {(filter === 'All' || filter === 'Settlements') && (
              <>
                <Text style={[styles.sectionTitle, { marginTop: 18 }]}>
                  Settlements
                </Text>
                {visibleSettlements.length === 0 ? (
                  <View style={styles.emptyCard}>
                    <Text style={styles.emptyText}>No matching settlements.</Text>
                  </View>
                ) : (
                  visibleSettlements.map((settlement) => (
                    <Pressable
                      key={settlement.id}
                      style={styles.settlementCard}
                      onPress={() =>
                        navigation.navigate('SettlementDetails', {
                          groupId,
                          settlementId: settlement.id,
                        })
                      }
                    >
                      <View style={styles.settlementIcon}>
                        <Ionicons
                          name="swap-horizontal-outline"
                          size={19}
                          color="#0EA5A4"
                        />
                      </View>
                      <View style={styles.flexOne}>
                        <Text style={styles.settlementTitle}>
                          {names.get(settlement.from_user_id) || 'Member'} paid{' '}
                          {names.get(settlement.to_user_id) || 'Member'}
                        </Text>
                        <Text style={styles.settlementMeta}>
                          {settlement.note || 'Settlement'}
                        </Text>
                      </View>
                      <Text style={styles.settlementAmount}>
                        {formatCurrency(settlement.amount, currency)}
                      </Text>
                    </Pressable>
                  ))
                )}
              </>
            )}

            <View style={{ height: 40 }} />
          </ScrollView>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#0F172A' },
  container: { flex: 1, backgroundColor: '#0F172A' },
  header: {
    minHeight: 68,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  headerButton: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#1E293B',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCenter: { flex: 1, paddingHorizontal: 12 },
  headerTitle: { color: '#FFFFFF', fontSize: 21, fontWeight: '900' },
  headerSubtitle: { color: '#64748B', fontSize: 12, marginTop: 2 },
  row: { paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  chip: { backgroundColor: '#1E293B', paddingHorizontal: 15, paddingVertical: 9, borderRadius: 999 },
  chipActive: { backgroundColor: '#0EA5A4' },
  chipText: { color: '#CBD5E1', fontWeight: '800', fontSize: 13 },
  chipTextActive: { color: '#FFFFFF' },
  filterChip: { backgroundColor: '#172236', paddingHorizontal: 13, paddingVertical: 8, borderRadius: 999 },
  filterChipActive: { backgroundColor: '#334155' },
  filterChipText: { color: '#94A3B8', fontSize: 12, fontWeight: '700' },
  filterChipTextActive: { color: '#FFFFFF' },
  searchBox: {
    marginHorizontal: 16,
    marginBottom: 10,
    minHeight: 48,
    backgroundColor: '#1E293B',
    borderRadius: 14,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
  },
  searchInput: { flex: 1, color: '#FFFFFF', marginLeft: 9, fontSize: 13 },
  content: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 40 },
  sectionTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '900', marginBottom: 10 },
  emptyCard: { backgroundColor: '#1E293B', borderRadius: 16, padding: 20, marginBottom: 8 },
  emptyText: { color: '#94A3B8', textAlign: 'center' },
  settlementCard: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  settlementIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#0F3333',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 11,
  },
  flexOne: { flex: 1, minWidth: 0 },
  settlementTitle: { color: '#FFFFFF', fontWeight: '800' },
  settlementMeta: { color: '#64748B', marginTop: 3, fontSize: 12 },
  settlementAmount: { color: '#FFFFFF', fontWeight: '900', marginLeft: 8 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});