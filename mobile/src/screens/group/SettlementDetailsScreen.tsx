import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
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

import { getGroupMembers, GroupMember } from '../../services/memberService';
import { getGroupSettings } from '../../services/groupService';
import {
  deleteSettlement,
  getGroupSettlements,
  GroupSettlement,
  updateSettlement,
} from '../../services/settlementService';
import { formatCurrency } from '../../utils/currency';

function nameOf(member?: GroupMember | null) {
  return member?.full_name?.trim() || member?.email?.trim() || 'Member';
}

function dateTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Unknown date'
    : date.toLocaleString([], {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
}

export default function SettlementDetailsScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const groupId = route.params?.groupId as string | undefined;
  const settlementId = route.params?.settlementId as string | undefined;

  const [settlement, setSettlement] = useState<GroupSettlement | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [currency, setCurrency] = useState('INR');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [editVisible, setEditVisible] = useState(false);
  const [amountText, setAmountText] = useState('');
  const [note, setNote] = useState('');

  const load = useCallback(async () => {
    if (!groupId || !settlementId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const [settlementResult, memberResult, settingsResult] = await Promise.all([
      getGroupSettlements(groupId),
      getGroupMembers(groupId),
      getGroupSettings(groupId),
    ]);

    if (settingsResult.data?.currency) setCurrency(settingsResult.data.currency);
    setMembers(memberResult.data || []);

    const found = (settlementResult.data || []).find(
      (item) => item.id === settlementId,
    );
    if (!found) {
      setSettlement(null);
      setLoading(false);
      return;
    }

    setSettlement(found);
    setAmountText(Number(found.amount).toFixed(2));
    setNote(found.note || '');
    setLoading(false);
  }, [groupId, settlementId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const memberMap = useMemo(() => {
    return new Map(
      members
        .filter((member) => member.user_id)
        .map((member) => [
          member.user_id as string,
          nameOf(member),
        ]),
    );
  }, [members]);

  const fromName = settlement
    ? memberMap.get(settlement.from_user_id) || 'Member'
    : 'Member';
  const toName = settlement
    ? memberMap.get(settlement.to_user_id) || 'Member'
    : 'Member';

  const saveEdit = async () => {
    if (!groupId || !settlement) return;

    const amount = Number(amountText.replace(/,/g, '').trim());
    if (!Number.isFinite(amount) || amount <= 0) {
      Alert.alert('Invalid amount', 'Enter a valid settlement amount.');
      return;
    }

    setBusy(true);
    const result = await updateSettlement({
      groupId,
      settlementId: settlement.id,
      amount,
      note,
    });
    setBusy(false);

    if (result.error) {
      Alert.alert('Unable to update settlement', result.error.message);
      return;
    }

    setEditVisible(false);
    await load();
  };

  const confirmDelete = () => {
    if (!groupId || !settlement || busy) return;

    Alert.alert(
      'Delete settlement?',
      'The outstanding debt will be recalculated after this payment is removed.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setBusy(true);
            const result = await deleteSettlement(groupId, settlement.id);
            setBusy(false);

            if (result.error) {
              Alert.alert('Unable to delete settlement', result.error.message);
              return;
            }

            navigation.goBack();
          },
        },
      ],
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="light-content" backgroundColor="#0F172A" />
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#0EA5A4" />
        </View>
      </SafeAreaView>
    );
  }

  if (!settlement) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.center}>
          <Text style={styles.emptyTitle}>Settlement unavailable</Text>
          <Pressable style={styles.primaryButton} onPress={() => navigation.goBack()}>
            <Text style={styles.primaryButtonText}>Go back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <>
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="light-content" backgroundColor="#0F172A" />
        <View style={styles.container}>
          <View style={styles.header}>
            <Pressable style={styles.headerButton} onPress={() => navigation.goBack()}>
              <Ionicons name="arrow-back" size={23} color="#FFFFFF" />
            </Pressable>
            <View style={styles.headerCenter}>
              <Text style={styles.headerTitle}>Settlement Details</Text>
              <Text style={styles.headerSubtitle}>
                {fromName} → {toName}
              </Text>
            </View>
            <Pressable
              style={styles.headerButton}
              onPress={() => setEditVisible(true)}
              disabled={busy}
            >
              <Ionicons name="create-outline" size={21} color="#FFFFFF" />
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.heroCard}>
              <View style={styles.iconCircle}>
                <Ionicons
                  name="swap-horizontal-outline"
                  size={27}
                  color="#0EA5A4"
                />
              </View>
              <Text style={styles.heroTitle}>
                {fromName} paid {toName}
              </Text>
              <Text style={styles.amount}>
                {formatCurrency(settlement.amount, currency)}
              </Text>
              <Text style={styles.date}>{dateTime(settlement.created_at)}</Text>
            </View>

            <View style={styles.card}>
              <View style={styles.row}>
                <Text style={styles.label}>From</Text>
                <Text style={styles.value}>{fromName}</Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.label}>To</Text>
                <Text style={styles.value}>{toName}</Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.label}>Note</Text>
                <Text style={styles.value}>{settlement.note || 'No note'}</Text>
              </View>
            </View>

            <Pressable
              style={[styles.deleteButton, busy && styles.disabled]}
              onPress={confirmDelete}
              disabled={busy}
            >
              {busy ? (
                <ActivityIndicator size="small" color="#FCA5A5" />
              ) : (
                <Ionicons name="trash-outline" size={18} color="#FCA5A5" />
              )}
              <Text style={styles.deleteText}>Delete Settlement</Text>
            </Pressable>
          </ScrollView>
        </View>
      </SafeAreaView>

      <Modal
        visible={editVisible}
        transparent
        animationType="slide"
        onRequestClose={() => !busy && setEditVisible(false)}
      >
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Edit Settlement</Text>
                <Text style={styles.modalSubtitle}>{fromName} → {toName}</Text>
              </View>
              <Pressable
                onPress={() => !busy && setEditVisible(false)}
                hitSlop={10}
              >
                <Ionicons name="close" size={23} color="#FFFFFF" />
              </Pressable>
            </View>

            <Text style={styles.inputLabel}>Amount</Text>
            <TextInput
              value={amountText}
              onChangeText={setAmountText}
              keyboardType="decimal-pad"
              style={styles.input}
              placeholder="0.00"
              placeholderTextColor="#64748B"
            />

            <Text style={styles.inputLabel}>Note</Text>
            <TextInput
              value={note}
              onChangeText={setNote}
              style={styles.input}
              placeholder="UPI payment"
              placeholderTextColor="#64748B"
              maxLength={200}
            />

            <Pressable
              style={[styles.primaryButton, busy && styles.disabled]}
              onPress={saveEdit}
              disabled={busy}
            >
              {busy ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.primaryButtonText}>Save Changes</Text>
              )}
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
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: { flex: 1, paddingHorizontal: 12 },
  headerTitle: { color: '#FFFFFF', fontSize: 20, fontWeight: '900' },
  headerSubtitle: { color: '#64748B', fontSize: 12, marginTop: 3 },
  content: { padding: 18, paddingBottom: 50 },
  heroCard: {
    backgroundColor: '#1E293B',
    borderRadius: 22,
    padding: 24,
    alignItems: 'center',
    marginBottom: 14,
  },
  iconCircle: {
    width: 58,
    height: 58,
    borderRadius: 18,
    backgroundColor: '#0F3333',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
    textAlign: 'center',
  },
  amount: {
    color: '#FFFFFF',
    fontSize: 35,
    fontWeight: '900',
    marginTop: 8,
  },
  date: { color: '#64748B', marginTop: 7 },
  card: {
    backgroundColor: '#1E293B',
    borderRadius: 18,
    padding: 18,
    marginBottom: 14,
  },
  row: {
    paddingVertical: 11,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 14,
  },
  label: { color: '#64748B', fontWeight: '700' },
  value: {
    color: '#FFFFFF',
    fontWeight: '800',
    flex: 1,
    textAlign: 'right',
  },
  deleteButton: {
    minHeight: 52,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#7F1D1D',
    backgroundColor: '#2B151B',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  deleteText: { color: '#FCA5A5', fontWeight: '900' },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#0F172A',
    padding: 22,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  modalTitle: { color: '#FFFFFF', fontSize: 24, fontWeight: '900' },
  modalSubtitle: { color: '#94A3B8', marginTop: 4 },
  inputLabel: { color: '#CBD5E1', fontWeight: '800', marginBottom: 8 },
  input: {
    backgroundColor: '#1E293B',
    color: '#FFFFFF',
    borderRadius: 14,
    paddingHorizontal: 15,
    paddingVertical: 14,
    marginBottom: 15,
  },
  primaryButton: {
    backgroundColor: '#0EA5A4',
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
  },
  primaryButtonText: { color: '#FFFFFF', fontWeight: '900' },
  disabled: { opacity: 0.6 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  emptyTitle: { color: '#FFFFFF', fontWeight: '900', fontSize: 20, marginBottom: 18 },
});
