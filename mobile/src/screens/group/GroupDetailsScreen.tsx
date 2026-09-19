import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  RefreshControl,
  StatusBar,
  Alert,
  Switch,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import {
  SafeAreaView,
} from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  useFocusEffect,
  useNavigation,
  useRoute,
} from '@react-navigation/native';

import { supabase } from '../../config/supabase';
import { formatCurrency } from '../../utils/currency';
import ExpenseCard from '../../components/ExpenseCard';
import MemberCard from '../../components/MemberCard';
import AddMemberModal from '../../components/AddMemberModal';
import {
  getGroupMembers,
  addGroupMember,
  removeGroupMember,
  GroupMember,
} from '../../services/memberService';
import {
  getGroupBalances,
  GroupBalance,
} from '../../services/balanceService';
import {
  getGroupDebtRelationships,
  DebtRelationship,
} from '../../services/debtService';
import {
  getGroupSettlements,
  recordSettlement,
  updateSettlement,
  deleteSettlement,
  GroupSettlement,
} from '../../services/settlementService';

type Expense = {
  id: string;
  title?: string;
  amount?: number | string | null;
  split_type?: string | null;
  paid_by?: string | null;
  created_at?: string | null;
};

function money(value: number | string | null | undefined, currency: string) {
  return formatCurrency(value, currency);
}

function displayName(balance: GroupBalance) {
  return balance.full_name?.trim() || balance.email?.trim() || 'Member';
}

function balanceLabel(balance: GroupBalance, currency: string) {
  const net = Number(balance.net_balance ?? 0);

  if (Math.abs(net) < 0.005) {
    return 'Settled';
  }

  return net > 0
    ? `is owed ${money(net, currency)}`
    : `owes ${money(Math.abs(net), currency)}`;
}

function signedBalance(balance: GroupBalance, currency: string) {
  const net = Number(balance.net_balance ?? 0);

  if (Math.abs(net) < 0.005) {
    return money(0, currency);
  }

  return `${net > 0 ? '+' : '-'}${money(Math.abs(net), currency)}`;
}

