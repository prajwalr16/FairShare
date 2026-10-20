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
import BrandLogo from '../../components/BrandLogo';
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
            <BrandLogo size="sm" showText={true} />

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
                {/* Hero Statement Card - Compact Executive HUD */}
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

                  {/* Top Row: Eyebrow + Active Circles Count */}
                  <View style={styles.heroEyebrowRow}>
                    <View style={styles.heroStatusDot} />
                    <Text style={styles.heroEyebrow}>TOTAL BALANCE</Text>
                    <View style={styles.activePill}>
                      <Text style={styles.activePillText}>{groups.length} {groups.length === 1 ? 'GROUP' : 'GROUPS'}</Text>
                    </View>
                  </View>

                  {/* Core 2-Column Row: Left Amount, Right Mini Pods */}
                  <View style={styles.heroCoreRow}>
                    <View style={styles.heroAmountCol}>
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
                      <Text style={styles.heroPositionDesc}>
                        {portfolioStats.isPositive
                          ? '✦ You are owed overall'
                          : portfolioStats.isNegative
                          ? '✦ You owe in total'
                          : '✦ All settled up'}
                      </Text>
                    </View>

                    <View style={styles.heroMiniPodsCol}>
                      {/* Mini Pod: You Get */}
                      <View style={[styles.miniPod, styles.miniPodGet]}>
                        <View style={styles.miniPodHeader}>
                          <Ionicons name="arrow-up" size={10} color="#00F5A0" />
                          <Text style={styles.miniPodLabelGet}>GET</Text>
                        </View>
                        <Text style={styles.miniPodValueGet} numberOfLines={1}>
                          {formatCurrency(portfolioStats.totalYouGet, 'INR')}
                        </Text>
                      </View>

                      {/* Mini Pod: You Owe */}
                      <View style={[styles.miniPod, styles.miniPodOwe]}>
                        <View style={styles.miniPodHeader}>
                          <Ionicons name="arrow-down" size={10} color="#FF4B72" />
                          <Text style={styles.miniPodLabelOwe}>OWE</Text>
                        </View>
                        <Text style={styles.miniPodValueOwe} numberOfLines={1}>
                          {formatCurrency(portfolioStats.totalYouOwe, 'INR')}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* Compact Bottom Footer: Volume on left, New Group button on right */}
                  <View style={styles.heroBottomRow}>
                    <Text style={styles.volumeText} numberOfLines={1}>
                      Total volume: <Text style={styles.volumeAmount}>{formatCurrency(portfolioStats.overallSpend, 'INR')}</Text>
                    </Text>

                    <Pressable
                      onPress={() => setShowCreate(true)}
                      style={styles.compactCreateBtn}
                    >
                      <Ionicons name="add" size={14} color="#06090F" />
                      <Text style={styles.compactCreateBtnText}>NEW GROUP</Text>
                    </Pressable>
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
                    {filter === 'All' ? 'YOUR GROUPS' : `${filter.toUpperCase()} GROUPS`}
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
    marginBottom: 10,
  },
  heroCard: {
    backgroundColor: '#0B101E',
    borderRadius: 20,
    padding: 15,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.09)',
    overflow: 'hidden',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  heroGlowStrip: {
    position: 'absolute',
    top: 0,
    left: 20,
    right: 20,
    height: 2,
    opacity: 0.6,
  },
  heroEyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  heroStatusDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#00E5FF',
    marginRight: 6,
  },
  heroEyebrow: {
    flex: 1,
    color: '#94A3B8',
    fontSize: 9.5,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  activePill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  activePillText: {
    color: '#CBD5E1',
    fontSize: 8.5,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  heroCoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginVertical: 4,
  },
  heroAmountCol: {
    flex: 1,
    minWidth: 0,
    marginRight: 12,
  },
  heroAmount: {
    fontSize: 25,
    fontWeight: '900',
    letterSpacing: -0.4,
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
    fontSize: 10.5,
    fontWeight: '500',
    marginTop: 2,
  },
  heroMiniPodsCol: {
    gap: 6,
  },
  miniPod: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    minWidth: 115,
    justifyContent: 'space-between',
  },
  miniPodGet: {
    backgroundColor: 'rgba(0, 245, 160, 0.08)',
    borderColor: 'rgba(0, 245, 160, 0.28)',
  },
  miniPodOwe: {
    backgroundColor: 'rgba(255, 75, 114, 0.08)',
    borderColor: 'rgba(255, 75, 114, 0.28)',
  },
  miniPodHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  miniPodLabelGet: {
    color: '#00F5A0',
    fontSize: 8.5,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  miniPodLabelOwe: {
    color: '#FF4B72',
    fontSize: 8.5,
    fontWeight: '900',
    letterSpacing: 0.6,
  },
  miniPodValueGet: {
    color: '#00F5A0',
    fontSize: 11.5,
    fontWeight: '900',
    marginLeft: 6,
  },
  miniPodValueOwe: {
    color: '#FF4B72',
    fontSize: 11.5,
    fontWeight: '900',
    marginLeft: 6,
  },
  heroBottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
    marginTop: 6,
  },
  volumeText: {
    color: '#64748B',
    fontSize: 10.5,
    fontWeight: '500',
    flex: 1,
    marginRight: 8,
  },
  volumeAmount: {
    color: '#CBD5E1',
    fontWeight: '700',
  },
  compactCreateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#00E5FF',
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 8,
    shadowColor: '#00E5FF',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
  },
  compactCreateBtnText: {
    color: '#06090F',
    fontSize: 9.5,
    fontWeight: '900',
    letterSpacing: 0.6,
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
