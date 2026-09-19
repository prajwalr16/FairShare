import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';

import { GroupMember, getGroupMembers } from '../../services/memberService';
import {
  deleteExpense,
  ExpenseDetailsRecord,
  ExpenseSplitRecord,
  getExpenseDetails,
} from '../../services/expenseService';

function money(value: number | string | null | undefined) {
  const amount = Number(value ?? 0);
  return `₹${Number.isFinite(amount) ? amount.toFixed(2) : '0.00'}`;
}

function formatDateTime(value?: string | null) {
  if (!value) return 'Unknown date';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown date';

  return date.toLocaleString([], {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function displayName(member?: GroupMember | null) {
  return member?.full_name?.trim() || member?.email?.trim() || 'Member';
}

export default function ExpenseDetailsScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();

  const expenseId = route.params?.expenseId as string | undefined;
  const routeGroupId = route.params?.groupId as string | undefined;

  const [expense, setExpense] = useState<ExpenseDetailsRecord | null>(null);
  const [splits, setSplits] = useState<ExpenseSplitRecord[]>([]);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [groupName, setGroupName] = useState('Group');
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    if (!expenseId) {
      setLoading(false);
      return;
    }

    setLoading(true);

    const detailsResult = await getExpenseDetails(expenseId);

    if (detailsResult.error || !detailsResult.data) {
      setExpense(null);
      setSplits([]);
      setLoading(false);
      Alert.alert(
        'Unable to load expense',
        detailsResult.error?.message || 'Expense not found.'
      );
      return;
    }

    const loadedExpense = detailsResult.data.expense;
    setExpense(loadedExpense);
    setSplits(detailsResult.data.splits);

    const groupId = loadedExpense.group_id || routeGroupId;

    if (groupId) {
      const [membersResult, groupResult] = await Promise.all([
        getGroupMembers(groupId),
        import('../../config/supabase').then(({ supabase }) =>
          supabase
            .from('groups')
            .select('name')
            .eq('id', groupId)
            .maybeSingle()
        ),
      ]);

      if (!membersResult.error) {
        setMembers(membersResult.data || []);
      }

      if (!groupResult.error && groupResult.data?.name) {
        setGroupName(groupResult.data.name);
      }
    }

    setLoading(false);
  }, [expenseId, routeGroupId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const payer = members.find(
    (member) => member.user_id === expense?.paid_by
  );

  const memberById = new Map(
    members.map((member) => [member.user_id, member])
  );

  const splitTotal = splits.reduce(
    (sum, split) => sum + Number(split.amount ?? 0),
    0
  );

  const handleDelete = () => {
    if (!expense || deleting) return;

    Alert.alert(
      'Delete expense?',
      `Delete “${expense.title}”? This will recalculate the group's balances and debts.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);

            const { error } = await deleteExpense(expense.id);

            setDeleting(false);

            if (error) {
              Alert.alert('Unable to delete expense', error.message);
              return;
            }

            navigation.goBack();
          },
        },
      ]
    );
  };

  const handleEdit = () => {
    if (!expense) return;

    navigation.navigate('EditExpense', {
      expenseId: expense.id,
      groupId: expense.group_id,
      groupName,
    });
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom', 'left', 'right']}>
        <StatusBar barStyle="light-content" backgroundColor="#0F172A" />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#0EA5A4" />
          <Text style={styles.loadingText}>Loading expense…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!expense) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom', 'left', 'right']}>
        <StatusBar barStyle="light-content" backgroundColor="#0F172A" />
        <View style={styles.centered}>
          <Ionicons name="receipt-outline" size={38} color="#64748B" />
          <Text style={styles.emptyTitle}>Expense unavailable</Text>
          <Pressable style={styles.primaryButton} onPress={() => navigation.goBack()}>
            <Text style={styles.primaryButtonText}>Go back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom', 'left', 'right']}>
      <StatusBar barStyle="light-content" backgroundColor="#0F172A" />

      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable
            style={styles.backButton}
            onPress={() => navigation.goBack()}
            hitSlop={10}
          >
            <Ionicons name="arrow-back" size={23} color="#FFFFFF" />
          </Pressable>

          <View style={styles.headerText}>
            <Text style={styles.headerTitle}>Expense Details</Text>
            <Text style={styles.headerSubtitle} numberOfLines={1}>
              {groupName}
            </Text>
          </View>

          <Pressable style={styles.moreButton} onPress={handleEdit}>
            <Ionicons name="create-outline" size={21} color="#FFFFFF" />
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.heroCard}>
            <View style={styles.heroIcon}>
              <Ionicons name="receipt-outline" size={25} color="#0EA5A4" />
            </View>
            <Text style={styles.title}>{expense.title}</Text>
            <Text style={styles.heroAmount}>{money(expense.amount)}</Text>
            <Text style={styles.heroMeta}>
              {expense.split_type} split  •  {formatDateTime(expense.created_at)}
            </Text>
          </View>

          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <View style={styles.infoLabelContainer}>
                <Ionicons name="wallet-outline" size={18} color="#0EA5A4" />
                <Text style={styles.infoLabel}>Paid by</Text>
              </View>
              <Text style={styles.infoValue} numberOfLines={1}>
                {displayName(payer)}
              </Text>
            </View>
          </View>

          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionTitle}>Split</Text>
              <Text style={styles.sectionSubtitle}>
                {splits.length} {splits.length === 1 ? 'participant' : 'participants'}
              </Text>
            </View>
            <Text style={styles.sectionTotal}>{money(splitTotal)}</Text>
          </View>

          <View style={styles.splitCard}>
            {splits.map((split) => {
              const member = memberById.get(split.user_id) || null;
              return (
                <View key={split.id} style={styles.splitRow}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>
                      {displayName(member).charAt(0).toUpperCase()}
                    </Text>
                  </View>

                  <Text style={styles.splitName} numberOfLines={1}>
                    {displayName(member)}
                  </Text>

                  <Text style={styles.splitAmount}>{money(split.amount)}</Text>
                </View>
              );
            })}
          </View>

          <View style={styles.noteCard}>
            <Ionicons name="information-circle-outline" size={18} color="#64748B" />
            <Text style={styles.noteText}>
              Editing this expense will recalculate the group's balances and debt relationships.
            </Text>
          </View>

          <Pressable
            style={[styles.deleteButton, deleting && styles.disabledButton]}
            onPress={handleDelete}
            disabled={deleting}
          >
            {deleting ? (
              <ActivityIndicator size="small" color="#FCA5A5" />
            ) : (
              <Ionicons name="trash-outline" size={18} color="#FCA5A5" />
            )}
            <Text style={styles.deleteButtonText}>
              {deleting ? 'Deleting…' : 'Delete Expense'}
            </Text>
          </Pressable>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#0F172A' },
  container: { flex: 1, backgroundColor: '#0F172A' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  loadingText: { color: '#94A3B8', marginTop: 12, fontSize: 13 },
  emptyTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '800', marginTop: 14, marginBottom: 18 },
  header: { minHeight: 70, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center' },
  backButton: { width: 40, height: 40, borderRadius: 13, backgroundColor: '#1E293B', alignItems: 'center', justifyContent: 'center' },
  headerText: { flex: 1, paddingHorizontal: 12 },
  headerTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '800' },
  headerSubtitle: { color: '#64748B', fontSize: 11, marginTop: 3 },
  moreButton: { width: 40, height: 40, borderRadius: 13, backgroundColor: '#1E293B', alignItems: 'center', justifyContent: 'center' },
  content: { padding: 18, paddingBottom: 36 },
  heroCard: { backgroundColor: '#1E293B', borderRadius: 22, padding: 22, alignItems: 'center' },
  heroIcon: { width: 54, height: 54, borderRadius: 17, backgroundColor: '#0F172A', alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  title: { color: '#FFFFFF', fontSize: 22, fontWeight: '900', textAlign: 'center' },
  heroAmount: { color: '#FFFFFF', fontSize: 30, fontWeight: '900', marginTop: 9 },
  heroMeta: { color: '#94A3B8', fontSize: 11, marginTop: 8, textAlign: 'center' },
  infoCard: { backgroundColor: '#1E293B', borderRadius: 18, paddingHorizontal: 16, marginTop: 14 },
  infoRow: { minHeight: 60, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  infoLabelContainer: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  infoLabel: { color: '#94A3B8', fontSize: 13, fontWeight: '700' },
  infoValue: { color: '#FFFFFF', fontSize: 14, fontWeight: '800', maxWidth: '60%' },
  sectionHeader: { marginTop: 24, marginBottom: 10, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  sectionTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '800' },
  sectionSubtitle: { color: '#64748B', fontSize: 11, marginTop: 4 },
  sectionTotal: { color: '#CBD5E1', fontSize: 14, fontWeight: '800' },
  splitCard: { backgroundColor: '#1E293B', borderRadius: 18, padding: 6 },
  splitRow: { minHeight: 58, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 34, height: 34, borderRadius: 12, backgroundColor: '#0F172A', alignItems: 'center', justifyContent: 'center', marginRight: 11 },
  avatarText: { color: '#0EA5A4', fontSize: 13, fontWeight: '900' },
  splitName: { flex: 1, color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  splitAmount: { color: '#FFFFFF', fontSize: 13, fontWeight: '800', marginLeft: 12 },
  noteCard: { marginTop: 16, backgroundColor: '#111C2F', borderRadius: 15, padding: 14, flexDirection: 'row', gap: 9 },
  noteText: { flex: 1, color: '#64748B', fontSize: 11, lineHeight: 16 },
  primaryButton: { minWidth: 130, minHeight: 46, paddingHorizontal: 18, borderRadius: 13, backgroundColor: '#0EA5A4', alignItems: 'center', justifyContent: 'center' },
  primaryButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  deleteButton: { marginTop: 22, minHeight: 48, borderRadius: 14, borderWidth: 1, borderColor: '#7F1D1D', backgroundColor: '#1C1013', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 },
  deleteButtonText: { color: '#FCA5A5', fontSize: 14, fontWeight: '800' },
  disabledButton: { opacity: 0.65 },
});
