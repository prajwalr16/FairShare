import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

import GroupCard from '../../components/GroupCard';
import CreateGroupModal from '../../components/CreateGroupModal';
import UniversalScrollView from '../../components/UniversalScrollView';
import { Theme } from '../../theme/theme';
import { formatCurrency } from '../../utils/currency';
import { registerPushNotificationToken } from '../../services/notificationService';
import {
  createGroup,
  getCachedGroups,
  getGroups,
  GroupSummary,
} from '../../services/groupService';

type Filter = 'All' | 'Trip' | 'Home' | 'Friends' | 'Office' | 'Other';

const filters: Array<{ key: Filter; label: string; icon: keyof typeof Ionicons.glyphMap }> = [
  { key: 'All', label: 'All', icon: 'apps-outline' },
  { key: 'Trip', label: 'Trips', icon: 'airplane-outline' },
  { key: 'Home', label: 'Home', icon: 'home-outline' },
  { key: 'Friends', label: 'Friends', icon: 'people-outline' },
  { key: 'Office', label: 'Office', icon: 'briefcase-outline' },
  { key: 'Other', label: 'Other', icon: 'grid-outline' },
];

function getErrorMessage(error: any) {
  return error?.message || 'Unable to load your groups. Please try again.';
}

export default function HomeScreen() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();

  const [groups, setGroups] = useState<GroupSummary[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [filter, setFilter] = useState<Filter>('All');

  // Animation values for smooth entrance and button springs
  const heroFade = useRef(new Animated.Value(0)).current;
  const heroTranslate = useRef(new Animated.Value(14)).current;
  const createBtnScale = useRef(new Animated.Value(1)).current;

  const loadGroups = useCallback(async () => {
    const result = await getGroups();

    if (result.error) {
      setLoading(false);
      setError(getErrorMessage(result.error));
      return false;
    }

    setGroups(result.data || []);
    setError(null);
    setLoading(false);
    return true;
  }, []);

  useEffect(() => {
    let active = true;

    // Trigger hero entrance animation
    Animated.parallel([
      Animated.timing(heroFade, {
        toValue: 1,
        duration: 450,
        useNativeDriver: true,
      }),
      Animated.spring(heroTranslate, {
        toValue: 0,
        speed: 12,
        bounciness: 4,
        useNativeDriver: true,
      }),
    ]).start();

    // Register push notification token (free zero-cost notification setup)
    void registerPushNotificationToken();

    const loadCachedGroups = async () => {
      try {
        const cached = await getCachedGroups();
        if (!active || !cached) return;
        setGroups(cached);
        setError(null);
        setLoading(false);
      } catch {
        // Cache is optional
      }
    };

    void loadCachedGroups();
    void loadGroups();

    return () => {
      active = false;
    };
  }, [loadGroups]);

  // Aggregate user's overall financial position across all groups
  const portfolioStats = useMemo(() => {
    let totalNet = 0;
    let totalYouGet = 0;
    let totalYouOwe = 0;
    let overallSpend = 0;

    groups.forEach((g) => {
      const net = Number(g.user_net_balance ?? 0);
      const totalExp = Number(g.total_expenses ?? 0);

      totalNet += net;
      overallSpend += totalExp;

      if (net > 0.005) {
        totalYouGet += net;
      } else if (net < -0.005) {
        totalYouOwe += Math.abs(net);
      }
    });

    return {
      totalNet,
      totalYouGet,
      totalYouOwe,
      overallSpend,
      isPositive: totalNet > 0.005,
      isNegative: totalNet < -0.005,
      isSettled: Math.abs(totalNet) <= 0.005,
    };
  }, [groups]);

  const filteredGroups = useMemo(
    () => (filter === 'All' ? groups : groups.filter((group) => group.type === filter)),
    [filter, groups],
  );

  const filterCounts = useMemo(() => {
    const counts: Record<Filter, number> = {
      All: groups.length,
      Trip: 0,
      Home: 0,
      Friends: 0,
      Office: 0,
      Other: 0,
    };

    groups.forEach((group) => {
      const type = group.type as Exclude<Filter, 'All'>;
      if (type in counts) counts[type] += 1;
    });

    return counts;
  }, [groups]);

  const handleCreateGroup = async (group: any) => {
    const result = await createGroup(group);
    if (result.error) {
      setError(getErrorMessage(result.error));
      return;
    }

    setShowCreate(false);
    setError(null);
    setFilter(group.type === 'Trip' ? 'Trip' : 'All');
    await loadGroups();
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await loadGroups();
    } finally {
      setRefreshing(false);
    }
  };

  const handleCreatePressIn = () => {
    Animated.spring(createBtnScale, {
      toValue: 0.96,
      useNativeDriver: true,
      speed: 30,
    }).start();
  };

  const handleCreatePressOut = () => {
    Animated.spring(createBtnScale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 20,
      bounciness: 6,
    }).start();
  };

  return (
    <>
      <StatusBar barStyle="light-content" backgroundColor="#06090F" />
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <View style={styles.container}>
          {/* Top Luxury CRED Glass Navigation Bar */}
          <View style={styles.header}>
            <View style={styles.brandRow}>
              <View style={styles.logoBadge}>
                <Ionicons name="sparkles" size={13} color="#00E5FF" />
              </View>
              <View>
                <Text style={styles.brandTitle}>FAIRSHARE</Text>
                <Text style={styles.brandSubtitle}>PORTFOLIO INTELLIGENCE</Text>
              </View>
            </View>

            <View style={styles.headerActions}>
              <Pressable
                style={styles.headerIconBtn}
                onPress={() => void handleRefresh()}
                hitSlop={8}
              >
                <Ionicons name="refresh-outline" size={18} color="#94A3B8" />
              </Pressable>

              <Pressable
                style={styles.profileBtn}
                onPress={() => navigation.navigate('Profile')}
                hitSlop={8}
              >
                <Ionicons name="person" size={16} color="#00E5FF" />
              </Pressable>
            </View>
          </View>

          {/* Interactive FlatList with Custom Luxury Header Component */}
          <FlatList
            data={filteredGroups}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[styles.listContent, { paddingBottom: 120 }]}
            renderScrollComponent={Platform.OS === 'web' ? (props) => (
              <UniversalScrollView
                refreshing={refreshing}
                onRefresh={handleRefresh}
                refreshTintColor="#00E5FF"
                {...props}
              />
            ) : undefined}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                tintColor="#00E5FF"
                onRefresh={handleRefresh}
              />
            }
            ListHeaderComponent={
              <Animated.View
                style={[
                  styles.heroContainer,
                  {
                    opacity: heroFade,
                    transform: [{ translateY: heroTranslate }],
                  },
                ]}
              >
                {/* Hero Statement Card */}
                <View style={styles.heroCard}>
                  {/* Subtle Top Glowing Strip */}
                  <View
                    style={[
                      styles.heroGlowStrip,
                      {
                        backgroundColor: portfolioStats.isPositive
                          ? Theme.colors.positive
                          : portfolioStats.isNegative
                          ? Theme.colors.negative
                          : Theme.colors.primary,
                      },
                    ]}
                  />

                  {/* Eyebrow Position Badge */}
                  <View style={styles.heroEyebrowRow}>
                    <View style={styles.heroStatusDot} />
                    <Text style={styles.heroEyebrow}>GLOBAL NET POSITION</Text>
                    <View style={styles.activePill}>
                      <Text style={styles.activePillText}>{groups.length} CIRCLES</Text>
                    </View>
                  </View>

                  {/* Main Monetary Net Statement */}
                  <View style={styles.amountDisplayRow}>
                    <Text
                      style={[
                        styles.heroAmount,
                        portfolioStats.isPositive && styles.heroAmountPositive,
                        portfolioStats.isNegative && styles.heroAmountNegative,
                        portfolioStats.isSettled && styles.heroAmountSettled,
                      ]}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                    >
                      {portfolioStats.isPositive
                        ? `+${formatCurrency(portfolioStats.totalNet, 'INR')}`
                        : portfolioStats.isNegative
                        ? `-${formatCurrency(Math.abs(portfolioStats.totalNet), 'INR')}`
                        : formatCurrency(0, 'INR')}
                    </Text>
                  </View>

                  <Text style={styles.heroPositionDesc}>
                    {portfolioStats.isPositive
                      ? '✦ You are owed overall across your groups'
                      : portfolioStats.isNegative
                      ? '✦ You owe in total across your groups'
                      : '✦ All balances settled up across all groups'}
                  </Text>

                  {/* Dual Stat Glass Pods */}
                  <View style={styles.statPodsRow}>
                    {/* Pod 1: You Get */}
                    <View style={[styles.statPod, styles.statPodGet]}>
                      <View style={styles.podHeader}>
                        <View style={[styles.podIconCircle, { backgroundColor: 'rgba(0, 245, 160, 0.2)' }]}>
                          <Ionicons name="arrow-up" size={13} color="#00F5A0" />
                        </View>
                        <Text style={styles.podLabelGet}>YOU GET</Text>
                      </View>
                      <Text style={styles.podAmountGet} numberOfLines={1}>
                        {formatCurrency(portfolioStats.totalYouGet, 'INR')}
                      </Text>
                      <Text style={styles.podSubtext}>receivable</Text>
                    </View>

                    {/* Pod 2: You Owe */}
                    <View style={[styles.statPod, styles.statPodOwe]}>
                      <View style={styles.podHeader}>
                        <View style={[styles.podIconCircle, { backgroundColor: 'rgba(255, 75, 114, 0.2)' }]}>
                          <Ionicons name="arrow-down" size={13} color="#FF4B72" />
                        </View>
                        <Text style={styles.podLabelOwe}>YOU OWE</Text>
                      </View>
                      <Text style={styles.podAmountOwe} numberOfLines={1}>
                        {formatCurrency(portfolioStats.totalYouOwe, 'INR')}
                      </Text>
                      <Text style={styles.podSubtext}>to pay back</Text>
                    </View>
                  </View>

                  {/* Overall Group Volume Footer */}
                  <View style={styles.volumeFooter}>
                    <Ionicons name="pie-chart-outline" size={12} color="#64748B" />
                    <Text style={styles.volumeText}>
                      Combined volume across groups:{' '}
                      <Text style={styles.volumeAmount}>
                        {formatCurrency(portfolioStats.overallSpend, 'INR')}
                      </Text>
                    </Text>
                  </View>

                  {/* Quick Action Dock */}
                  <View style={styles.actionDock}>
                    <Animated.View style={{ flex: 1, transform: [{ scale: createBtnScale }] }}>
                      <Pressable
                        onPress={() => setShowCreate(true)}
                        onPressIn={handleCreatePressIn}
                        onPressOut={handleCreatePressOut}
                        style={styles.primaryActionBtn}
                      >
                        <Ionicons name="add-circle" size={18} color="#06090F" />
                        <Text style={styles.primaryActionText}>CREATE NEW GROUP</Text>
                      </Pressable>
                    </Animated.View>
                  </View>
                </View>

                {/* Filter Capsule Dock */}
                <View style={styles.filterSection}>
                  <FlatList
                    data={filters}
                    horizontal
                    keyExtractor={(item) => item.key}
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.filterScroll}
                    renderItem={({ item }) => {
                      const active = filter === item.key;
                      return (
                        <Pressable
                          style={[styles.filterCapsule, active && styles.filterCapsuleActive]}
                          onPress={() => setFilter(item.key)}
                        >
                          <Ionicons
                            name={item.icon}
                            size={13}
                            color={active ? '#00E5FF' : '#64748B'}
                          />
                          <Text
                            style={[styles.filterCapsuleText, active && styles.filterCapsuleTextActive]}
                          >
                            {item.label}
                          </Text>
                          <View
                            style={[styles.filterCountBadge, active && styles.filterCountBadgeActive]}
                          >
                            <Text
                              style={[
                                styles.filterCountText,
                                active && styles.filterCountTextActive,
                              ]}
                            >
                              {filterCounts[item.key]}
                            </Text>
                          </View>
                        </Pressable>
                      );
                    }}
                  />
                </View>

                {/* Section Header */}
                <View style={styles.sectionTitleRow}>
                  <Text style={styles.sectionTitle}>
                    {filter === 'All' ? 'YOUR ACTIVE CIRCLES' : `${filter.toUpperCase()} CIRCLES`}
                  </Text>
                  <Text style={styles.sectionCount}>
                    {filteredGroups.length} {filteredGroups.length === 1 ? 'GROUP' : 'GROUPS'}
                  </Text>
                </View>
              </Animated.View>
            }
            renderItem={({ item }) => (
              <GroupCard
                group={item}
                onPress={() => navigation.navigate('GroupDetails', { groupId: item.id })}
              />
            )}
            ListEmptyComponent={
              loading ? (
                <View style={styles.emptyState}>
                  <ActivityIndicator size="small" color="#00E5FF" />
                  <Text style={styles.emptyTitle}>Synchronizing portfolio…</Text>
                </View>
              ) : error ? (
                <View style={styles.emptyState}>
                  <Ionicons name="alert-circle-outline" size={32} color="#FF4B72" />
                  <Text style={styles.emptyErrorTitle}>Sync Issue</Text>
                  <Text style={styles.emptyDesc}>{error}</Text>
                  <Pressable style={styles.retryBtn} onPress={() => void loadGroups()}>
                    <Text style={styles.retryBtnText}>RETRY</Text>
                  </Pressable>
                </View>
              ) : (
                <View style={styles.emptyState}>
                  <View style={styles.emptyIconCircle}>
                    <Ionicons name="layers-outline" size={30} color="#00E5FF" />
                  </View>
                  <Text style={styles.emptyTitle}>No groups in this filter</Text>
                  <Text style={styles.emptyDesc}>
                    Create a group to track shared trips, household rent, or group dinners effortlessly.
                  </Text>
                  <Pressable
                    style={styles.emptyActionBtn}
                    onPress={() => setShowCreate(true)}
                  >
                    <Ionicons name="add" size={16} color="#06090F" />
                    <Text style={styles.emptyActionText}>CREATE GROUP</Text>
                  </Pressable>
                </View>
              )
            }
          />

          {/* Floating Create Button */}
          {filteredGroups.length > 3 && (
            <Pressable
              style={styles.floatingFab}
              onPress={() => setShowCreate(true)}
              hitSlop={12}
            >
              <Ionicons name="add" size={26} color="#06090F" />
            </Pressable>
          )}

          {showCreate && (
            <CreateGroupModal
              visible={showCreate}
              onClose={() => setShowCreate(false)}
              onCreate={handleCreateGroup}
            />
          )}
        </View>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#06090F',
  },
  container: {
    flex: 1,
    backgroundColor: '#06090F',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  logoBadge: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: 'rgba(0, 229, 255, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  brandTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  brandSubtitle: {
    color: '#64748B',
    fontSize: 8.5,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginTop: 1,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileBtn: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: 'rgba(0, 229, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  heroContainer: {
    marginBottom: 16,
  },
  heroCard: {
    backgroundColor: '#0B101E',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.09)',
    overflow: 'hidden',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.45,
    shadowRadius: 18,
    elevation: 8,
  },
  heroGlowStrip: {
    position: 'absolute',
    top: 0,
    left: 24,
    right: 24,
    height: 2,
    opacity: 0.6,
  },
  heroEyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  heroStatusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#00E5FF',
    marginRight: 6,
  },
  heroEyebrow: {
    flex: 1,
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.3,
  },
  activePill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  activePillText: {
    color: '#CBD5E1',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  amountDisplayRow: {
    marginVertical: 4,
  },
  heroAmount: {
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  heroAmountPositive: {
    color: '#00F5A0',
  },
  heroAmountNegative: {
    color: '#FF4B72',
  },
  heroAmountSettled: {
    color: '#FFFFFF',
  },
  heroPositionDesc: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '500',
    marginTop: 2,
    marginBottom: 16,
  },
  statPodsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  statPod: {
    flex: 1,
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
  },
  statPodGet: {
    backgroundColor: 'rgba(0, 245, 160, 0.06)',
    borderColor: 'rgba(0, 245, 160, 0.22)',
  },
  statPodOwe: {
    backgroundColor: 'rgba(255, 75, 114, 0.06)',
    borderColor: 'rgba(255, 75, 114, 0.22)',
  },
  podHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  podIconCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  podLabelGet: {
    color: '#00F5A0',
    fontSize: 9.5,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  podLabelOwe: {
    color: '#FF4B72',
    fontSize: 9.5,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  podAmountGet: {
    color: '#00F5A0',
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: -0.2,
  },
  podAmountOwe: {
    color: '#FF4B72',
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: -0.2,
  },
  podSubtext: {
    color: '#64748B',
    fontSize: 9,
    fontWeight: '600',
    marginTop: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  volumeFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
    marginBottom: 14,
  },
  volumeText: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '500',
  },
  volumeAmount: {
    color: '#CBD5E1',
    fontWeight: '700',
  },
  actionDock: {
    flexDirection: 'row',
    gap: 10,
  },
  primaryActionBtn: {
    backgroundColor: '#00E5FF',
    borderRadius: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    shadowColor: '#00E5FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryActionText: {
    color: '#06090F',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1,
  },
  filterSection: {
    marginTop: 18,
    marginBottom: 14,
  },
  filterScroll: {
    gap: 8,
  },
  filterCapsule: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: '#0B101E',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  filterCapsuleActive: {
    backgroundColor: 'rgba(0, 229, 255, 0.1)',
    borderColor: 'rgba(0, 229, 255, 0.4)',
  },
  filterCapsuleText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '700',
  },
  filterCapsuleTextActive: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  filterCountBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  filterCountBadgeActive: {
    backgroundColor: 'rgba(0, 229, 255, 0.25)',
  },
  filterCountText: {
    color: '#64748B',
    fontSize: 10,
    fontWeight: '800',
  },
  filterCountTextActive: {
    color: '#00E5FF',
  },
  sectionTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  sectionTitle: {
    color: '#94A3B8',
    fontSize: 10.5,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  sectionCount: {
    color: '#64748B',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    paddingHorizontal: 24,
  },
  emptyIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 229, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 6,
  },
  emptyErrorTitle: {
    color: '#FF4B72',
    fontSize: 16,
    fontWeight: '800',
    marginTop: 8,
    marginBottom: 4,
  },
  emptyDesc: {
    color: '#64748B',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 18,
  },
  emptyActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#00E5FF',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
  },
  emptyActionText: {
    color: '#06090F',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  retryBtn: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 75, 114, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255, 75, 114, 0.35)',
  },
  retryBtnText: {
    color: '#FF4B72',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  floatingFab: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#00E5FF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#00E5FF',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 10,
    elevation: 8,
  },
});
