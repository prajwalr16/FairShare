import React from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { formatCurrency } from '../utils/currency';

type Expense = {
  id: string;
  group_id?: string;
  title?: string | null;
  amount?: number | string | null;
  split_type?: string | null;
  paid_by?: string | null;
  created_at?: string | null;
};

type Props = {
  expense: Expense;
  currency?: string | null;
};

function formatDate(value?: string | null) {
  if (!value) return '';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  return date.toLocaleDateString([], {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function splitLabel(splitType?: string | null) {
  return splitType?.trim() || 'Equal';
}

export default function ExpenseCard({ expense, currency = 'INR' }: Props) {
  const navigation = useNavigation<any>();
  const dateLabel = formatDate(expense.created_at);

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      onPress={() =>
        navigation.navigate('ExpenseDetails', {
          expenseId: expense.id,
          groupId: expense.group_id,
        })
      }
    >
      <View style={styles.iconContainer}>
        <Ionicons name="receipt-outline" size={19} color="#0EA5A4" />
      </View>

      <View style={styles.info}>
        <Text style={styles.title} numberOfLines={1}>
          {expense.title?.trim() || 'Expense'}
        </Text>

        <Text style={styles.meta} numberOfLines={1}>
          {splitLabel(expense.split_type)}
          {dateLabel ? `  •  ${dateLabel}` : ''}
        </Text>
      </View>

      <View style={styles.amountContainer}>
        <Text style={styles.amount}>{formatCurrency(expense.amount, currency)}</Text>
        <Ionicons name="chevron-forward" size={18} color="#64748B" />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 15,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardPressed: {
    opacity: 0.78,
  },
  iconContainer: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  info: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  meta: {
    color: '#94A3B8',
    fontSize: 11,
    marginTop: 4,
  },
  amountContainer: {
    marginLeft: 10,
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: 6,
  },
  amount: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
});