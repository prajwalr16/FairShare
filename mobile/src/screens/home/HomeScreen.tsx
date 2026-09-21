import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
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
import { createGroup, getCachedGroups, getGroups, prefetchGroupOverview, GroupSummary } from '../../services/groupService';

export default function HomeScreen() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const [groups, setGroups] = useState<GroupSummary[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  const loadGroups = useCallback(async (background = false) => {
    const result = await getGroups();
    if (result.error) {
      if (!background) Alert.alert('Unable to load groups', result.error.message);
      return;
    }
    setGroups(result.data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      const cached = await getCachedGroups();
      if (active && cached) {
        setGroups(cached);
        setLoading(false);
      }
      await loadGroups(!!cached);
    })();
    return () => {
      active = false;
    };
  }, [loadGroups]);

  const handleCreateGroup = async (group: any) => {
    const result = await createGroup(group);
    if (result.error) {
      Alert.alert('Unable to create group', result.error.message);
      return;
    }
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
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom', 'left', 'right']}>
        <View style={styles.container}>
          <Text style={styles.title}>Your Groups</Text>
          <FlatList
            data={groups}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[styles.listContent, { paddingBottom: 150 }]}
            refreshControl={<RefreshControl refreshing={refreshing} tintColor="#0EA5A4" onRefresh={handleRefresh} />}
            ListEmptyComponent={
              loading ? (
                <View style={styles.emptyState}><Text style={styles.emptySubtitle}>Loading groups…</Text></View>
              ) : (
                <View style={styles.emptyState}>
                  <Ionicons name="people-outline" size={72} color="#475569" />
                  <Text style={styles.emptyTitle}>No groups yet</Text>
                  <Text style={styles.emptySubtitle}>Create your first trip or shared expense group.</Text>
                </View>
              )
            }
            renderItem={({ item }) => (
              <Pressable
                onPress={() => {
                  void prefetchGroupOverview(item.id);
                  navigation.navigate('GroupDetails', { groupId: item.id, groupName: item.name });
                }}
              >
                <GroupCard group={item} />
              </Pressable>
            )}
          />
          <Pressable style={[styles.fab, { bottom: Math.max(insets.bottom + 24, 28) }]} onPress={() => setShowCreate(true)}>
            <Ionicons name="add" size={30} color="#FFFFFF" />
          </Pressable>
          <CreateGroupModal visible={showCreate} onClose={() => setShowCreate(false)} onCreate={handleCreateGroup} />
        </View>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#0F172A' },
  container: { flex: 1, backgroundColor: '#0F172A', paddingHorizontal: 20 },
  title: { color: '#FFFFFF', fontSize: 30, fontWeight: '700', paddingTop: 10, marginBottom: 20 },
  listContent: { paddingTop: 2 },
  emptyState: { alignItems: 'center', marginTop: 80, paddingHorizontal: 20 },
  emptyTitle: { color: '#FFFFFF', fontSize: 22, fontWeight: '700', marginTop: 16 },
  emptySubtitle: { color: '#94A3B8', textAlign: 'center', marginTop: 8, lineHeight: 21 },
  fab: { position: 'absolute', right: 22, width: 62, height: 62, borderRadius: 31, backgroundColor: '#0EA5A4', justifyContent: 'center', alignItems: 'center', elevation: 10, shadowColor: '#000000', shadowOpacity: 0.25, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } },
});
