import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
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
import {
  createGroup,
  getCachedGroups,
  getGroups,
  prefetchGroupOverview,
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

    // Cache is an optimization only. Do not await it before starting the
    // authoritative API request, otherwise a web storage/session issue can
    // leave the screen stuck on "Loading groups…" without ever calling
    // GET /groups.
    const loadCachedGroups = async () => {
      try {
        const cached = await getCachedGroups();
        if (!active || !cached) return;

        setGroups(cached);
        setError(null);
        setLoading(false);
      } catch {
        // Persistent cache is optional. The API request below is authoritative.
      }
    };

    void loadCachedGroups();
    void loadGroups();

    return () => {
      active = false;
    };
  }, [loadGroups]);

  const filteredGroups = useMemo(
    () =>
      filter === 'All'
        ? groups
        : groups.filter((group) => group.type === filter),
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

  return (
    <>
      <StatusBar barStyle="light-content" backgroundColor="#0F172A" />
      <SafeAreaView
        style={styles.safeArea}
        edges={['top', 'bottom', 'left', 'right']}
      >
        <View style={styles.container}>
          <View style={styles.header}>
            <View style={styles.headerCopy}>
              <Text style={styles.eyebrow}>FairShare</Text>
              <Text style={styles.title}>Your Groups</Text>
              <Text style={styles.subtitle}>Split expenses. Share memories.</Text>
            </View>
            <View style={styles.headerActions}>
              <Pressable
                style={styles.headerIcon}
                onPress={() => navigation.navigate('Profile')}
                hitSlop={8}
              >
                <Ionicons name="person-circle-outline" size={22} color="#CBD5E1" />
              </Pressable>
              <Pressable
                style={styles.headerIcon}
                onPress={() => void handleRefresh()}
                hitSlop={8}
              >
                <Ionicons name="refresh-outline" size={20} color="#CBD5E1" />
              </Pressable>
            </View>
          </View>

          <FlatList
            data={filters}
            horizontal
            keyExtractor={(item) => item.key}
            showsHorizontalScrollIndicator={false}
            style={styles.filterList}
            contentContainerStyle={styles.filterContent}
            renderItem={({ item }) => {
              const active = filter === item.key;
              return (
                <Pressable
                  style={[styles.filterChip, active && styles.filterChipActive]}
                  onPress={() => setFilter(item.key)}
                >
                  <Ionicons
                    name={item.icon}
                    size={14}
                    color={active ? '#FFFFFF' : '#94A3B8'}
                  />
                  <Text style={[styles.filterText, active && styles.filterTextActive]}>
                    {item.label}
                  </Text>
                  <View style={[styles.countBadge, active && styles.countBadgeActive]}>
                    <Text style={[styles.countText, active && styles.countTextActive]}>
                      {filterCounts[item.key]}
                    </Text>
                  </View>
                </Pressable>
              );
            }}
          />

          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionTitle}>
                {filter === 'All' ? 'All groups' : `${filters.find((item) => item.key === filter)?.label || filter}`}
              </Text>
              <Text style={styles.sectionSubtitle}>
                {filteredGroups.length} {filteredGroups.length === 1 ? 'group' : 'groups'}
              </Text>
            </View>
          </View>

          <FlatList
            data={filteredGroups}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[styles.listContent, { paddingBottom: 150 }]}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                tintColor="#0EA5A4"
                onRefresh={handleRefresh}
              />
            }
            ListEmptyComponent={
              loading ? (
                <View style={styles.emptyState}>
                  <ActivityDots />
                  <Text style={styles.emptyTitle}>Loading groups…</Text>
                </View>
              ) : error ? (
                <View style={styles.emptyState}>
                  <View style={styles.emptyIcon}>
                    <Ionicons name="alert-circle-outline" size={30} color="#0EA5A4" />
                  </View>
                  <Text style={styles.emptyTitle}>Unable to load groups</Text>
                  <Text style={styles.emptySubtitle}>{error}</Text>
                  <Pressable style={styles.retryButton} onPress={() => void loadGroups()}>
                    <Ionicons name="refresh-outline" size={16} color="#FFFFFF" />
                    <Text style={styles.retryButtonText}>Retry</Text>
                  </Pressable>
                </View>
              ) : (
                <View style={styles.emptyState}>
                  <View style={styles.emptyIcon}>
                    <Ionicons
                      name={filter === 'Trip' ? 'airplane-outline' : 'people-outline'}
                      size={30}
                      color="#0EA5A4"
                    />
                  </View>
                  <Text style={styles.emptyTitle}>
                    {filter === 'All' ? 'No groups yet' : `No ${filter.toLowerCase()} groups`}
                  </Text>
                  <Text style={styles.emptySubtitle}>
                    {filter === 'Trip'
                      ? 'Create a Trip group. Journey planning is optional and lives inside that group.'
                      : 'Create a group to start splitting expenses with your people.'}
                  </Text>
                </View>
              )
            }
            renderItem={({ item }) => (
              <GroupCard
                group={item}
                onPress={() => {
                  void prefetchGroupOverview(item.id);
                  navigation.navigate('GroupDetails', {
                    groupId: item.id,
                    groupName: item.name,
                  });
                }}
              />
            )}
          />

          <Pressable
            style={[styles.fab, { bottom: Math.max(insets.bottom + 20, 26) }]}
            onPress={() => setShowCreate(true)}
          >
            <Ionicons name="add" size={30} color="#FFFFFF" />
          </Pressable>

          <CreateGroupModal
            visible={showCreate}
            onClose={() => setShowCreate(false)}
            onCreate={handleCreateGroup}
          />
        </View>
      </SafeAreaView>
    </>
  );
}

