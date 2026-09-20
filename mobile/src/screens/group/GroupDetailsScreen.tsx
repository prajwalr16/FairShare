import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';

import ExpenseCard from '../../components/ExpenseCard';
import MemberCard from '../../components/MemberCard';
import AddMemberModal from '../../components/AddMemberModal';
import {
  addGroupMember,
  getGroupMembers,
  GroupMember,
  removeGroupMemberFromGroup,
} from '../../services/memberService';
import {
  getGroupSettings,
  GroupRole,
} from '../../services/groupService';
import { getGroupExpenses } from '../../services/expenseService';
import { getGroupBalances, GroupBalance } from '../../services/balanceService';
import {
  getGroupDebts,
  DebtRelationship,
} from '../../services/debtService';
import {
  deleteSettlement,
  getGroupSettlements,
  GroupSettlement,
  recordSettlement,
  updateSettlement,
} from '../../services/settlementService';
import { formatCurrency } from '../../utils/currency';
import { EXPENSE_CATEGORIES, EXPENSE_CATEGORY_ICONS, ExpenseCategory } from '../../constants/expenseCategories';

type Tab = 'Overview' | 'Expenses' | 'Balances' | 'Members' | 'Activity';

function money(value: number | string | null | undefined, currency: string) {
  return formatCurrency(value, currency);
}

function displayMember(member?: GroupMember | null) {
  return member?.full_name?.trim() || member?.email?.trim() || 'Member';
}

function displayBalance(balance?: GroupBalance | null) {
  const value = Number(balance?.net_balance ?? 0);
  if (Math.abs(value) < 0.005) return 'Settled';
  return value > 0 ? `+${value.toFixed(2)}` : value.toFixed(2);
}

