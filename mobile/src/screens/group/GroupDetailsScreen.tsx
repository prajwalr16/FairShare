import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { addGroupMember, getGroupMembers, GroupMember, removeGroupMemberFromGroup } from '../../services/memberService';
import {
  getCachedGroupOverview,
  getGroupHistory,
  getGroupOverview,
  GroupBalance,
  GroupOverview,
  GroupRole,
  invalidateGroupOverview,
} from '../../services/groupService';
import { getGroupExpenses } from '../../services/expenseService';
import { getGroupFinancialSummary } from '../../services/financialService';
import { recordSettlement, GroupSettlement } from '../../services/settlementService';
import { formatCurrency } from '../../utils/currency';
import { EXPENSE_CATEGORIES, EXPENSE_CATEGORY_ICONS, ExpenseCategory } from '../../constants/expenseCategories';
import { getCachedTrip, getTrip, Trip } from '../../services/tripService';

type Tab = 'Overview' | 'Journey' | 'Expenses' | 'Balances' | 'Members' | 'Activity';

type Debt = {
  from_user_id: string;
  to_user_id: string;
  from_name: string;
  to_name: string;
  amount: number | string;
};

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

function getTripDayCount(trip: Trip | null) {
  if (!trip?.start_date || !trip.end_date) return null;
  const start = new Date(`${trip.start_date}T12:00:00`);
  const end = new Date(`${trip.end_date}T12:00:00`);
  return Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000) + 1);
}

function addDaysIso(value: string, days: number) {
  const date = new Date(`${value}T12:00:00`);
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function formatTripDate(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return value;
  return new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }).format(
    new Date(year, month - 1, day),
  );
}

function isAbortError(error: any) {
  return error?.name === 'AbortError';
}