function ActivityDots() {
  return (
    <View style={styles.activityDots}>
      <View style={[styles.dot, styles.dotOne]} />
      <View style={[styles.dot, styles.dotTwo]} />
      <View style={[styles.dot, styles.dotThree]} />
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#0F172A' },
  container: { flex: 1, backgroundColor: '#0F172A', paddingHorizontal: 18 },
  header: {
    paddingTop: 8,
    paddingBottom: 14,
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  headerCopy: { flex: 1, minWidth: 0 },
  eyebrow: { color: '#0EA5A4', fontSize: 12, fontWeight: '900', letterSpacing: 1, textTransform: 'uppercase' },
  title: { color: '#FFFFFF', fontSize: 28, fontWeight: '900', marginTop: 4 },
  subtitle: { color: '#64748B', fontSize: 12, marginTop: 5 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 8, marginLeft: 10 },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#263247',
  },
  filterList: { flexGrow: 0, height: 48, marginBottom: 8 },
  filterContent: { alignItems: 'center', paddingRight: 4 },
  filterChip: { minHeight: 38, paddingLeft: 11, paddingRight: 8, borderRadius: 12, backgroundColor: '#1E293B', borderWidth: 1, borderColor: '#263247', flexDirection: 'row', alignItems: 'center', marginRight: 8, gap: 6 },
  filterChipActive: { backgroundColor: '#0EA5A4', borderColor: '#0EA5A4' },
  filterText: { color: '#94A3B8', fontSize: 11, fontWeight: '800' },
  filterTextActive: { color: '#FFFFFF' },
  countBadge: { minWidth: 21, height: 21, borderRadius: 10, backgroundColor: '#0F172A', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  countBadgeActive: { backgroundColor: 'rgba(255,255,255,0.18)' },
  countText: { color: '#64748B', fontSize: 9, fontWeight: '900' },
  countTextActive: { color: '#FFFFFF' },
  sectionHeader: { paddingTop: 4, paddingBottom: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { color: '#FFFFFF', fontSize: 17, fontWeight: '900' },
  sectionSubtitle: { color: '#64748B', fontSize: 11, marginTop: 3 },
  listContent: { paddingTop: 1 },
  emptyState: { alignItems: 'center', marginTop: 90, paddingHorizontal: 24 },
  emptyIcon: { width: 66, height: 66, borderRadius: 21, backgroundColor: '#1E293B', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#263247' },
  emptyTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '800', marginTop: 14, textAlign: 'center' },
  emptySubtitle: { color: '#94A3B8', textAlign: 'center', marginTop: 7, lineHeight: 20, fontSize: 12 },
  activityDots: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 8 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#0EA5A4' },
  dotOne: { opacity: 0.4 },
  dotTwo: { opacity: 0.7 },
  dotThree: { opacity: 1 },
  retryButton: { marginTop: 16, minHeight: 44, paddingHorizontal: 16, borderRadius: 13, backgroundColor: '#0EA5A4', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 7 },
  retryButtonText: { color: '#FFFFFF', fontSize: 12, fontWeight: '900' },
  fab: { position: 'absolute', right: 20, width: 60, height: 60, borderRadius: 30, backgroundColor: '#0EA5A4', justifyContent: 'center', alignItems: 'center', elevation: 12, shadowColor: '#000000', shadowOpacity: 0.28, shadowRadius: 10, shadowOffset: { width: 0, height: 5 } },
});