export default function GroupDetailsScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();

  const groupId = route.params?.groupId as string | undefined;

  const [tab, setTab] = useState<Tab>('Overview');
  const [groupName, setGroupName] = useState(
    route.params?.groupName || 'Group',
  );
  const [currency, setCurrency] = useState('INR');
  const [role, setRole] = useState<GroupRole>('member');

  const [members, setMembers] = useState<GroupMember[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [balances, setBalances] = useState<GroupBalance[]>([]);
  const [debts, setDebts] = useState<{
    simplified: DebtRelationship[];
    direct: DebtRelationship[];
  }>({ simplified: [], direct: [] });
  const [settlements, setSettlements] = useState<GroupSettlement[]>([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [simplifyDebts, setSimplifyDebts] = useState(true);
  const [showAddMember, setShowAddMember] = useState(false);
  const [showSettle, setShowSettle] = useState(false);
  const [selectedDebt, setSelectedDebt] = useState<DebtRelationship | null>(null);
  const [settleAmount, setSettleAmount] = useState('');
  const [settleNote, setSettleNote] = useState('');
  const [settling, setSettling] = useState(false);
  const [expenseCategory, setExpenseCategory] = useState<ExpenseCategory | 'All'>('All');
  const [expenseScope, setExpenseScope] = useState<'all' | 'mine'>('all');

  const canWriteMoney = role === 'owner' || role === 'admin' || role === 'member';
  const canManageMembers = role === 'owner' || role === 'admin';

  const load = useCallback(async () => {
    if (!groupId) return;

    const [settingsResult, memberResult, expenseResult, balanceResult, debtResult, settlementResult] =
      await Promise.all([
        getGroupSettings(groupId),
        getGroupMembers(groupId),
        getGroupExpenses(groupId, 200, expenseCategory, expenseScope),
        getGroupBalances(groupId),
        getGroupDebts(groupId),
        getGroupSettlements(groupId),
      ]);

    if (settingsResult.error || !settingsResult.data) {
      Alert.alert(
        'Unable to load group',
        settingsResult.error?.message || 'Group not found.',
      );
      return;
    }

    setGroupName(settingsResult.data.name);
    setCurrency(settingsResult.data.currency || 'INR');
    setRole(settingsResult.data.role || 'member');

    if (!memberResult.error) setMembers(memberResult.data || []);
    if (!expenseResult.error) setExpenses(expenseResult.data || []);
    if (!balanceResult.error) setBalances(balanceResult.data || []);
    if (!debtResult.error && debtResult.data) setDebts(debtResult.data);
    if (!settlementResult.error) setSettlements(settlementResult.data || []);
  }, [groupId, expenseCategory, expenseScope]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        if (!groupId) {
          setLoading(false);
          return;
        }
        setLoading(true);
        try {
          await load();
        } finally {
          if (active) setLoading(false);
        }
      })();
      return () => {
        active = false;
      };
    }, [groupId, load]),
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const currentBalance = useMemo(
    () => balances[0] || null,
    [balances],
  );

  const visibleDebts = simplifyDebts ? debts.simplified : debts.direct;

  const openSettlement = (debt: DebtRelationship) => {
    setSelectedDebt(debt);
    setSettleAmount(Number(debt.amount).toFixed(2));
    setSettleNote('');
    setShowSettle(true);
  };

  const closeSettlement = () => {
    if (settling) return;
    setShowSettle(false);
    setSelectedDebt(null);
    setSettleAmount('');
    setSettleNote('');
  };

  const submitSettlement = async () => {
    if (!groupId || !selectedDebt) return;

    const amount = Number(settleAmount.replace(/,/g, '').trim());
    if (!Number.isFinite(amount) || amount <= 0) {
      Alert.alert('Invalid amount', 'Enter a valid settlement amount.');
      return;
    }

    if (amount - Number(selectedDebt.amount) > 0.005) {
      Alert.alert(
        'Invalid amount',
        `The outstanding amount is ${money(selectedDebt.amount, currency)}.`,
      );
      return;
    }

    setSettling(true);
    const { error } = await recordSettlement({
      groupId,
      fromUserId: selectedDebt.from_user_id,
      toUserId: selectedDebt.to_user_id,
      amount,
      note: settleNote,
    });
    setSettling(false);

    if (error) {
      Alert.alert('Unable to record payment', error.message);
      return;
    }

    closeSettlement();
    await load();
  };

  const handleAddMember = async (email: string) => {
    if (!groupId) return { error: new Error('Group information is missing.') };
    const result = await addGroupMember(groupId, email);
    if (result.error) {
      Alert.alert('Unable to add member', result.error.message);
      return result;
    }
    await load();
    return result;
  };

  const handleRemoveMember = (member: GroupMember) => {
    if (!groupId || !member.user_id) return;

    Alert.alert(
      'Remove member?',
      `Remove ${displayMember(member)} from ${groupName}? Existing expenses remain intact.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            const { error } = await removeGroupMemberFromGroup(groupId, member.id);
            if (error) {
              Alert.alert('Unable to remove member', error.message);
              return;
            }
            await load();
          },
        },
      ],
    );
  };

  const settlementName = useMemo(() => {
    if (!selectedDebt) return '';
    return `${selectedDebt.from_name} → ${selectedDebt.to_name}`;
  }, [selectedDebt]);

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="light-content" backgroundColor="#0F172A" />
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#0EA5A4" />
          <Text style={styles.loadingText}>Loading group…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!groupId) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.center}>
          <Text style={styles.emptyTitle}>Group unavailable</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <StatusBar barStyle="light-content" backgroundColor="#0F172A" />

        <View style={styles.container}>
          <View style={styles.header}>
            <Pressable
              style={styles.headerButton}
              onPress={() => navigation.goBack()}
              hitSlop={10}
            >
              <Ionicons name="arrow-back" size={23} color="#FFFFFF" />
            </Pressable>

            <View style={styles.headerCenter}>
              <Text style={styles.headerTitle} numberOfLines={1}>
                {groupName}
              </Text>
              <Text style={styles.headerSubtitle}>
                {currency} • {role}
              </Text>
            </View>

            <Pressable
              style={styles.headerButton}
              onPress={() =>
                navigation.navigate('GroupSettings', {
                  groupId,
                  groupName,
                })
              }
              hitSlop={10}
            >
              <Ionicons name="settings-outline" size={21} color="#FFFFFF" />
            </Pressable>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            bounces={false}
            style={styles.tabsContainer}
            contentContainerStyle={styles.tabs}
          >
            {([
              ['Overview', 'home-outline'],
              ['Expenses', 'receipt-outline'],
              ['Balances', 'cash-outline'],
              ['Members', 'people-outline'],
              ['Activity', 'time-outline'],
            ] as Array<[Tab, keyof typeof Ionicons.glyphMap]>).map(([item, icon], index, items) => (
              <Pressable
                key={item}
                style={[
                  styles.tab,
                  index < items.length - 1 && styles.tabSpacing,
                  tab === item && styles.tabActive,
                ]}
                onPress={() => setTab(item)}
              >
                <Ionicons
                  name={icon}
                  size={15}
                  color={tab === item ? '#FFFFFF' : '#94A3B8'}
                />
                <Text style={[styles.tabText, tab === item && styles.tabTextActive]}>
                  {item}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                tintColor="#0EA5A4"
              />
            }
          >
            {tab === 'Overview' && (
              <>
                <View style={styles.heroCard}>
                  <Text style={styles.heroLabel}>Your balance</Text>
                  <Text style={styles.heroAmount}>
                    {currentBalance
                      ? money(currentBalance.net_balance, currency)
                      : money(0, currency)}
                  </Text>
                  <Text style={styles.heroHint}>
                    {currentBalance
                      ? Number(currentBalance.net_balance) > 0.005
                        ? 'You are owed'
                        : Number(currentBalance.net_balance) < -0.005
                        ? 'You owe'
                        : 'You are settled'
                      : 'No balance yet'}
                  </Text>
                </View>

                <View style={styles.statRow}>
                  <View style={styles.statCard}>
                    <Text style={styles.statLabel}>Paid</Text>
                    <Text style={styles.statValue}>
                      {money(currentBalance?.total_paid || 0, currency)}
                    </Text>
                  </View>
                  <View style={styles.statCard}>
                    <Text style={styles.statLabel}>Your share</Text>
                    <Text style={styles.statValue}>
                      {money(currentBalance?.total_owed || 0, currency)}
                    </Text>
                  </View>
                </View>

                <View style={styles.sectionHeader}>
                  <View>
                    <Text style={styles.sectionTitle}>You need to settle</Text>
                    <Text style={styles.sectionSubtitle}>
                      {visibleDebts.length} outstanding relationship
                      {visibleDebts.length === 1 ? '' : 's'}
                    </Text>
                  </View>
                  <Pressable onPress={() => setTab('Balances')}>
                    <Text style={styles.linkText}>View all</Text>
                  </Pressable>
                </View>

                {visibleDebts.length === 0 ? (
                  <View style={styles.emptyCard}>
                    <Ionicons name="checkmark-circle-outline" size={30} color="#0EA5A4" />
                    <Text style={styles.emptyCardTitle}>Everyone is settled</Text>
                  </View>
                ) : (
                  visibleDebts.slice(0, 3).map((debt) => (
                    <View
                      key={`${debt.from_user_id}-${debt.to_user_id}`}
                      style={styles.debtCard}
                    >
                      <View style={styles.debtInfo}>
                        <Text style={styles.debtNames}>
                          {debt.from_name} → {debt.to_name}
                        </Text>
                        <Text style={styles.debtAmount}>
                          {money(debt.amount, currency)}
                        </Text>
                      </View>
                      {canWriteMoney && (
                        <Pressable
                          style={styles.smallButton}
                          onPress={() => openSettlement(debt)}
                        >
                          <Text style={styles.smallButtonText}>Settle Up</Text>
                        </Pressable>
                      )}
                    </View>
                  ))
                )}

                <View style={styles.sectionHeader}>
                  <View>
                    <Text style={styles.sectionTitle}>Recent expenses</Text>
                    <Text style={styles.sectionSubtitle}>
                      Latest activity in this group
                    </Text>
                  </View>
                  <Pressable onPress={() => setTab('Expenses')}>
                    <Text style={styles.linkText}>View all</Text>
                  </Pressable>
                </View>

                {expenses.length === 0 ? (
                  <View style={styles.emptyCard}>
                    <Ionicons name="receipt-outline" size={28} color="#64748B" />
                    <Text style={styles.emptyCardTitle}>No expenses yet</Text>
                  </View>
                ) : (
                  expenses.slice(0, 5).map((expense) => (
                    <ExpenseCard key={expense.id} expense={expense} />
                  ))
                )}


              </>
            )}

            {tab === 'Expenses' && (
              <>
                <View style={styles.sectionHeader}>
                  <View>
                    <Text style={styles.sectionTitle}>Expenses</Text>
                    <Text style={styles.sectionSubtitle}>Group or personal expenses</Text>
                  </View>
                </View>

                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
                  {(['all', 'mine'] as const).map((scope) => (
                    <Pressable key={scope} style={[styles.filterChip, expenseScope === scope && styles.filterChipActive]} onPress={() => setExpenseScope(scope)}>
                      <Text style={[styles.filterChipText, expenseScope === scope && styles.filterChipTextActive]}>
                        {scope === 'all' ? 'All group' : 'Mine'}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>

                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
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

                {expenses.length === 0 ? (
                  <View style={styles.emptyCard}>
                    <Ionicons name="receipt-outline" size={30} color="#64748B" />
                    <Text style={styles.emptyCardTitle}>No expenses yet</Text>
                  </View>
                ) : (
                  expenses.map((expense) => (
                    <ExpenseCard key={expense.id} expense={expense} />
                  ))
                )}
              </>
            )}

            {tab === 'Balances' && (
              <>
                <View style={styles.balanceModeCard}>
                  <View style={styles.balanceModeText}>
                    <Text style={styles.sectionTitle}>Simplify Debts</Text>
                    <Text style={styles.sectionSubtitle}>
                      {simplifyDebts
                        ? 'Show the minimum set of payments'
                        : 'Show direct payer-to-member relationships'}
                    </Text>
                  </View>
                  <Switch
                    value={simplifyDebts}
                    onValueChange={setSimplifyDebts}
                    trackColor={{ false: '#334155', true: '#0EA5A4' }}
                    thumbColor="#FFFFFF"
                  />
                </View>

                <Text style={styles.sectionTitle}>Member balances</Text>
                <View style={styles.balanceList}>
                  {balances.map((balance) => {
                    const net = Number(balance.net_balance);
                    return (
                      <View key={balance.user_id} style={styles.balanceCard}>
                        <View style={styles.balanceIdentity}>
                          <View style={styles.avatar}>
                            <Text style={styles.avatarText}>
                              {(balance.full_name || balance.email || 'M')
                                .charAt(0)
                                .toUpperCase()}
                            </Text>
                          </View>
                          <View style={styles.flexOne}>
                            <Text style={styles.balanceName} numberOfLines={1}>
                              {balance.full_name || balance.email || 'Member'}
                            </Text>
                            <Text style={styles.balanceMeta}>
                              Paid {money(balance.total_paid, currency)} • Share{' '}
                              {money(balance.total_owed, currency)}
                            </Text>
                          </View>
                        </View>
                        <Text
                          style={[
                            styles.balanceNet,
                            net > 0.005
                              ? styles.positive
                              : net < -0.005
                              ? styles.negative
                              : styles.settled,
                          ]}
                        >
                          {displayBalance(balance)}
                        </Text>
                      </View>
                    );
                  })}
                </View>

                <View style={styles.sectionHeader}>
                  <View>
                    <Text style={styles.sectionTitle}>Who owes whom</Text>
                    <Text style={styles.sectionSubtitle}>
                      {visibleDebts.length} relationship
                      {visibleDebts.length === 1 ? '' : 's'}
                    </Text>
                  </View>
                </View>

                {visibleDebts.length === 0 ? (
                  <View style={styles.emptyCard}>
                    <Ionicons name="checkmark-circle-outline" size={30} color="#0EA5A4" />
                    <Text style={styles.emptyCardTitle}>No outstanding debts</Text>
                  </View>
                ) : (
                  visibleDebts.map((debt) => (
                    <View
                      key={`${debt.from_user_id}-${debt.to_user_id}`}
                      style={styles.debtCard}
                    >
                      <View style={styles.debtInfo}>
                        <Text style={styles.debtNames}>
                          {debt.from_name} → {debt.to_name}
                        </Text>
                        <Text style={styles.debtAmount}>
                          {money(debt.amount, currency)}
                        </Text>
                      </View>
                      {canWriteMoney && (
                        <Pressable
                          style={styles.smallButton}
                          onPress={() => openSettlement(debt)}
                        >
                          <Text style={styles.smallButtonText}>Settle Up</Text>
                        </Pressable>
                      )}
                    </View>
                  ))
                )}
              </>
            )}

            {tab === 'Members' && (
              <>
                <View style={styles.sectionHeader}>
                  <View>
                    <Text style={styles.sectionTitle}>Members</Text>
                    <Text style={styles.sectionSubtitle}>
                      {members.filter((m) => m.status === 'active').length} active
                    </Text>
                  </View>
                  {canManageMembers && (
                    <Pressable
                      style={styles.addButton}
                      onPress={() => setShowAddMember(true)}
                    >
                      <Ionicons name="add" size={18} color="#FFFFFF" />
                      <Text style={styles.addButtonText}>Add</Text>
                    </Pressable>
                  )}
                </View>

                {members.map((member) => (
                  <View key={member.id} style={styles.memberWrap}>
                    <MemberCard
                      member={member as any}
                      onRemove={
                        canManageMembers &&
                        member.status === 'active' &&
                        member.role !== 'owner' &&
                        !(role === 'admin' && member.role === 'admin')
                          ? () => handleRemoveMember(member)
                          : undefined
                      }
                    />
                  </View>
                ))}
              </>
            )}

            {tab === 'Activity' && (
              <>
                <View style={styles.sectionHeader}>
                  <View>
                    <Text style={styles.sectionTitle}>Activity</Text>
                    <Text style={styles.sectionSubtitle}>
                      Expenses and settlements
                    </Text>
                  </View>
                </View>

                {expenses.length === 0 && settlements.length === 0 ? (
                  <View style={styles.emptyCard}>
                    <Ionicons name="time-outline" size={30} color="#64748B" />
                    <Text style={styles.emptyCardTitle}>No activity yet</Text>
                  </View>
                ) : (
                  <>
                    {expenses.map((expense) => (
                      <ExpenseCard key={`expense-${expense.id}`} expense={expense} currency={currency} />
                    ))}

                    {settlements.map((settlement) => (
                      <View key={`settlement-${settlement.id}`} style={styles.activityCard}>
                        <View style={styles.activityIcon}>
                          <Ionicons
                            name="swap-horizontal-outline"
                            size={20}
                            color="#0EA5A4"
                          />
                        </View>
                        <View style={styles.flexOne}>
                          <Text style={styles.activityTitle}>
                            {settlement.from_user_id === settlement.created_by
                              ? 'Payment recorded'
                              : 'Settlement recorded'}
                          </Text>
                          <Text style={styles.activityMeta}>
                            {settlement.note || 'Settlement'}
                          </Text>
                        </View>
                        <Text style={styles.activityAmount}>
                          {money(settlement.amount, currency)}
                        </Text>
                      </View>
                    ))}
                  </>
                )}
              </>
            )}
          </ScrollView>

          {canWriteMoney && (tab === 'Overview' || tab === 'Expenses') && (
            <Pressable
              style={styles.fab}
              onPress={() =>
                navigation.navigate('AddExpense', {
                  groupId,
                  groupName,
                })
              }
            >
              <Ionicons name="add" size={30} color="#FFFFFF" />
            </Pressable>
          )}
        </View>
      </SafeAreaView>

      <AddMemberModal
        visible={showAddMember}
        onClose={() => setShowAddMember(false)}
        onAdd={async (email: string) => {
          await handleAddMember(email);
          setShowAddMember(false);
        }}
      />

      <Modal
        visible={showSettle}
        transparent
        animationType="slide"
        onRequestClose={closeSettlement}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.settleSheet}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Settle Up</Text>
                <Text style={styles.modalSubtitle}>{settlementName}</Text>
              </View>
              <Pressable onPress={closeSettlement} hitSlop={10}>
                <Ionicons name="close" size={24} color="#FFFFFF" />
              </Pressable>
            </View>

            <Text style={styles.inputLabel}>Amount</Text>
            <TextInput
              value={settleAmount}
              onChangeText={setSettleAmount}
              keyboardType="decimal-pad"
              placeholder="0.00"
              placeholderTextColor="#64748B"
              style={styles.input}
            />
            <Text style={styles.outstandingText}>
              Outstanding: {selectedDebt ? money(selectedDebt.amount, currency) : money(0, currency)}
            </Text>

            <Text style={styles.inputLabel}>Note (optional)</Text>
            <TextInput
              value={settleNote}
              onChangeText={setSettleNote}
              placeholder="UPI payment"
              placeholderTextColor="#64748B"
              style={styles.input}
              maxLength={200}
            />

            <Pressable
              style={[styles.primaryButton, settling && styles.disabledButton]}
              onPress={submitSettlement}
              disabled={settling}
            >
              {settling ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.primaryButtonText}>Record Payment</Text>
              )}
            </Pressable>

            <Pressable style={styles.cancelButton} onPress={closeSettlement}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
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
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1E293B',
  },
  headerCenter: {
    flex: 1,
    paddingHorizontal: 12,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
  },
  headerSubtitle: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 3,
    textTransform: 'capitalize',
  },
  tabs: {
    flexDirection: 'row',
    flexGrow: 0,
    alignSelf: 'flex-start',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  tab: {
    height: 40,
    paddingHorizontal: 11,
    borderRadius: 12,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    flexGrow: 0,
    flexShrink: 0,
    alignSelf: 'flex-start',
  },
  tabSpacing: {
    marginRight: 6,
  },
  tabsContainer: {
    height: 56,
    flexGrow: 0,
    flexShrink: 0,
  },
  tabActive: {
    backgroundColor: '#0EA5A4',
  },
  tabText: { color: '#CBD5E1', fontWeight: '700', fontSize: 11 },
  tabTextActive: {
    color: '#FFFFFF',
  },
  filterRow: { paddingHorizontal: 18, paddingBottom: 8, gap: 7 },
  filterChip: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#172236', paddingHorizontal: 11, paddingVertical: 8, borderRadius: 999 },
  filterChipActive: { backgroundColor: '#0EA5A4' },
  filterChipText: { color: '#94A3B8', fontSize: 11, fontWeight: '700' },
  filterChipTextActive: { color: '#FFFFFF' },
  scroll: { flex: 1 },
  content: {
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 20,
  },
  heroCard: {
    backgroundColor: '#1E293B',
    borderRadius: 22,
    padding: 22,
    marginBottom: 14,
  },
  heroLabel: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '700',
  },
  heroAmount: {
    color: '#FFFFFF',
    fontSize: 34,
    fontWeight: '900',
    marginTop: 4,
  },
  heroHint: {
    color: '#CBD5E1',
    marginTop: 6,
    fontSize: 14,
  },
  statRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#1E293B',
    borderRadius: 18,
    padding: 16,
  },
  statLabel: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '700',
  },
  statValue: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
    marginTop: 8,
  },
  sectionHeader: {
    marginTop: 10,
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },
  sectionSubtitle: {
    color: '#64748B',
    marginTop: 3,
    fontSize: 12,
  },
  linkText: {
    color: '#0EA5A4',
    fontSize: 13,
    fontWeight: '800',
  },
  debtCard: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 15,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  debtInfo: { flex: 1 },
  debtNames: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  debtAmount: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: '900',
    marginTop: 5,
  },
  smallButton: {
    backgroundColor: '#0EA5A4',
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 12,
  },
  smallButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 12,
  },
  emptyCard: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 22,
    alignItems: 'center',
    marginBottom: 14,
  },
  emptyCardTitle: {
    color: '#FFFFFF',
    fontWeight: '800',
    marginTop: 8,
  },
  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 12,
  },
  quickCard: {
    width: '48.5%',
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
  },
  quickTitle: {
    color: '#FFFFFF',
    fontWeight: '800',
    marginTop: 8,
  },
  balanceModeCard: {
    backgroundColor: '#1E293B',
    borderRadius: 18,
    padding: 16,
    marginBottom: 18,
    flexDirection: 'row',
    alignItems: 'center',
  },
  balanceModeText: { flex: 1 },
  balanceList: { marginTop: 10, marginBottom: 18 },
  balanceCard: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 14,
    marginBottom: 9,
    flexDirection: 'row',
    alignItems: 'center',
  },
  balanceIdentity: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 0,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 11,
  },
  avatarText: {
    color: '#FFFFFF',
    fontWeight: '900',
  },
  flexOne: { flex: 1, minWidth: 0 },
  balanceName: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  balanceMeta: {
    color: '#64748B',
    fontSize: 11,
    marginTop: 4,
  },
  balanceNet: {
    fontSize: 15,
    fontWeight: '900',
    marginLeft: 8,
  },
  positive: { color: '#5EEAD4' },
  negative: { color: '#FCA5A5' },
  settled: { color: '#94A3B8' },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#0EA5A4',
    paddingHorizontal: 11,
    paddingVertical: 9,
    borderRadius: 12,
  },
  addButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  memberWrap: { marginBottom: 4 },
  activityCard: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  activityIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0F3333',
    marginRight: 11,
  },
  activityTitle: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  activityMeta: {
    color: '#64748B',
    marginTop: 3,
    fontSize: 12,
  },
  activityAmount: {
    color: '#FFFFFF',
    fontWeight: '900',
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: '#0EA5A4',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 10,
    shadowColor: '#000000',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
  },
  settleSheet: {
    backgroundColor: '#0F172A',
    padding: 22,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  modalTitle: {
    color: '#FFFFFF',
    fontSize: 25,
    fontWeight: '900',
  },
  modalSubtitle: {
    color: '#94A3B8',
    marginTop: 5,
    fontSize: 13,
  },
  inputLabel: {
    color: '#CBD5E1',
    fontWeight: '800',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#1E293B',
    borderRadius: 14,
    color: '#FFFFFF',
    paddingHorizontal: 15,
    paddingVertical: 14,
    marginBottom: 7,
  },
  outstandingText: {
    color: '#64748B',
    fontSize: 12,
    marginBottom: 16,
  },
  primaryButton: {
    backgroundColor: '#0EA5A4',
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 6,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontWeight: '900',
  },
  cancelButton: {
    alignItems: 'center',
    paddingVertical: 15,
  },
  cancelButtonText: {
    color: '#94A3B8',
    fontWeight: '700',
  },
  disabledButton: { opacity: 0.6 },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  loadingText: { color: '#94A3B8', marginTop: 12 },
  emptyTitle: { color: '#FFFFFF', fontWeight: '900', fontSize: 20 },
});