export default function GroupDetailsScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const groupId = route.params?.groupId as string | undefined;

  const requestedInitialTab = route.params?.initialTab as Tab | undefined;
  const [tab, setTab] = useState<Tab>(requestedInitialTab || 'Overview');
  const [trip, setTrip] = useState<Trip | null>(getCachedTrip(groupId || '') || null);
  const [tripLoading, setTripLoading] = useState(false);
  const [overview, setOverview] = useState<GroupOverview | null>(null);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [balances, setBalances] = useState<GroupBalance[]>([]);
  const [debts, setDebts] = useState<{ simplified: Debt[]; direct: Debt[] }>({ simplified: [], direct: [] });
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [activityExpenses, setActivityExpenses] = useState<any[]>([]);
  const [settlements, setSettlements] = useState<GroupSettlement[]>([]);

  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [simplifyDebts, setSimplifyDebts] = useState(true);
  const [showAddMember, setShowAddMember] = useState(false);
  const [showSettle, setShowSettle] = useState(false);
  const [selectedDebt, setSelectedDebt] = useState<Debt | null>(null);
  const [settleAmount, setSettleAmount] = useState('');
  const [settleNote, setSettleNote] = useState('');
  const [settling, setSettling] = useState(false);
  const [expenseCategory, setExpenseCategory] = useState<ExpenseCategory | 'All'>('All');
  const [expenseScope, setExpenseScope] = useState<'all' | 'mine'>('all');

  const overviewControllerRef = useRef<AbortController | null>(null);
  const tabControllerRef = useRef<AbortController | null>(null);
  const loadedTabsRef = useRef(new Set<Tab>());

  const groupName = overview?.name || route.params?.groupName || 'Group';
  const currency = overview?.currency || 'INR';
  const role: GroupRole = overview?.role || 'member';
  const canWriteMoney = role !== 'viewer';
  const canManageMembers = role === 'owner' || role === 'admin';

  const loadOverview = useCallback(async (background = false) => {
    if (!groupId) return;

    const cached = getCachedGroupOverview(groupId);
    if (cached) {
      setOverview(cached);
      setLoading(false);
    }

    overviewControllerRef.current?.abort();
    const controller = new AbortController();
    overviewControllerRef.current = controller;

    const result = await getGroupOverview(groupId, controller.signal);
    if (isAbortError(result.error) || controller.signal.aborted) return;

    if (result.error || !result.data) {
      if (!cached && !background) {
        Alert.alert('Unable to load group', result.error?.message || 'Group not found.');
      }
      return;
    }

    setOverview(result.data);
    setLoading(false);
  }, [groupId]);

  const loadExpenses = useCallback(async (force = false) => {
    if (!groupId || (!force && loadedTabsRef.current.has('Expenses'))) return;
    tabControllerRef.current?.abort();
    const controller = new AbortController();
    tabControllerRef.current = controller;

    const result = await getGroupExpenses(groupId, 200, expenseCategory, expenseScope, controller.signal);
    if (isAbortError(result.error) || controller.signal.aborted || result.error) return;
    setExpenses(result.data || []);
    loadedTabsRef.current.add('Expenses');
  }, [expenseCategory, expenseScope, groupId]);

  const loadFinancial = useCallback(async (force = false) => {
    if (!groupId || (!force && loadedTabsRef.current.has('Balances'))) return;
    tabControllerRef.current?.abort();
    const controller = new AbortController();
    tabControllerRef.current = controller;

    const result = await getGroupFinancialSummary(groupId, controller.signal);
    if (isAbortError(result.error) || controller.signal.aborted || !result.data) return;
    setBalances(result.data.balances || []);
    setDebts({ simplified: result.data.simplified || [], direct: result.data.direct || [] });
    loadedTabsRef.current.add('Balances');
  }, [groupId]);

  const loadMembers = useCallback(async (force = false) => {
    if (!groupId || (!force && loadedTabsRef.current.has('Members'))) return;
    tabControllerRef.current?.abort();
    const controller = new AbortController();
    tabControllerRef.current = controller;

    const result = await getGroupMembers(groupId, controller.signal, force);
    if (isAbortError(result.error) || controller.signal.aborted || result.error) return;
    setMembers(result.data || []);
    loadedTabsRef.current.add('Members');
  }, [groupId]);

  const loadTrip = useCallback(async (force = false) => {
    if (!groupId || overview?.type !== 'Trip') return;

    const cached = getCachedTrip(groupId);
    if (cached && !force) {
      setTrip(cached);
    }

    setTripLoading(!cached);
    const result = await getTrip(groupId, force);
    setTripLoading(false);

    if (result.error) {
      if (!cached && result.error.status !== 404) {
        console.log('Failed to load trip:', result.error.message);
      }
      return;
    }

    setTrip(result.data);
  }, [groupId, overview?.type]);

  const loadActivity = useCallback(async (force = false) => {
    if (!groupId || (!force && loadedTabsRef.current.has('Activity'))) return;
    tabControllerRef.current?.abort();
    const controller = new AbortController();
    tabControllerRef.current = controller;

    const result = await getGroupHistory(groupId, 100, controller.signal);
    if (isAbortError(result.error) || controller.signal.aborted || !result.data) return;
    setActivityExpenses(result.data.expenses || []);
    setSettlements(result.data.settlements || []);
    loadedTabsRef.current.add('Activity');
  }, [groupId]);

  useFocusEffect(
    useCallback(() => {
      if (!groupId) {
        setLoading(false);
        return;
      }

      if (getCachedGroupOverview(groupId)) {
        loadOverview(true);
      } else {
        loadOverview(false);
      }
      void loadTrip(false);

      return () => {
        overviewControllerRef.current?.abort();
        tabControllerRef.current?.abort();
      };
    }, [groupId, loadOverview, loadTrip]),
  );

  useEffect(() => {
    const initial = route.params?.initialTab as Tab | undefined;
    if (initial === 'Journey' && overview?.type === 'Trip') {
      setTab('Journey');
    } else if (initial && initial !== 'Journey') {
      setTab(initial);
    }
  }, [overview?.type, route.params?.initialTab]);

  useEffect(() => {
    if (tab === 'Journey') {
      void loadTrip(false);
    } else if (tab === 'Expenses') {
      loadExpenses(loadedTabsRef.current.has('Expenses'));
    } else if (tab === 'Balances') {
      loadFinancial(false);
    } else if (tab === 'Members') {
      loadMembers(false);
    } else if (tab === 'Activity') {
      loadActivity(false);
    }
  }, [
    tab,
    expenseCategory,
    expenseScope,
    loadActivity,
    loadExpenses,
    loadFinancial,
    loadMembers,
  ]);

  const refreshActiveData = useCallback(async () => {
    if (!groupId) return;
    invalidateGroupOverview(groupId);
    await loadOverview(true);
    if (tab === 'Expenses') await loadExpenses(true);
    if (tab === 'Balances') await loadFinancial(true);
    if (tab === 'Members') await loadMembers(true);
    if (tab === 'Activity') await loadActivity(true);
  }, [groupId, loadActivity, loadExpenses, loadFinancial, loadMembers, loadOverview, tab]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refreshActiveData();
    } finally {
      setRefreshing(false);
    }
  }, [refreshActiveData]);

  const currentBalance = overview?.current_user_balance || null;
  const visibleDebts: Debt[] = tab === 'Overview'
    ? overview?.top_debts || []
    : simplifyDebts
      ? debts.simplified
      : debts.direct;

  const openSettlement = (debt: Debt) => {
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
      Alert.alert('Invalid amount', `The outstanding amount is ${money(selectedDebt.amount, currency)}.`);
      return;
    }

    setSettling(true);
    const result = await recordSettlement({
      groupId,
      fromUserId: selectedDebt.from_user_id,
      toUserId: selectedDebt.to_user_id,
      amount,
      note: settleNote,
    });
    setSettling(false);

    if (result.error) {
      Alert.alert('Unable to record payment', result.error.message);
      return;
    }

    closeSettlement();
    await refreshActiveData();
  };

  const handleAddMember = async (email: string) => {
    if (!groupId) return;
    const result = await addGroupMember(groupId, email);
    if (result.error) {
      Alert.alert('Unable to add member', result.error.message);
      return;
    }
    await refreshActiveData();
    await loadMembers(true);
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
            const result = await removeGroupMemberFromGroup(groupId, member.id);
            if (result.error) {
              Alert.alert('Unable to remove member', result.error.message);
              return;
            }
            await refreshActiveData();
          },
        },
      ],
    );
  };

  const settlementName = useMemo(
    () => selectedDebt ? `${selectedDebt.from_name} → ${selectedDebt.to_name}` : '',
    [selectedDebt],
  );

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
            <Pressable style={styles.headerButton} onPress={() => navigation.goBack()} hitSlop={10}>
              <Ionicons name="arrow-back" size={23} color="#FFFFFF" />
            </Pressable>
            <View style={styles.headerCenter}>
              <Text style={styles.headerTitle} numberOfLines={1}>{groupName}</Text>
              <Text style={styles.headerSubtitle}>{currency} • {role}</Text>
            </View>
            <Pressable
              style={styles.headerButton}
              onPress={() => navigation.navigate('GroupSettings', { groupId, groupName })}
              hitSlop={10}
            >
              <Ionicons name="settings-outline" size={21} color="#FFFFFF" />
            </Pressable>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} bounces={false} style={styles.tabsContainer} contentContainerStyle={styles.tabs}>
            {([
              ['Overview', 'home-outline'],
              ...(overview?.type === 'Trip' ? [['Journey', 'map-outline']] : []),
              ['Expenses', 'receipt-outline'],
              ['Balances', 'cash-outline'],
              ['Members', 'people-outline'],
              ['Activity', 'time-outline'],
            ] as Array<[Tab, keyof typeof Ionicons.glyphMap]>).map(([item, icon], index, items) => (
              <Pressable
                key={item}
                style={[styles.tab, index < items.length - 1 && styles.tabSpacing, tab === item && styles.tabActive]}
                onPress={() => setTab(item)}
              >
                <Ionicons name={icon} size={15} color={tab === item ? '#FFFFFF' : '#94A3B8'} />
                <Text style={[styles.tabText, tab === item && styles.tabTextActive]}>{item}</Text>
              </Pressable>
            ))}
          </ScrollView>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#0EA5A4" />}
          >
            {tab === 'Journey' && (
              <>
                <View style={styles.journeyHero}>
                  <View style={styles.journeyHeroIcon}>
                    <Ionicons name="map-outline" size={24} color="#0EA5A4" />
                  </View>
                  <View style={styles.flexOne}>
                    <Text style={styles.journeyEyebrow}>OPTIONAL TRIP PLANNING</Text>
                    <Text style={styles.journeyTitle}>Plan the road, keep spending separate</Text>
                    <Text style={styles.journeySubtitle}>
                      Journey planning is optional. You can add expenses anytime, even without setting up a journey.
                    </Text>
                  </View>
                </View>

                {tripLoading ? (
                  <View style={styles.emptyCard}>
                    <ActivityIndicator size="small" color="#0EA5A4" />
                    <Text style={styles.emptyCardTitle}>Loading journey…</Text>
                  </View>
                ) : !trip ? (
                  <View style={styles.emptyCard}>
                    <View style={styles.journeyEmptyIcon}>
                      <Ionicons name="map-outline" size={27} color="#0EA5A4" />
                    </View>
                    <Text style={styles.emptyCardTitle}>Journey is not set up yet</Text>
                    <Text style={styles.emptyCardText}>
                      Add dates and stops when you are ready. Your group's Expenses tab remains available independently.
                    </Text>
                    <Pressable
                      style={styles.primaryJourneyButton}
                      onPress={() => navigation.navigate('TripDetails', { groupId, groupName })}
                    >
                      <Ionicons name="sparkles-outline" size={16} color="#FFFFFF" />
                      <Text style={styles.primaryJourneyButtonText}>Set up Journey</Text>
                    </Pressable>
                  </View>
                ) : (
                  <>
                    <View style={styles.journeySummaryCard}>
                      <View style={styles.journeySummaryTop}>
                        <View style={styles.flexOne}>
                          <Text style={styles.journeySummaryTitle}>Journey plan</Text>
                          <Text style={styles.journeySummaryMeta}>
                            {trip.start_date && trip.end_date
                              ? `${formatTripDate(trip.start_date)} → ${formatTripDate(trip.end_date)}`
                              : trip.start_date
                                ? `Starts ${formatTripDate(trip.start_date)}`
                                : 'Dates not set'}
                          </Text>
                        </View>
                        <View style={styles.tripPill}>
                          <Ionicons name="airplane-outline" size={13} color="#FFFFFF" />
                          <Text style={styles.tripPillText}>Trip</Text>
                        </View>
                      </View>

                      <View style={styles.journeyStatsRow}>
                        <View style={styles.journeyStat}>
                          <Text style={styles.journeyStatValue}>{getTripDayCount(trip) ?? '—'}</Text>
                          <Text style={styles.journeyStatLabel}>days</Text>
                        </View>
                        <View style={styles.journeyStat}>
                          <Text style={styles.journeyStatValue}>{trip.stops.length}</Text>
                          <Text style={styles.journeyStatLabel}>stops</Text>
                        </View>
                        <View style={styles.journeyStat}>
                          <Text style={styles.journeyStatValue}>
                            {trip.stops.filter((stop) => stop.latitude != null && stop.longitude != null).length}
                          </Text>
                          <Text style={styles.journeyStatLabel}>mapped</Text>
                        </View>
                      </View>

                      {!!trip.notes?.trim() && (
                        <View style={styles.tripNoteBox}>
                          <Ionicons name="document-text-outline" size={16} color="#64748B" />
                          <Text style={styles.tripNoteText}>{trip.notes.trim()}</Text>
                        </View>
                      )}
                    </View>

                    <View style={styles.journeyActionsRow}>
                      <Pressable
                        style={styles.primaryJourneyButtonFlex}
                        onPress={() => navigation.navigate('TripDetails', { groupId, groupName })}
                      >
                        <Ionicons name="create-outline" size={17} color="#FFFFFF" />
                        <Text style={styles.primaryJourneyButtonText}>Plan itinerary</Text>
                      </Pressable>
                      <Pressable
                        style={styles.secondaryJourneyButtonFlex}
                        onPress={() => navigation.navigate('TripMap', { groupId, groupName })}
                      >
                        <Ionicons name="map-outline" size={17} color="#CBD5E1" />
                        <Text style={styles.secondaryJourneyButtonText}>Open map</Text>
                      </Pressable>
                    </View>

                    <View style={styles.sectionHeader}>
                      <View>
                        <Text style={styles.sectionTitle}>Upcoming itinerary</Text>
                        <Text style={styles.sectionSubtitle}>Stops grouped by journey day</Text>
                      </View>
                      <Pressable onPress={() => setTab('Expenses')}>
                        <Text style={styles.linkText}>View expenses</Text>
                      </Pressable>
                    </View>

                    {trip.stops.length === 0 ? (
                      <View style={styles.emptyCard}>
                        <Ionicons name="location-outline" size={28} color="#64748B" />
                        <Text style={styles.emptyCardTitle}>No stops yet</Text>
                        <Text style={styles.emptyCardText}>Add your starting point, stays and destination in the Journey planner.</Text>
                      </View>
                    ) : (
                      <View>
                        {Array.from(new Set(trip.stops.map((stop) => stop.day_number)))
                          .sort((a, b) => a - b)
                          .slice(0, 3)
                          .map((dayNumber) => {
                            const dayStops = trip.stops
                              .filter((stop) => stop.day_number === dayNumber)
                              .sort((a, b) => a.sequence - b.sequence);
                            return (
                              <View key={`day-${dayNumber}`} style={styles.dayPreviewCard}>
                                <Text style={styles.dayPreviewTitle}>{`Day ${dayNumber}`}</Text>
                                <Text style={styles.dayPreviewDate}>
                                  {trip.start_date ? formatTripDate(addDaysIso(trip.start_date, dayNumber - 1)) : 'Date not set'}
                                </Text>
                                {dayStops.slice(0, 3).map((stop, stopIndex) => (
                                  <View key={stop.id} style={styles.dayPreviewStop}>
                                    <View style={styles.dayPreviewDot}>
                                      <Text style={styles.dayPreviewDotText}>{stopIndex + 1}</Text>
                                    </View>
                                    <View style={styles.flexOne}>
                                      <Text style={styles.dayPreviewStopName}>{stop.name}</Text>
                                      <Text style={styles.dayPreviewStopMeta}>
                                        {stop.label || stop.stop_type}
                                      </Text>
                                    </View>
                                  </View>
                                ))}
                              </View>
                            );
                          })}
                        {trip.stops.length > 3 && (
                          <Text style={styles.journeyMoreText}>Open Journey to see the complete itinerary.</Text>
                        )}
                      </View>
                    )}

                    <Pressable style={styles.expensesShortcutCard} onPress={() => setTab('Expenses')}>
                      <View style={styles.expensesShortcutIcon}>
                        <Ionicons name="receipt-outline" size={20} color="#0EA5A4" />
                      </View>
                      <View style={styles.flexOne}>
                        <Text style={styles.expensesShortcutTitle}>Trip expenses live with the group</Text>
                        <Text style={styles.expensesShortcutSubtitle}>Record costs without requiring a journey plan.</Text>
                      </View>
                      <Ionicons name="chevron-forward" size={18} color="#64748B" />
                    </Pressable>
                  </>
                )}
              </>
            )}

            {tab === 'Overview' && (
              <>
                <View style={styles.heroCard}>
                  <Text style={styles.heroLabel}>Your balance</Text>
                  {overview ? (
                    <Text style={styles.heroAmount}>{money(currentBalance?.net_balance || 0, currency)}</Text>
                  ) : (
                    <ActivityIndicator size="small" color="#0EA5A4" style={styles.heroLoader} />
                  )}
                  <Text style={styles.heroHint}>
                    {overview && currentBalance
                      ? Number(currentBalance.net_balance) > 0.005
                        ? 'You are owed'
                        : Number(currentBalance.net_balance) < -0.005
                          ? 'You owe'
                          : 'You are settled'
                      : overview ? 'No balance yet' : 'Loading your balance…'}
                  </Text>
                </View>

                <View style={styles.statRow}>
                  <View style={styles.statCard}>
                    <Text style={styles.statLabel}>Paid</Text>
                    <Text style={styles.statValue}>{overview ? money(currentBalance?.total_paid || 0, currency) : '—'}</Text>
                  </View>
                  <View style={styles.statCard}>
                    <Text style={styles.statLabel}>Your share</Text>
                    <Text style={styles.statValue}>{overview ? money(currentBalance?.total_owed || 0, currency) : '—'}</Text>
                  </View>
                </View>

                <View style={styles.sectionHeader}>
                  <View>
                    <Text style={styles.sectionTitle}>You need to settle</Text>
                    <Text style={styles.sectionSubtitle}>{visibleDebts.length} outstanding relationship{visibleDebts.length === 1 ? '' : 's'}</Text>
                  </View>
                  <Pressable onPress={() => setTab('Balances')}><Text style={styles.linkText}>View all</Text></Pressable>
                </View>

                {!overview ? (
                  <View style={styles.emptyCard}>
                    <ActivityIndicator size="small" color="#0EA5A4" />
                    <Text style={styles.emptyCardTitle}>Loading balances…</Text>
                  </View>
                ) : visibleDebts.length === 0 ? (
                  <View style={styles.emptyCard}>
                    <Ionicons name="checkmark-circle-outline" size={30} color="#0EA5A4" />
                    <Text style={styles.emptyCardTitle}>Everyone is settled</Text>
                  </View>
                ) : visibleDebts.map((debt) => (
                  <View key={`${debt.from_user_id}-${debt.to_user_id}`} style={styles.debtCard}>
                    <View style={styles.debtInfo}>
                      <Text style={styles.debtNames}>{debt.from_name} → {debt.to_name}</Text>
                      <Text style={styles.debtAmount}>{money(debt.amount, currency)}</Text>
                    </View>
                    {canWriteMoney && <Pressable style={styles.smallButton} onPress={() => openSettlement(debt)}><Text style={styles.smallButtonText}>Settle Up</Text></Pressable>}
                  </View>
                ))}

                <View style={styles.sectionHeader}>
                  <View>
                    <Text style={styles.sectionTitle}>Recent expenses</Text>
                    <Text style={styles.sectionSubtitle}>Latest activity in this group</Text>
                  </View>
                  <Pressable onPress={() => setTab('Expenses')}><Text style={styles.linkText}>View all</Text></Pressable>
                </View>

                {!overview ? (
                  <View style={styles.emptyCard}>
                    <ActivityIndicator size="small" color="#0EA5A4" />
                    <Text style={styles.emptyCardTitle}>Loading recent expenses…</Text>
                  </View>
                ) : overview.recent_expenses.length === 0 ? (
                  <View style={styles.emptyCard}>
                    <Ionicons name="receipt-outline" size={28} color="#64748B" />
                    <Text style={styles.emptyCardTitle}>No expenses yet</Text>
                  </View>
                ) : overview.recent_expenses.map((expense) => (
                  <ExpenseCard
                    key={expense.id}
                    expense={{ ...expense, category: expense.category as ExpenseCategory }}
                    currency={currency}
                  />
                ))}
              </>
            )}

            {tab === 'Expenses' && (
              <>
                <View style={styles.sectionHeader}><View><Text style={styles.sectionTitle}>Expenses</Text><Text style={styles.sectionSubtitle}>Group or personal expenses</Text></View></View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
                  {(['all', 'mine'] as const).map((scope) => (
                    <Pressable key={scope} style={[styles.filterChip, expenseScope === scope && styles.filterChipActive]} onPress={() => setExpenseScope(scope)}>
                      <Text style={[styles.filterChipText, expenseScope === scope && styles.filterChipTextActive]}>{scope === 'all' ? 'All group' : 'Mine'}</Text>
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
                  <View style={styles.emptyCard}><Ionicons name="receipt-outline" size={30} color="#64748B" /><Text style={styles.emptyCardTitle}>No expenses yet</Text></View>
                ) : expenses.map((expense) => <ExpenseCard key={expense.id} expense={expense} currency={currency} />)}
              </>
            )}

            {tab === 'Balances' && (
              <>
                <View style={styles.balanceModeCard}>
                  <View style={styles.balanceModeText}><Text style={styles.sectionTitle}>Simplify Debts</Text><Text style={styles.sectionSubtitle}>{simplifyDebts ? 'Show the minimum set of payments' : 'Show direct payer-to-member relationships'}</Text></View>
                  <Switch value={simplifyDebts} onValueChange={setSimplifyDebts} trackColor={{ false: '#334155', true: '#0EA5A4' }} thumbColor="#FFFFFF" />
                </View>
                <Text style={styles.sectionTitle}>Member balances</Text>
                <View style={styles.balanceList}>
                  {balances.map((balance) => {
                    const net = Number(balance.net_balance);
                    return (
                      <View key={balance.user_id} style={styles.balanceCard}>
                        <View style={styles.balanceIdentity}>
                          <View style={styles.avatar}><Text style={styles.avatarText}>{(balance.full_name || balance.email || 'M').charAt(0).toUpperCase()}</Text></View>
                          <View style={styles.flexOne}>
                            <Text style={styles.balanceName} numberOfLines={1}>{balance.full_name || balance.email || 'Member'}</Text>
                            <Text style={styles.balanceMeta}>Paid {money(balance.total_paid, currency)} • Share {money(balance.total_owed, currency)}</Text>
                          </View>
                        </View>
                        <Text style={[styles.balanceNet, net > 0.005 ? styles.positive : net < -0.005 ? styles.negative : styles.settled]}>{displayBalance(balance)}</Text>
                      </View>
                    );
                  })}
                </View>
                <View style={styles.sectionHeader}><View><Text style={styles.sectionTitle}>Who owes whom</Text><Text style={styles.sectionSubtitle}>{visibleDebts.length} relationship{visibleDebts.length === 1 ? '' : 's'}</Text></View></View>
                {visibleDebts.length === 0 ? <View style={styles.emptyCard}><Ionicons name="checkmark-circle-outline" size={30} color="#0EA5A4" /><Text style={styles.emptyCardTitle}>No outstanding debts</Text></View> : visibleDebts.map((debt) => (
                  <View key={`${debt.from_user_id}-${debt.to_user_id}`} style={styles.debtCard}><View style={styles.debtInfo}><Text style={styles.debtNames}>{debt.from_name} → {debt.to_name}</Text><Text style={styles.debtAmount}>{money(debt.amount, currency)}</Text></View>{canWriteMoney && <Pressable style={styles.smallButton} onPress={() => openSettlement(debt)}><Text style={styles.smallButtonText}>Settle Up</Text></Pressable>}</View>
                ))}
              </>
            )}

            {tab === 'Members' && (
              <>
                <View style={styles.sectionHeader}>
                  <View><Text style={styles.sectionTitle}>Members</Text><Text style={styles.sectionSubtitle}>{members.filter((member) => member.status === 'active').length} active</Text></View>
                  {canManageMembers && <Pressable style={styles.addButton} onPress={() => setShowAddMember(true)}><Ionicons name="add" size={18} color="#FFFFFF" /><Text style={styles.addButtonText}>Add</Text></Pressable>}
                </View>
                {members.map((member) => (
                  <MemberCard
                    key={member.id}
                    member={member as any}
                    isOwner={member.role === 'owner'}
                    onRemove={canManageMembers && member.status === 'active' && member.role !== 'owner' && !(role === 'admin' && member.role === 'admin') ? () => handleRemoveMember(member) : undefined}
                  />
                ))}
              </>
            )}

            {tab === 'Activity' && (
              <>
                <View style={styles.sectionHeader}><View><Text style={styles.sectionTitle}>Activity</Text><Text style={styles.sectionSubtitle}>Expenses and settlements</Text></View></View>
                {activityExpenses.length === 0 && settlements.length === 0 ? (
                  <View style={styles.emptyCard}><Ionicons name="time-outline" size={30} color="#64748B" /><Text style={styles.emptyCardTitle}>No activity yet</Text></View>
                ) : <>
                  {activityExpenses.map((expense) => <ExpenseCard key={`expense-${expense.id}`} expense={expense} currency={currency} />)}
                  {settlements.map((settlement) => (
                    <View key={`settlement-${settlement.id}`} style={styles.activityCard}>
                      <View style={styles.activityIcon}><Ionicons name="swap-horizontal-outline" size={20} color="#0EA5A4" /></View>
                      <View style={styles.flexOne}><Text style={styles.activityTitle}>Settlement recorded</Text><Text style={styles.activityMeta}>{settlement.note || 'Settlement'}</Text></View>
                      <Text style={styles.activityAmount}>{money(settlement.amount, currency)}</Text>
                    </View>
                  ))}
                </>}
              </>
            )}
          </ScrollView>

          {canWriteMoney && (tab === 'Overview' || tab === 'Expenses') && (
            <Pressable style={styles.fab} onPress={() => navigation.navigate('AddExpense', { groupId, groupName })}>
              <Ionicons name="add" size={30} color="#FFFFFF" />
            </Pressable>
          )}
        </View>
      </SafeAreaView>

      <AddMemberModal
        visible={showAddMember}
        onClose={() => setShowAddMember(false)}
        onAdd={async (email: string) => { await handleAddMember(email); setShowAddMember(false); }}
      />

      <Modal visible={showSettle} transparent animationType="slide" onRequestClose={closeSettlement}>
        <View style={styles.modalOverlay}>
          <View style={styles.settleSheet}>
            <View style={styles.modalHeader}>
              <View><Text style={styles.modalTitle}>Settle Up</Text><Text style={styles.modalSubtitle}>{settlementName}</Text></View>
              <Pressable onPress={closeSettlement} hitSlop={10}><Ionicons name="close" size={24} color="#FFFFFF" /></Pressable>
            </View>
            <Text style={styles.inputLabel}>Amount</Text>
            <TextInput value={settleAmount} onChangeText={setSettleAmount} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor="#64748B" style={styles.input} />
            <Text style={styles.outstandingText}>Outstanding: {selectedDebt ? money(selectedDebt.amount, currency) : money(0, currency)}</Text>
            <Text style={styles.inputLabel}>Note (optional)</Text>
            <TextInput value={settleNote} onChangeText={setSettleNote} placeholder="UPI payment" placeholderTextColor="#64748B" style={styles.input} maxLength={200} />
            <Pressable style={[styles.primaryButton, settling && styles.disabledButton]} onPress={submitSettlement} disabled={settling}>
              {settling ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={styles.primaryButtonText}>Record Payment</Text>}
            </Pressable>
            <Pressable style={styles.cancelButton} onPress={closeSettlement}><Text style={styles.cancelButtonText}>Cancel</Text></Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#0F172A' },
  container: { flex: 1, backgroundColor: '#0F172A' },
  header: { minHeight: 68, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#1E293B' },
  headerButton: { width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#1E293B' },
  headerCenter: { flex: 1, paddingHorizontal: 12 },
  headerTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '900' },
  headerSubtitle: { color: '#64748B', fontSize: 11, marginTop: 4, textTransform: 'capitalize' },
  tabsContainer: { height: 56, flexGrow: 0, flexShrink: 0, borderBottomWidth: 1, borderBottomColor: '#1E293B' },
  tabs: { flexDirection: 'row', flexGrow: 0, alignSelf: 'flex-start', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8 },
  tab: { height: 40, paddingHorizontal: 11, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', flexGrow: 0, flexShrink: 0, alignSelf: 'flex-start', gap: 6, backgroundColor: '#1E293B' },
  tabSpacing: { marginRight: 7 },
  tabActive: { backgroundColor: '#1E293B' },
  tabText: { color: '#94A3B8', fontSize: 12, fontWeight: '700' },
  tabTextActive: { color: '#FFFFFF' },
  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 120 },
  heroCard: { backgroundColor: '#1E293B', borderRadius: 22, padding: 22, marginBottom: 14 },
  heroLabel: { color: '#94A3B8', fontSize: 12, fontWeight: '700' },
  heroAmount: { color: '#FFFFFF', fontSize: 34, fontWeight: '900', marginTop: 8 },
  heroHint: { color: '#64748B', marginTop: 5, fontSize: 12 },
  heroLoader: { marginTop: 10 },
  statRow: { flexDirection: 'row', gap: 12, marginBottom: 22 },
  statCard: { flex: 1, backgroundColor: '#1E293B', borderRadius: 18, padding: 16 },
  statLabel: { color: '#64748B', fontSize: 11, fontWeight: '700' },
  statValue: { color: '#FFFFFF', fontSize: 18, fontWeight: '900', marginTop: 7 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, marginTop: 6 },
  sectionTitle: { color: '#FFFFFF', fontSize: 16, fontWeight: '900' },
  sectionSubtitle: { color: '#64748B', fontSize: 11, marginTop: 4 },
  linkText: { color: '#0EA5A4', fontSize: 12, fontWeight: '900' },
  debtCard: { backgroundColor: '#1E293B', borderRadius: 16, padding: 15, marginBottom: 10, flexDirection: 'row', alignItems: 'center' },
  debtInfo: { flex: 1, minWidth: 0 },
  debtNames: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  debtAmount: { color: '#FFFFFF', fontSize: 17, fontWeight: '900', marginTop: 6 },
  smallButton: { backgroundColor: '#0EA5A4', borderRadius: 11, paddingHorizontal: 12, paddingVertical: 9, marginLeft: 10 },
  smallButtonText: { color: '#FFFFFF', fontSize: 11, fontWeight: '900' },
  emptyCard: { backgroundColor: '#1E293B', borderRadius: 18, padding: 24, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  emptyCardTitle: { color: '#FFFFFF', fontWeight: '800', marginTop: 9 },
  filterRow: { paddingBottom: 10 },
  filterChip: { backgroundColor: '#1E293B', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9, marginRight: 8, flexDirection: 'row', alignItems: 'center' },
  filterChipActive: { backgroundColor: '#0EA5A4' },
  filterChipText: { color: '#94A3B8', fontSize: 11, fontWeight: '700' },
  filterChipTextActive: { color: '#FFFFFF' },
  balanceModeCard: { backgroundColor: '#1E293B', borderRadius: 18, padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 },
  balanceModeText: { flex: 1, paddingRight: 16 },
  balanceList: { marginTop: 10, marginBottom: 18 },
  balanceCard: { backgroundColor: '#1E293B', borderRadius: 16, padding: 14, marginBottom: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  balanceIdentity: { flexDirection: 'row', alignItems: 'center', flex: 1, minWidth: 0 },
  avatar: { width: 40, height: 40, borderRadius: 13, backgroundColor: '#0F172A', alignItems: 'center', justifyContent: 'center', marginRight: 11 },
  avatarText: { color: '#0EA5A4', fontWeight: '900' },
  balanceName: { color: '#FFFFFF', fontWeight: '800' },
  balanceMeta: { color: '#64748B', fontSize: 10, marginTop: 4 },
  balanceNet: { fontWeight: '900', marginLeft: 10 },
  positive: { color: '#2DD4BF' },
  negative: { color: '#FB7185' },
  settled: { color: '#94A3B8' },
  addButton: { backgroundColor: '#0EA5A4', borderRadius: 12, paddingHorizontal: 11, paddingVertical: 9, flexDirection: 'row', alignItems: 'center', gap: 5 },
  addButtonText: { color: '#FFFFFF', fontWeight: '900', fontSize: 12 },
  activityCard: { backgroundColor: '#1E293B', borderRadius: 16, padding: 15, marginBottom: 10, flexDirection: 'row', alignItems: 'center' },
  activityIcon: { width: 40, height: 40, borderRadius: 13, backgroundColor: '#0F172A', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  activityTitle: { color: '#FFFFFF', fontWeight: '800' },
  activityMeta: { color: '#64748B', fontSize: 11, marginTop: 4 },
  activityAmount: { color: '#FFFFFF', fontWeight: '900' },
  flexOne: { flex: 1, minWidth: 0 },
  fab: { position: 'absolute', right: 20, bottom: 20, width: 62, height: 62, borderRadius: 31, backgroundColor: '#0EA5A4', justifyContent: 'center', alignItems: 'center', elevation: 10, shadowColor: '#000000', shadowOpacity: 0.25, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end' },
  settleSheet: { backgroundColor: '#0F172A', padding: 22, borderTopLeftRadius: 26, borderTopRightRadius: 26 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  modalTitle: { color: '#FFFFFF', fontSize: 25, fontWeight: '900' },
  modalSubtitle: { color: '#94A3B8', marginTop: 5, fontSize: 13 },
  inputLabel: { color: '#CBD5E1', fontWeight: '800', marginBottom: 8 },
  input: { backgroundColor: '#1E293B', borderRadius: 14, color: '#FFFFFF', paddingHorizontal: 15, paddingVertical: 14, marginBottom: 7 },
  outstandingText: { color: '#64748B', fontSize: 12, marginBottom: 16 },
  primaryButton: { backgroundColor: '#0EA5A4', borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginTop: 6 },
  primaryButtonText: { color: '#FFFFFF', fontWeight: '900' },
  cancelButton: { alignItems: 'center', paddingVertical: 15 },
  cancelButtonText: { color: '#94A3B8', fontWeight: '700' },
  disabledButton: { opacity: 0.6 },
  journeyHero: { backgroundColor: '#1E293B', borderRadius: 20, padding: 17, marginBottom: 14, flexDirection: 'row', alignItems: 'flex-start' },
  journeyHeroIcon: { width: 46, height: 46, borderRadius: 14, backgroundColor: '#0F172A', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  journeyEyebrow: { color: '#0EA5A4', fontSize: 9, fontWeight: '900', letterSpacing: 0.9 },
  journeyTitle: { color: '#FFFFFF', fontSize: 17, fontWeight: '900', marginTop: 4 },
  journeySubtitle: { color: '#94A3B8', fontSize: 11, lineHeight: 17, marginTop: 6 },
  journeySummaryCard: { backgroundColor: '#1E293B', borderRadius: 20, padding: 17, marginBottom: 14 },
  journeySummaryTop: { flexDirection: 'row', alignItems: 'flex-start' },
  journeySummaryTitle: { color: '#FFFFFF', fontSize: 17, fontWeight: '900' },
  journeySummaryMeta: { color: '#94A3B8', fontSize: 11, marginTop: 5 },
  tripPill: { backgroundColor: '#0EA5A4', borderRadius: 10, paddingHorizontal: 9, paddingVertical: 6, flexDirection: 'row', alignItems: 'center', gap: 5 },
  tripPillText: { color: '#FFFFFF', fontSize: 10, fontWeight: '900' },
  journeyStatsRow: { flexDirection: 'row', marginTop: 16, borderTopWidth: 1, borderTopColor: '#263247', paddingTop: 14 },
  journeyStat: { flex: 1 },
  journeyStatValue: { color: '#FFFFFF', fontSize: 19, fontWeight: '900' },
  journeyStatLabel: { color: '#64748B', fontSize: 10, marginTop: 3 },
  tripNoteBox: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: '#0F172A', borderRadius: 13, padding: 11, marginTop: 14, gap: 8 },
  tripNoteText: { color: '#94A3B8', fontSize: 11, lineHeight: 16, flex: 1 },
  journeyActionsRow: { flexDirection: 'row', gap: 10, marginBottom: 22 },
  primaryJourneyButton: { marginTop: 14, minHeight: 46, paddingHorizontal: 15, borderRadius: 13, backgroundColor: '#0EA5A4', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 7 },
  primaryJourneyButtonFlex: { flex: 1, minHeight: 46, borderRadius: 13, backgroundColor: '#0EA5A4', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 7 },
  primaryJourneyButtonText: { color: '#FFFFFF', fontSize: 12, fontWeight: '900' },
  secondaryJourneyButtonFlex: { flex: 1, minHeight: 46, borderRadius: 13, backgroundColor: '#1E293B', borderWidth: 1, borderColor: '#334155', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 7 },
  secondaryJourneyButtonText: { color: '#CBD5E1', fontSize: 12, fontWeight: '800' },
  journeyEmptyIcon: { width: 52, height: 52, borderRadius: 17, backgroundColor: '#0F172A', alignItems: 'center', justifyContent: 'center' },
  emptyCardText: { color: '#94A3B8', fontSize: 11, lineHeight: 17, textAlign: 'center', marginTop: 6 },
  dayPreviewCard: { backgroundColor: '#1E293B', borderRadius: 17, padding: 15, marginBottom: 10, borderWidth: 1, borderColor: '#263247' },
  dayPreviewTitle: { color: '#FFFFFF', fontSize: 13, fontWeight: '900' },
  dayPreviewDate: { color: '#0EA5A4', fontSize: 10, fontWeight: '800', marginTop: 3 },
  dayPreviewStop: { flexDirection: 'row', alignItems: 'center', marginTop: 12 },
  dayPreviewDot: { width: 28, height: 28, borderRadius: 10, backgroundColor: '#0F172A', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  dayPreviewDotText: { color: '#0EA5A4', fontSize: 10, fontWeight: '900' },
  dayPreviewStopName: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  dayPreviewStopMeta: { color: '#64748B', fontSize: 10, marginTop: 3, textTransform: 'capitalize' },
  journeyMoreText: { color: '#64748B', fontSize: 10, textAlign: 'center', marginVertical: 4 },
  expensesShortcutCard: { backgroundColor: '#1E293B', borderRadius: 18, padding: 14, flexDirection: 'row', alignItems: 'center', marginTop: 8, borderWidth: 1, borderColor: '#263247' },
  expensesShortcutIcon: { width: 42, height: 42, borderRadius: 13, backgroundColor: '#0F172A', alignItems: 'center', justifyContent: 'center', marginRight: 11 },
  expensesShortcutTitle: { color: '#FFFFFF', fontSize: 12, fontWeight: '900' },
  expensesShortcutSubtitle: { color: '#64748B', fontSize: 10, lineHeight: 15, marginTop: 3 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  loadingText: { color: '#94A3B8', marginTop: 12 },
  emptyTitle: { color: '#FFFFFF', fontWeight: '900', fontSize: 20 },
});