export default function GroupDetailsScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();

  const groupId = route.params?.groupId;
  const routeGroupName = route.params?.groupName;

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [balances, setBalances] = useState<GroupBalance[]>([]);
  const [settlements, setSettlements] = useState<GroupSettlement[]>([]);
  const [debtSets, setDebtSets] = useState<{
    direct: DebtRelationship[];
    simplified: DebtRelationship[];
  }>({
    direct: [],
    simplified: [],
  });
  const [simplifyDebts, setSimplifyDebts] = useState(true);
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentGroupName, setCurrentGroupName] = useState<string>(
    routeGroupName || 'Group'
  );
  const [currentRole, setCurrentRole] = useState<string>('member');
  const [currency, setCurrency] = useState('INR');

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);
  const [settleModalVisible, setSettleModalVisible] = useState(false);
  const [selectedDebt, setSelectedDebt] = useState<DebtRelationship | null>(null);
  const [settlementAmountText, setSettlementAmountText] = useState('');
  const [settlementNote, setSettlementNote] = useState('');
  const [settlementSaving, setSettlementSaving] = useState(false);
  const [selectedSettlement, setSelectedSettlement] = useState<GroupSettlement | null>(null);
  const [settlementDetailsVisible, setSettlementDetailsVisible] = useState(false);
  const [editingSettlement, setEditingSettlement] = useState(false);
  const [editSettlementAmountText, setEditSettlementAmountText] = useState('');
  const [editSettlementNote, setEditSettlementNote] = useState('');
  const [settlementUpdating, setSettlementUpdating] = useState(false);
  const [settlementDeleting, setSettlementDeleting] = useState(false);

  const loadGroupData = useCallback(async () => {
    if (!groupId) {
      setExpenses([]);
      setMembers([]);
      setBalances([]);
      setSettlements([]);
      setDebtSets({ direct: [], simplified: [] });
      setLoading(false);
      return;
    }

    const userResult = await supabase.auth.getUser();

    const [
      expenseResult,
      memberResult,
      groupResult,
      balanceResult,
      settlementResult,
    ] = await Promise.all([
        supabase
          .from('expenses')
          .select('*')
          .eq('group_id', groupId)
          .order('created_at', {
            ascending: false,
          }),
        getGroupMembers(groupId),
        supabase
          .from('groups')
          .select('owner_id,name,currency')
          .eq('id', groupId)
          .single(),
        getGroupBalances(groupId),
        getGroupSettlements(groupId),
      ]);

    if (expenseResult.error) {
      console.log(
        'Failed to load expenses:',
        expenseResult.error.message
      );
    } else {
      setExpenses(expenseResult.data || []);
    }

    if (settlementResult.error) {
      console.log(
        'Failed to load settlements:',
        settlementResult.error.message
      );
      setSettlements([]);
    } else {
      setSettlements((settlementResult.data || []) as GroupSettlement[]);
    }

    if (memberResult.error) {
      console.log(
        'Failed to load members:',
        memberResult.error.message
      );
      setCurrentRole('member');
    } else {
      const loadedMembers = memberResult.data || [];
      setMembers(loadedMembers);

      const callerId = userResult.data.user?.id || null;
      const callerMember = loadedMembers.find(
        (member) => member.user_id === callerId && member.status === 'active'
      );
      setCurrentRole(callerMember?.role || 'member');
    }

    let loadedBalances: GroupBalance[] = [];

    if (balanceResult.error) {
      console.log(
        'Failed to load balances:',
        balanceResult.error.message
      );
      setBalances([]);
      setDebtSets({ direct: [], simplified: [] });
    } else {
      loadedBalances = (balanceResult.data || []) as GroupBalance[];
      setBalances(loadedBalances);
    }

    if (expenseResult.error || balanceResult.error) {
      setDebtSets({ direct: [], simplified: [] });
    } else {
      const debtResult = await getGroupDebtRelationships(
        (expenseResult.data || []) as Expense[],
        loadedBalances
      );

      if (debtResult.error) {
        console.log(
          'Failed to calculate debt relationships:',
          debtResult.error.message
        );
        setDebtSets({ direct: [], simplified: [] });
      } else {
        setDebtSets(
          debtResult.data || { direct: [], simplified: [] }
        );
      }
    }

    const latestOwnerId = groupResult.data?.owner_id || null;
    const latestUserId = userResult.data.user?.id || null;

    setOwnerId(latestOwnerId);
    setCurrentUserId(latestUserId);
    setCurrentGroupName(groupResult.data?.name?.trim() || routeGroupName || 'Group');
    setCurrency(groupResult.data?.currency || 'INR');
    if (latestUserId && latestUserId === latestOwnerId) {
      setCurrentRole('owner');
    }
    setLoading(false);
  }, [groupId]);

  useFocusEffect(
    useCallback(() => {
      loadGroupData();
    }, [loadGroupData])
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadGroupData();
    setRefreshing(false);
  };

  const handleAddMember = async (email: string) => {
    if (!groupId) {
      throw new Error('Group information is missing.');
    }

    const { data, error } = await addGroupMember(groupId, email);

    if (error) {
      throw error;
    }

    await loadGroupData();

    if (data?.status === 'pending') {
      Alert.alert(
        'Invitation sent',
        `${email} will receive an email invitation to join this group.`
      );
    } else {
      Alert.alert(
        'Member added',
        `${email} is now an active member of this group.`
      );
    }
  };

  const openSettlementModal = (debt: DebtRelationship) => {
    if (!currentUserId) {
      Alert.alert('Not signed in', 'Please sign in again and retry.');
      return;
    }

    if (
      debt.from_user_id !== currentUserId &&
      debt.to_user_id !== currentUserId
    ) {
      return;
    }

    setSelectedDebt(debt);
    setSettlementAmountText(debt.amount.toFixed(2));
    setSettlementNote('');
    setSettleModalVisible(true);
  };

  const closeSettlementModal = () => {
    if (settlementSaving) return;

    setSettleModalVisible(false);
    setSelectedDebt(null);
    setSettlementAmountText('');
    setSettlementNote('');
  };

  const openSettlementDetails = (settlement: GroupSettlement) => {
    setSelectedSettlement(settlement);
    setEditingSettlement(false);
    setEditSettlementAmountText(Number(settlement.amount ?? 0).toFixed(2));
    setEditSettlementNote(settlement.note?.trim() || '');
    setSettlementDetailsVisible(true);
  };

  const closeSettlementDetails = () => {
    if (settlementUpdating || settlementDeleting) return;

    setSettlementDetailsVisible(false);
    setSelectedSettlement(null);
    setEditingSettlement(false);
    setEditSettlementAmountText('');
    setEditSettlementNote('');
  };

  const canManageSettlement = (settlement: GroupSettlement) =>
    !!currentUserId &&
    (currentUserId === ownerId || settlement.created_by === currentUserId);

  const startEditingSettlement = () => {
    if (!selectedSettlement || !canManageSettlement(selectedSettlement)) return;

    setEditSettlementAmountText(
      Number(selectedSettlement.amount ?? 0).toFixed(2)
    );
    setEditSettlementNote(selectedSettlement.note?.trim() || '');
    setEditingSettlement(true);
  };

  const cancelEditingSettlement = () => {
    if (settlementUpdating) return;
    if (selectedSettlement) {
      setEditSettlementAmountText(
        Number(selectedSettlement.amount ?? 0).toFixed(2)
      );
      setEditSettlementNote(selectedSettlement.note?.trim() || '');
    }
    setEditingSettlement(false);
  };

  const handleUpdateSettlement = async () => {
    if (!groupId || !selectedSettlement) return;

    const normalized = editSettlementAmountText.replace(/,/g, '').trim();

    if (!/^\d+(\.\d{1,2})?$/.test(normalized)) {
      Alert.alert(
        'Invalid amount',
        'Enter a valid settlement amount with up to 2 decimal places.'
      );
      return;
    }

    const amount = Number(normalized);

    if (!Number.isFinite(amount) || amount <= 0) {
      Alert.alert('Invalid amount', 'Settlement amount must be greater than 0.');
      return;
    }

    if (editSettlementNote.trim().length > 200) {
      Alert.alert(
        'Note too long',
        'Keep the settlement note within 200 characters.'
      );
      return;
    }

    setSettlementUpdating(true);

    const { error } = await updateSettlement({
      groupId,
      settlementId: selectedSettlement.id,
      amount: Number(amount.toFixed(2)),
      note: editSettlementNote,
    });

    setSettlementUpdating(false);

    if (error) {
      Alert.alert('Unable to update settlement', error.message);
      return;
    }

    setSettlementDetailsVisible(false);
    setSelectedSettlement(null);
    setEditingSettlement(false);
    await loadGroupData();
    Alert.alert('Settlement updated', 'The settlement was updated successfully.');
  };

  const handleDeleteSettlement = () => {
    if (!groupId || !selectedSettlement) return;

    const payer =
      selectedSettlement.from_user_id === currentUserId
        ? 'You'
        : selectedSettlement.from_user_id === ownerId
          ? 'Group owner'
          : selectedSettlement.from_user_id;

    Alert.alert(
      'Delete settlement?',
      `Delete this ${money(selectedSettlement.amount, currency)} payment${payer ? ` from ${payer}` : ''}?\n\nThe outstanding balance will be recalculated.`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setSettlementDeleting(true);

            const { error } = await deleteSettlement(
              groupId,
              selectedSettlement.id
            );

            setSettlementDeleting(false);

            if (error) {
              Alert.alert('Unable to delete settlement', error.message);
              return;
            }

            setSettlementDetailsVisible(false);
            setSelectedSettlement(null);
            setEditingSettlement(false);
            await loadGroupData();
            Alert.alert(
              'Settlement deleted',
              'The payment was deleted and balances were recalculated.'
            );
          },
        },
      ]
    );
  };

  const handleRecordSettlement = async () => {
    if (!groupId || !selectedDebt) return;

    const normalized = settlementAmountText.replace(/,/g, '').trim();

    if (!/^\d+(\.\d{1,2})?$/.test(normalized)) {
      Alert.alert(
        'Invalid amount',
        'Enter a valid settlement amount with up to 2 decimal places.'
      );
      return;
    }

    const amount = Number(normalized);

    if (!Number.isFinite(amount) || amount <= 0) {
      Alert.alert('Invalid amount', 'Settlement amount must be greater than 0.');
      return;
    }

    if (amount > selectedDebt.amount + 0.005) {
      Alert.alert(
        'Amount too high',
        `The maximum amount for this debt is ${money(selectedDebt.amount, currency)}.`
      );
      return;
    }

    if (settlementNote.trim().length > 200) {
      Alert.alert('Note too long', 'Keep the settlement note within 200 characters.');
      return;
    }

    setSettlementSaving(true);

    const { error } = await recordSettlement({
      groupId,
      fromUserId: selectedDebt.from_user_id,
      toUserId: selectedDebt.to_user_id,
      amount: Number(amount.toFixed(2)),
      note: settlementNote,
    });

    setSettlementSaving(false);

    if (error) {
      Alert.alert('Unable to record payment', error.message);
      return;
    }

    closeSettlementModal();
    await loadGroupData();
    Alert.alert('Payment recorded', `${money(amount, currency)} settlement recorded successfully.`);
  };

  const handleRemoveMember = (member: GroupMember) => {
    if (!member.id) return;

    Alert.alert(
      'Remove member?',
      `Remove ${member.full_name || member.email || 'this member'} from the group?`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            const { error } = await removeGroupMember(member.id);

            if (error) {
              return Alert.alert('Unable to remove', error.message);
            }

            await loadGroupData();
          },
        },
      ]
    );
  };

  const isOwner = currentUserId === ownerId || currentRole === 'owner';
  const canManageMembers = isOwner || currentRole === 'admin';
  const canWriteMoney = currentRole !== 'viewer';

  const totalExpenses = expenses.reduce(
    (sum, expense) => sum + Number(expense.amount ?? 0),
    0
  );

  const currentBalance = balances.find(
    (balance) => balance.user_id === currentUserId
  );

  const currentNet = Number(currentBalance?.net_balance ?? 0);
  const currentBalanceTitle =
    Math.abs(currentNet) < 0.005
      ? 'You are settled'
      : currentNet > 0
        ? 'You are owed'
        : 'You owe';
  const currentBalanceAmount = money(Math.abs(currentNet), currency);

  const directDebtsAfterSettlements = debtSets.direct
    .map((debt) => {
      const settledAmount = settlements
        .filter(
          (settlement) =>
            settlement.from_user_id === debt.from_user_id &&
            settlement.to_user_id === debt.to_user_id
        )
        .reduce(
          (sum, settlement) => sum + Number(settlement.amount ?? 0),
          0
        );

      return {
        ...debt,
        amount: Math.max(
          0,
          Number((Number(debt.amount ?? 0) - settledAmount).toFixed(2))
        ),
      };
    })
    .filter((debt) => debt.amount > 0.005);

  const visibleDebts = simplifyDebts
    ? debtSets.simplified
    : directDebtsAfterSettlements;

  function debtDisplayName(userId: string, fallback: string) {
    if (userId === currentUserId) return 'You';
    return fallback;
  }

  function debtDescription(debt: DebtRelationship) {
    const from = debtDisplayName(
      debt.from_user_id,
      debt.from_name
    );
    const to = debtDisplayName(
      debt.to_user_id,
      debt.to_name
    );

    if (debt.from_user_id === currentUserId) {
      return `You owe ${to}`;
    }

    if (debt.to_user_id === currentUserId) {
      return `${from} owes you`;
    }

    return `${from} owes ${to}`;
  }

  return (
    <>
      <StatusBar
        barStyle="light-content"
        backgroundColor="#0F172A"
      />

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
              <Ionicons
                name="arrow-back"
                size={23}
                color="#FFFFFF"
              />
            </Pressable>

            <View style={styles.headerTextContainer}>
              <Text style={styles.groupName} numberOfLines={1}>
                {currentGroupName || 'Group'}
              </Text>

              <Text style={styles.headerSubtitle}>
                Group Overview
              </Text>
            </View>

            <Pressable
              style={styles.settingsButton}
              onPress={() =>
                navigation.navigate('GroupSettings', {
                  groupId,
                  groupName: currentGroupName,
                })
              }
              hitSlop={10}
            >
              <Ionicons name="settings-outline" size={21} color="#FFFFFF" />
            </Pressable>
          </View>

          <FlatList
            data={expenses}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                tintColor="#0EA5A4"
              />
            }
            ListHeaderComponent={
              <View>
                <View style={styles.summaryCard}>
                  <Text style={styles.summaryLabel}>
                    Total Expenses
                  </Text>

                  <Text style={styles.totalAmount}>
                    {formatCurrency(totalExpenses, currency)}
                  </Text>

                  <Text style={styles.expenseCount}>
                    {expenses.length}{' '}
                    {expenses.length === 1 ? 'expense' : 'expenses'}
                  </Text>
                </View>

                <View style={styles.balanceCard}>
                  <View style={styles.balanceHeaderRow}>
                    <View style={styles.balanceIcon}>
                      <Ionicons
                        name="wallet-outline"
                        size={21}
                        color="#0EA5A4"
                      />
                    </View>

                    <View style={styles.balanceHeaderText}>
                      <Text style={styles.balanceTitle}>
                        Your Balance
                      </Text>

                      <Text style={styles.balanceSubtitle}>
                        Based on all recorded expenses
                      </Text>
                    </View>
                  </View>

                  <Text
                    style={[
                      styles.yourBalanceAmount,
                      currentNet > 0 && styles.positiveAmount,
                      currentNet < 0 && styles.negativeAmount,
                    ]}
                  >
                    {currentBalance
                      ? currentBalanceAmount
                      : money(0, currency)}
                  </Text>

                  <Text style={styles.yourBalanceLabel}>
                    {currentBalance
                      ? currentBalanceTitle
                      : 'No balance data yet'}
                  </Text>
                </View>

                <View style={styles.sectionHeader}>
                  <View>
                    <Text style={styles.sectionTitle}>
                      Balances
                    </Text>

                    <Text style={styles.sectionSubtitle}>
                      What each member has paid and owes
                    </Text>
                  </View>
                </View>

                {balances.length ? (
                  <View style={styles.balanceList}>
                    {balances.map((balance) => {
                      const isCurrentUser =
                        balance.user_id === currentUserId;
                      const net = Number(balance.net_balance ?? 0);
                      const isSettled = Math.abs(net) < 0.005;

                      return (
                        <View
                          key={balance.user_id}
                          style={styles.memberBalanceCard}
                        >
                          <View style={styles.memberBalanceAvatar}>
                            <Text
                              style={styles.memberBalanceAvatarText}
                            >
                              {displayName(balance)
                                .charAt(0)
                                .toUpperCase()}
                            </Text>
                          </View>

                          <View style={styles.memberBalanceInfo}>
                            <Text
                              style={styles.memberBalanceName}
                              numberOfLines={1}
                            >
                              {isCurrentUser
                                ? 'You'
                                : displayName(balance)}
                            </Text>

                            <Text style={styles.memberBalanceMeta}>
                              Paid {money(balance.total_paid, currency)}
                              {'  •  '}
                              Share {money(balance.total_owed, currency)}
                            </Text>

                            <View style={styles.memberBalanceStatusRow}>
                              <Text
                                style={styles.memberBalanceStatus}
                                numberOfLines={1}
                              >
                                {balanceLabel(balance, currency)}
                              </Text>

                              <Text
                                style={[
                                  styles.memberBalanceAmount,
                                  isSettled && styles.settledAmount,
                                  net > 0 && styles.positiveAmount,
                                  net < 0 && styles.negativeAmount,
                                ]}
                              >
                                {signedBalance(balance, currency)}
                              </Text>
                            </View>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                ) : (
                  <View style={styles.noBalanceCard}>
                    <Ionicons
                      name="wallet-outline"
                      size={26}
                      color="#64748B"
                    />
                    <Text style={styles.noBalanceText}>
                      Add an expense to start calculating balances.
                    </Text>
                  </View>
                )}

                <View style={styles.debtSectionHeader}>
                  <View style={styles.debtHeaderText}>
                    <Text style={styles.sectionTitle}>
                      Who owes whom
                    </Text>

                    <Text style={styles.sectionSubtitle}>
                      {simplifyDebts
                        ? 'Minimized payment relationships'
                        : 'Individual expense obligations'}
                    </Text>
                  </View>

                  <View style={styles.simplifyToggleContainer}>
                    <Text style={styles.simplifyLabel}>
                      Simplify Debts
                    </Text>

                    <Switch
                      value={simplifyDebts}
                      onValueChange={setSimplifyDebts}
                      trackColor={{
                        false: '#334155',
                        true: '#0F766E',
                      }}
                      thumbColor={simplifyDebts ? '#0EA5A4' : '#CBD5E1'}
                    />
                  </View>
                </View>

                {visibleDebts.length ? (
                  <View style={styles.debtList}>
                    {visibleDebts.map((debt, index) => (
                      <View
                        key={`${debt.from_user_id}-${debt.to_user_id}-${index}`}
                        style={styles.debtCard}
                      >
                        <View style={styles.debtIcon}>
                          <Ionicons
                            name="arrow-forward-outline"
                            size={18}
                            color="#0EA5A4"
                          />
                        </View>

                        <View style={styles.debtInfo}>
                          <Text
                            style={styles.debtDescription}
                            numberOfLines={1}
                          >
                            {debtDescription(debt)}
                          </Text>

                          <Text style={styles.debtParties} numberOfLines={1}>
                            {debtDisplayName(debt.from_user_id, debt.from_name)}
                            {'  →  '}
                            {debtDisplayName(debt.to_user_id, debt.to_name)}
                          </Text>
                        </View>

                        <View style={styles.debtActions}>
                          <Text style={styles.debtAmount}>
                            {money(debt.amount, currency)}
                          </Text>

                          {canWriteMoney &&
                          currentUserId &&
                          (debt.from_user_id === currentUserId ||
                            debt.to_user_id === currentUserId) ? (
                            <Pressable
                              style={styles.settleButton}
                              onPress={() => openSettlementModal(debt)}
                              disabled={settlementSaving}
                            >
                              <Text style={styles.settleButtonText}>
                                Settle Up
                              </Text>
                            </Pressable>
                          ) : null}
                        </View>
                      </View>
                    ))}
                  </View>
                ) : (
                  <View style={styles.noDebtCard}>
                    <Ionicons
                      name="checkmark-circle-outline"
                      size={26}
                      color="#22C55E"
                    />
                    <Text style={styles.noDebtText}>
                      No outstanding debts. Everyone is settled.
                    </Text>
                  </View>
                )}

                <View style={styles.sectionHeader}>
                  <View>
                    <Text style={styles.sectionTitle}>
                      Settlement History
                    </Text>

                    <Text style={styles.sectionSubtitle}>
                      Recent payments recorded in this group
                    </Text>
                  </View>
                </View>

                {settlements.length ? (
                  <View style={styles.settlementList}>
                    {settlements.map((settlement) => {
                      const fromName =
                        settlement.from_user_id === currentUserId
                          ? 'You'
                          : balances.find(
                              (balance) =>
                                balance.user_id === settlement.from_user_id
                            )?.full_name?.trim() ||
                            balances.find(
                              (balance) =>
                                balance.user_id === settlement.from_user_id
                            )?.email ||
                            'Member';

                      const toName =
                        settlement.to_user_id === currentUserId
                          ? 'You'
                          : balances.find(
                              (balance) =>
                                balance.user_id === settlement.to_user_id
                            )?.full_name?.trim() ||
                            balances.find(
                              (balance) =>
                                balance.user_id === settlement.to_user_id
                            )?.email ||
                            'Member';

                      const createdDate = new Date(settlement.created_at);
                      const dateLabel = Number.isNaN(createdDate.getTime())
                        ? ''
                        : createdDate.toLocaleDateString([], {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          });

                      return (
                        <Pressable
                          key={settlement.id}
                          style={({ pressed }) => [
                            styles.settlementCard,
                            pressed && styles.settlementCardPressed,
                          ]}
                          onPress={() => openSettlementDetails(settlement)}
                        >
                          <View style={styles.settlementIcon}>
                            <Ionicons
                              name="checkmark-done-outline"
                              size={18}
                              color="#22C55E"
                            />
                          </View>

                          <View style={styles.settlementInfo}>
                            <Text
                              style={styles.settlementDescription}
                              numberOfLines={1}
                            >
                              {fromName} paid {toName}
                            </Text>

                            <Text
                              style={styles.settlementMeta}
                              numberOfLines={1}
                            >
                              {dateLabel}
                              {settlement.note?.trim()
                                ? `  •  ${settlement.note.trim()}`
                                : ''}
                            </Text>
                          </View>

                          <View style={styles.settlementAmountContainer}>
                            <Text style={styles.settlementAmount}>
                              {money(settlement.amount, currency)}
                            </Text>
                            <Ionicons
                              name="chevron-forward"
                              size={16}
                              color="#64748B"
                            />
                          </View>
                        </Pressable>
                      );
                    })}
                  </View>
                ) : (
                  <View style={styles.noSettlementCard}>
                    <Ionicons
                      name="swap-horizontal-outline"
                      size={26}
                      color="#64748B"
                    />
                    <Text style={styles.noSettlementText}>
                      No settlements recorded yet.
                    </Text>
                  </View>
                )}

                <View style={[styles.sectionHeader, styles.membersHeader]}>
                  <View>
                    <Text style={styles.sectionTitle}>
                      Members
                    </Text>

                    <Text style={styles.sectionSubtitle}>
                      {members.length}{' '}
                      {members.length === 1 ? 'member' : 'members'}
                    </Text>
                  </View>

                  {canManageMembers ? (
                    <Pressable
                      style={styles.addMemberButton}
                      onPress={() => setShowAddMember(true)}
                    >
                      <Ionicons
                        name="person-add-outline"
                        size={18}
                        color="#FFFFFF"
                      />

                      <Text style={styles.addMemberText}>
                        Add
                      </Text>
                    </Pressable>
                  ) : null}
                </View>

                {members.map((member) => {
                  const isOwner =
                    member.role === 'owner' ||
                    member.user_id === ownerId;

                  return (
                    <MemberCard
                      key={member.id}
                      member={member}
                      isOwner={isOwner}
                      onRemove={
                        !isOwner &&
                        (
                          currentUserId === ownerId ||
                          (currentRole === 'admin' &&
                            member.role !== 'admin')
                        )
                          ? () => handleRemoveMember(member)
                          : undefined
                      }
                    />
                  );
                })}

                <Text
                  style={[
                    styles.sectionTitle,
                    styles.expensesHeading,
                  ]}
                >
                  Recent Expenses
                </Text>
              </View>
            }
            ListEmptyComponent={
              !loading ? (
                <View style={styles.emptyCard}>
                  <View style={styles.emptyIcon}>
                    <Ionicons
                      name="receipt-outline"
                      size={28}
                      color="#0EA5A4"
                    />
                  </View>

                  <Text style={styles.emptyTitle}>
                    No expenses yet
                  </Text>

                  <Text style={styles.emptyText}>
                    Add your first expense to start tracking this group.
                  </Text>
                </View>
              ) : null
            }
            renderItem={({ item }) => (
              <ExpenseCard expense={item} currency={currency} />
            )}
          />

          {canWriteMoney ? (
            <Pressable
              style={styles.addButton}
              onPress={() =>
                navigation.navigate('AddExpense', {
                  groupId,
                  groupName: currentGroupName,
                })
              }
            >
              <Ionicons
                name="add"
                size={30}
                color="#FFFFFF"
              />
            </Pressable>
          ) : null}

          <Modal
            visible={settleModalVisible}
            transparent
            animationType="fade"
            onRequestClose={closeSettlementModal}
          >
            <KeyboardAvoidingView
              style={styles.modalOverlay}
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
              <View style={styles.settlementModalCard}>
                <View style={styles.modalHeader}>
                  <View style={styles.modalHeaderText}>
                    <Text style={styles.modalTitle}>Settle Up</Text>
                    <Text style={styles.modalSubtitle}>
                      Record a payment between group members.
                    </Text>
                  </View>

                  <Pressable
                    style={styles.modalCloseButton}
                    onPress={closeSettlementModal}
                    disabled={settlementSaving}
                  >
                    <Ionicons
                      name="close"
                      size={20}
                      color="#CBD5E1"
                    />
                  </Pressable>
                </View>

                {selectedDebt ? (
                  <>
                    <View style={styles.settlementSummary}>
                      <Text style={styles.settlementSummaryLabel}>
                        Payment
                      </Text>
                      <Text style={styles.settlementSummaryText}>
                        {selectedDebt.from_user_id === currentUserId
                          ? 'You'
                          : selectedDebt.from_name}
                        {'  →  '}
                        {selectedDebt.to_user_id === currentUserId
                          ? 'You'
                          : selectedDebt.to_name}
                      </Text>
                      <Text style={styles.settlementSummaryAmount}>
                        Outstanding {money(selectedDebt.amount, currency)}
                      </Text>
                    </View>

                    <Text style={styles.inputLabel}>Amount</Text>
                    <TextInput
                      style={styles.modalInput}
                      value={settlementAmountText}
                      onChangeText={(value) =>
                        setSettlementAmountText(value.replace(/[^0-9.]/g, ''))
                      }
                      placeholder="0.00"
                      placeholderTextColor="#64748B"
                      keyboardType="decimal-pad"
                      editable={!settlementSaving}
                    />

                    <Text style={styles.inputLabel}>Note (optional)</Text>
                    <TextInput
                      style={[styles.modalInput, styles.modalNoteInput]}
                      value={settlementNote}
                      onChangeText={setSettlementNote}
                      placeholder="e.g. UPI payment"
                      placeholderTextColor="#64748B"
                      maxLength={200}
                      multiline
                      editable={!settlementSaving}
                    />

                    <Text style={styles.settlementHint}>
                      Partial payments are allowed. The remaining balance will stay open.
                    </Text>

                    <View style={styles.modalActions}>
                      <Pressable
                        style={styles.modalCancelButton}
                        onPress={closeSettlementModal}
                        disabled={settlementSaving}
                      >
                        <Text style={styles.modalCancelText}>Cancel</Text>
                      </Pressable>

                      <Pressable
                        style={[
                          styles.modalSaveButton,
                          settlementSaving && styles.disabledButton,
                        ]}
                        onPress={handleRecordSettlement}
                        disabled={settlementSaving}
                      >
                        {settlementSaving ? (
                          <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                          <Text style={styles.modalSaveText}>
                            Record Payment
                          </Text>
                        )}
                      </Pressable>
                    </View>
                  </>
                ) : null}
              </View>
            </KeyboardAvoidingView>
          </Modal>

          <Modal
            visible={settlementDetailsVisible}
            transparent
            animationType="fade"
            onRequestClose={closeSettlementDetails}
          >
            <KeyboardAvoidingView
              style={styles.modalOverlay}
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
              <View style={styles.settlementModalCard}>
                <View style={styles.modalHeader}>
                  <View style={styles.modalHeaderText}>
                    <Text style={styles.modalTitle}>
                      Settlement Details
                    </Text>
                    <Text style={styles.modalSubtitle}>
                      View or manage this recorded payment.
                    </Text>
                  </View>

                  <Pressable
                    style={styles.modalCloseButton}
                    onPress={closeSettlementDetails}
                    disabled={settlementUpdating || settlementDeleting}
                  >
                    <Ionicons
                      name="close"
                      size={20}
                      color="#CBD5E1"
                    />
                  </Pressable>
                </View>

                {selectedSettlement ? (
                  <>
                    <View style={styles.settlementSummary}>
                      <Text style={styles.settlementSummaryLabel}>
                        Payment
                      </Text>
                      <Text style={styles.settlementSummaryText}>
                        {selectedSettlement.from_user_id === currentUserId
                          ? 'You'
                          : balances.find(
                              (balance) =>
                                balance.user_id ===
                                selectedSettlement.from_user_id
                            )?.full_name?.trim() ||
                            balances.find(
                              (balance) =>
                                balance.user_id ===
                                selectedSettlement.from_user_id
                            )?.email ||
                            'Member'}
                        {'  →  '}
                        {selectedSettlement.to_user_id === currentUserId
                          ? 'You'
                          : balances.find(
                              (balance) =>
                                balance.user_id === selectedSettlement.to_user_id
                            )?.full_name?.trim() ||
                            balances.find(
                              (balance) =>
                                balance.user_id === selectedSettlement.to_user_id
                            )?.email ||
                            'Member'}
                      </Text>
                      <Text style={styles.settlementSummaryAmount}>
                        {new Date(selectedSettlement.created_at).toLocaleDateString([], {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </Text>
                    </View>

                    {editingSettlement ? (
                      <>
                        <Text style={styles.inputLabel}>Amount</Text>
                        <TextInput
                          style={styles.modalInput}
                          value={editSettlementAmountText}
                          onChangeText={(value) =>
                            setEditSettlementAmountText(
                              value.replace(/[^0-9.]/g, '')
                            )
                          }
                          placeholder="0.00"
                          placeholderTextColor="#64748B"
                          keyboardType="decimal-pad"
                          editable={!settlementUpdating}
                        />

                        <Text style={styles.inputLabel}>Note (optional)</Text>
                        <TextInput
                          style={[styles.modalInput, styles.modalNoteInput]}
                          value={editSettlementNote}
                          onChangeText={setEditSettlementNote}
                          placeholder="e.g. UPI payment"
                          placeholderTextColor="#64748B"
                          maxLength={200}
                          multiline
                          editable={!settlementUpdating}
                        />

                        <Text style={styles.settlementHint}>
                          The new amount cannot exceed the outstanding debt for this payment direction.
                        </Text>

                        <View style={styles.modalActions}>
                          <Pressable
                            style={styles.modalCancelButton}
                            onPress={cancelEditingSettlement}
                            disabled={settlementUpdating}
                          >
                            <Text style={styles.modalCancelText}>Cancel</Text>
                          </Pressable>

                          <Pressable
                            style={[
                              styles.modalSaveButton,
                              settlementUpdating && styles.disabledButton,
                            ]}
                            onPress={handleUpdateSettlement}
                            disabled={settlementUpdating}
                          >
                            {settlementUpdating ? (
                              <ActivityIndicator
                                size="small"
                                color="#FFFFFF"
                              />
                            ) : (
                              <Text style={styles.modalSaveText}>
                                Save Changes
                              </Text>
                            )}
                          </Pressable>
                        </View>
                      </>
                    ) : (
                      <>
                        <View style={styles.settlementDetailAmountBox}>
                          <Text style={styles.settlementDetailAmountLabel}>
                            Amount
                          </Text>
                          <Text style={styles.settlementDetailAmount}>
                            {money(selectedSettlement.amount, currency)}
                          </Text>
                        </View>

                        <View style={styles.settlementDetailNoteBox}>
                          <Text style={styles.settlementDetailAmountLabel}>
                            Note
                          </Text>
                          <Text style={styles.settlementDetailNote}>
                            {selectedSettlement.note?.trim() || 'No note added'}
                          </Text>
                        </View>

                        {canManageSettlement(selectedSettlement) ? (
                          <View style={styles.settlementManageActions}>
                            <Pressable
                              style={styles.modalCancelButton}
                              onPress={startEditingSettlement}
                              disabled={settlementDeleting}
                            >
                              <Ionicons
                                name="create-outline"
                                size={17}
                                color="#CBD5E1"
                              />
                              <Text style={styles.modalCancelText}>Edit</Text>
                            </Pressable>

                            <Pressable
                              style={styles.deleteSettlementButton}
                              onPress={handleDeleteSettlement}
                              disabled={settlementDeleting}
                            >
                              {settlementDeleting ? (
                                <ActivityIndicator
                                  size="small"
                                  color="#FFFFFF"
                                />
                              ) : (
                                <>
                                  <Ionicons
                                    name="trash-outline"
                                    size={17}
                                    color="#FFFFFF"
                                  />
                                  <Text style={styles.deleteSettlementText}>
                                    Delete
                                  </Text>
                                </>
                              )}
                            </Pressable>
                          </View>
                        ) : (
                          <Text style={styles.settlementReadOnlyText}>
                            Only the person who recorded this payment or the group owner can edit or delete it.
                          </Text>
                        )}
                      </>
                    )}
                  </>
                ) : null}
              </View>
            </KeyboardAvoidingView>
          </Modal>

          <AddMemberModal
            visible={showAddMember}
            onClose={() => setShowAddMember(false)}
            onAdd={handleAddMember}
          />
        </View>
      </SafeAreaView>
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
    minWidth: 0,
  },

  settingsButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },

  groupName: {
    color: '#FFFFFF',
    fontSize: 25,
    fontWeight: '700',
  },

  headerSubtitle: {
    color: '#94A3B8',
    fontSize: 14,
    marginTop: 4,
  },

  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 150,
  },

  summaryCard: {
    backgroundColor: '#1E293B',
    borderRadius: 22,
    padding: 22,
    marginBottom: 14,
  },

  summaryLabel: {
    color: '#94A3B8',
    fontSize: 14,
    fontWeight: '600',
  },

  totalAmount: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: '800',
    marginTop: 8,
  },

  expenseCount: {
    color: '#64748B',
    fontSize: 14,
    marginTop: 6,
  },

  balanceCard: {
    backgroundColor: '#1E293B',
    borderRadius: 22,
    padding: 22,
    marginBottom: 26,
  },

  balanceHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  balanceIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },

  balanceHeaderText: {
    flex: 1,
  },

  balanceTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },

  balanceSubtitle: {
    color: '#64748B',
    fontSize: 12,
    marginTop: 4,
  },

  yourBalanceAmount: {
    color: '#FFFFFF',
    fontSize: 30,
    fontWeight: '800',
    marginTop: 20,
  },

  yourBalanceLabel: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 4,
  },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },

  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 19,
    fontWeight: '700',
  },

  sectionSubtitle: {
    color: '#64748B',
    fontSize: 12,
    marginTop: 4,
  },

  balanceList: {
    marginBottom: 28,
  },

  memberBalanceCard: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },

  memberBalanceAvatar: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },

  memberBalanceAvatarText: {
    color: '#0EA5A4',
    fontSize: 15,
    fontWeight: '800',
  },

  memberBalanceInfo: {
    flex: 1,
    minWidth: 0,
  },

  memberBalanceName: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },

  memberBalanceMeta: {
    color: '#64748B',
    fontSize: 11,
    marginTop: 4,
  },

  memberBalanceStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
    minWidth: 0,
  },

  memberBalanceStatus: {
    color: '#94A3B8',
    fontSize: 11,
    flex: 1,
    marginRight: 10,
  },

  memberBalanceAmount: {
    fontSize: 15,
    fontWeight: '800',
    flexShrink: 0,
  },

  positiveAmount: {
    color: '#22C55E',
  },

  negativeAmount: {
    color: '#F97316',
  },

  settledAmount: {
    color: '#94A3B8',
  },

  noBalanceCard: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 24,
    marginBottom: 28,
    alignItems: 'center',
  },

  noBalanceText: {
    color: '#64748B',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 10,
  },

  debtSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },

  debtHeaderText: {
    flex: 1,
    paddingRight: 10,
  },

  simplifyToggleContainer: {
    alignItems: 'flex-end',
    marginLeft: 8,
  },

  simplifyLabel: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '600',
    marginBottom: 2,
  },

  debtList: {
    marginBottom: 28,
  },

  debtCard: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },

  debtIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 11,
  },

  debtInfo: {
    flex: 1,
    minWidth: 0,
  },

  debtDescription: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },

  debtParties: {
    color: '#64748B',
    fontSize: 11,
    marginTop: 4,
  },

  debtAmount: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    marginLeft: 10,
  },

  noDebtCard: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 22,
    marginBottom: 28,
    alignItems: 'center',
  },

  noDebtText: {
    color: '#94A3B8',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 10,
  },

  addMemberButton: {
    minHeight: 40,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: '#0EA5A4',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },

  addMemberText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },

  debtActions: {
    alignItems: 'flex-end',
    marginLeft: 10,
  },

  settleButton: {
    marginTop: 7,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 9,
    backgroundColor: '#0F766E',
  },

  settleButtonText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },

  settlementList: {
    marginBottom: 28,
  },

  settlementCard: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },

  settlementCardPressed: {
    opacity: 0.78,
  },

  settlementIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 11,
  },

  settlementInfo: {
    flex: 1,
    minWidth: 0,
  },

  settlementDescription: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },

  settlementMeta: {
    color: '#64748B',
    fontSize: 11,
    marginTop: 4,
  },

  settlementAmountContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginLeft: 10,
  },

  settlementAmount: {
    color: '#22C55E',
    fontSize: 15,
    fontWeight: '800',
  },

  noSettlementCard: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 22,
    marginBottom: 28,
    alignItems: 'center',
  },

  noSettlementText: {
    color: '#94A3B8',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 10,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 23, 0.78)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },

  settlementModalCard: {
    width: '100%',
    maxWidth: 430,
    backgroundColor: '#1E293B',
    borderRadius: 22,
    padding: 20,
  },

  modalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 18,
  },

  modalHeaderText: {
    flex: 1,
    paddingRight: 12,
  },

  modalTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
  },

  modalSubtitle: {
    color: '#94A3B8',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 5,
  },

  modalCloseButton: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
  },

  settlementSummary: {
    backgroundColor: '#0F172A',
    borderRadius: 15,
    padding: 15,
    marginBottom: 18,
  },

  settlementSummaryLabel: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },

  settlementSummaryText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    marginTop: 6,
  },

  settlementSummaryAmount: {
    color: '#94A3B8',
    fontSize: 12,
    marginTop: 5,
  },

  inputLabel: {
    color: '#CBD5E1',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 7,
    marginTop: 2,
  },

  modalInput: {
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 13,
    color: '#FFFFFF',
    fontSize: 16,
    minHeight: 48,
    paddingHorizontal: 14,
    marginBottom: 14,
  },

  modalNoteInput: {
    minHeight: 78,
    paddingTop: 12,
    textAlignVertical: 'top',
  },

  settlementDetailAmountBox: {
    backgroundColor: '#0F172A',
    borderRadius: 15,
    padding: 15,
    marginBottom: 12,
  },

  settlementDetailAmountLabel: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },

  settlementDetailAmount: {
    color: '#22C55E',
    fontSize: 27,
    fontWeight: '800',
    marginTop: 6,
  },

  settlementDetailNoteBox: {
    backgroundColor: '#0F172A',
    borderRadius: 15,
    padding: 15,
    marginBottom: 18,
  },

  settlementDetailNote: {
    color: '#CBD5E1',
    fontSize: 14,
    lineHeight: 20,
    marginTop: 6,
  },

  settlementManageActions: {
    flexDirection: 'row',
    gap: 10,
  },

  deleteSettlementButton: {
    flex: 1.1,
    minHeight: 48,
    borderRadius: 13,
    backgroundColor: '#B91C1C',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 7,
  },

  deleteSettlementText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },

  settlementReadOnlyText: {
    color: '#64748B',
    fontSize: 11,
    lineHeight: 17,
    marginTop: 4,
  },

  settlementHint: {
    color: '#64748B',
    fontSize: 11,
    lineHeight: 16,
    marginBottom: 18,
  },

  modalActions: {
    flexDirection: 'row',
    gap: 10,
  },

  modalCancelButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 13,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },

  modalCancelText: {
    color: '#CBD5E1',
    fontSize: 14,
    fontWeight: '700',
  },

  modalSaveButton: {
    flex: 1.25,
    minHeight: 48,
    borderRadius: 13,
    backgroundColor: '#0EA5A4',
    alignItems: 'center',
    justifyContent: 'center',
  },

  modalSaveText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },

  disabledButton: {
    opacity: 0.65,
  },

  membersHeader: {
    marginTop: 4,
  },

  expensesHeading: {
    marginTop: 28,
    marginBottom: 14,
  },

  emptyCard: {
    backgroundColor: '#1E293B',
    borderRadius: 22,
    padding: 28,
    alignItems: 'center',
  },

  emptyIcon: {
    width: 58,
    height: 58,
    borderRadius: 18,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },

  emptyTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },

  emptyText: {
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 21,
    marginTop: 8,
  },

  addButton: {
    position: 'absolute',
    right: 22,
    bottom: 85,
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: '#0EA5A4',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 10,
  },
});