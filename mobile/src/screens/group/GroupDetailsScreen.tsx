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
import ExpenseCard from '../../components/ExpenseCard';
import MemberCard from '../../components/MemberCard';
import AddMemberModal from '../../components/AddMemberModal';
import {
  getGroupMembers,
  addGroupMember,
  removeGroupMember,
  GroupMember,
} from '../../services/memberService';

type Expense = {
  id: string;
  title?: string;
  amount?: number | string | null;
  split_type?: string | null;
  paid_by?: string | null;
  created_at?: string | null;
};

export default function GroupDetailsScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();

  const groupId = route.params?.groupId;
  const groupName = route.params?.groupName;

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);

  const loadGroupData = useCallback(async () => {
    if (!groupId) {
      setExpenses([]);
      setMembers([]);
      setLoading(false);
      return;
    }

    const userResult = await supabase.auth.getUser();

    const [expenseResult, memberResult, groupResult] =
      await Promise.all([
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
          .select('owner_id')
          .eq('id', groupId)
          .single(),
      ]);

    if (expenseResult.error) {
      console.log(
        'Failed to load expenses:',
        expenseResult.error.message
      );
    } else {
      setExpenses(expenseResult.data || []);
    }

    if (memberResult.error) {
      console.log(
        'Failed to load members:',
        memberResult.error.message
      );
    } else {
      setMembers(memberResult.data || []);
    }

    setOwnerId(groupResult.data?.owner_id || null);
    setCurrentUserId(userResult.data.user?.id || null);
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
      throw new Error(
        'Group information is missing.'
      );
    }

    const { data, error } =
      await addGroupMember(groupId, email);

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

  const handleRemoveMember = (
    member: GroupMember
  ) => {
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
            const { error } =
              await removeGroupMember(member.id);

            if (error) {
              return Alert.alert(
                'Unable to remove',
                error.message
              );
            }

            await loadGroupData();
          },
        },
      ]
    );
  };

  const totalExpenses = expenses.reduce(
    (sum, expense) =>
      sum + Number(expense.amount ?? 0),
    0
  );

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
              <Text
                style={styles.groupName}
                numberOfLines={1}
              >
                {groupName || 'Group'}
              </Text>

              <Text style={styles.headerSubtitle}>
                Group Overview
              </Text>
            </View>
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
                    ₹{totalExpenses.toFixed(2)}
                  </Text>

                  <Text style={styles.expenseCount}>
                    {expenses.length}{' '}
                    {expenses.length === 1
                      ? 'expense'
                      : 'expenses'}
                  </Text>
                </View>

                <View style={styles.sectionHeader}>
                  <View>
                    <Text style={styles.sectionTitle}>
                      Members
                    </Text>

                    <Text style={styles.sectionSubtitle}>
                      {members.length}{' '}
                      {members.length === 1
                        ? 'member'
                        : 'members'}
                    </Text>
                  </View>

                  {currentUserId === ownerId ? (
                    <Pressable
                      style={styles.addMemberButton}
                      onPress={() =>
                        setShowAddMember(true)
                      }
                    >
                      <Ionicons
                        name="person-add-outline"
                        size={18}
                        color="#FFFFFF"
                      />

                      <Text
                        style={styles.addMemberText}
                      >
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
                        currentUserId === ownerId &&
                        !isOwner
                          ? () =>
                              handleRemoveMember(member)
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
                    Add your first expense to start
                    tracking this group.
                  </Text>
                </View>
              ) : null
            }
            renderItem={({ item }) => (
              <ExpenseCard expense={item} />
            )}
          />

          <Pressable
            style={styles.addButton}
            onPress={() =>
              navigation.navigate('AddExpense', {
                groupId,
                groupName,
              })
            }
          >
            <Ionicons
              name="add"
              size={30}
              color="#FFFFFF"
            />
          </Pressable>

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
    marginBottom: 26,
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
