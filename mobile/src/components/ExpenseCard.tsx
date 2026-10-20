import React, { useRef } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { formatCurrency } from '../utils/currency';
import { EXPENSE_CATEGORY_ICONS, ExpenseCategory } from '../constants/expenseCategories';

type Expense = {
  id: string;
  group_id?: string;
  title?: string | null;
  amount?: number | string | null;
  split_type?: string | null;
  category?: ExpenseCategory | null;
  paid_by?: string | null;
  location_name?: string | null;
  created_at?: string | null;
  expense_date?: string | null;
  updated_at?: string | null;
};

type Props = {
  expense: Expense;
  currency?: string | null;
  payerName?: string | null;
};

function formatDate(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString([], {
    day: '2-digit',
    month: 'short',
  });
}

function splitLabel(splitType?: string | null) {
  return splitType?.trim() || 'Equal';
}

export default function ExpenseCard({ expense, currency = 'INR', payerName }: Props) {
  const navigation = useNavigation<any>();
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const dateLabel = formatDate(expense.expense_date || expense.created_at);
  const locationLabel = expense.location_name?.trim() || '';

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.98,
      useNativeDriver: true,
      speed: 30,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      speed: 20,
      bounciness: 4,
    }).start();
  };

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <Pressable
        style={styles.card}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={() =>
          navigation.navigate('ExpenseDetails', {
            expenseId: expense.id,
            groupId: expense.group_id,
          })
        }
      >
        <View style={styles.iconContainer}>
          <Ionicons
            name={expense.category ? EXPENSE_CATEGORY_ICONS[expense.category] : 'receipt-outline'}
            size={18}
            color="#00E5FF"
          />
        </View>

        <View style={styles.info}>
          <View style={styles.titleRow}>
            <Text style={styles.title} numberOfLines={1}>
              {expense.title?.trim() || 'Expense'}
            </Text>
          </View>

          <View style={styles.metaRow}>
            {payerName ? (
              <View style={styles.payerPill}>
                <Text style={styles.payerText} numberOfLines={1}>
                  Paid by {payerName}
                </Text>
              </View>
            ) : null}

            <Text style={styles.metaSecondary} numberOfLines={1}>
              {expense.category || 'Other'} • {splitLabel(expense.split_type)}
              {dateLabel ? ` • ${dateLabel}` : ''}
            </Text>
          </View>

          {locationLabel ? (
            <View style={styles.locationRow}>
              <Ionicons name="location-sharp" size={11} color="#64748B" />
              <Text style={styles.locationText} numberOfLines={1}>
                {locationLabel}
              </Text>
            </View>
          ) : null}
        </View>

        <View style={styles.amountContainer}>
          <Text style={styles.amount}>{formatCurrency(expense.amount, currency)}</Text>
          <Ionicons name="chevron-forward" size={15} color="#475569" style={{ marginTop: 2 }} />
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#0E1524',
    borderRadius: 18,
    paddingHorizontal: 15,
    paddingVertical: 14,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  iconContainer: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: 'rgba(0, 229, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  info: {
    flex: 1,
    marginLeft: 12,
    marginRight: 10,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  payerPill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: 'rgba(0, 229, 255, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.25)',
  },
  payerText: {
    color: '#00E5FF',
    fontSize: 10,
    fontWeight: '800',
  },
  metaSecondary: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '500',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 3,
  },
  locationText: {
    color: '#64748B',
    fontSize: 10.5,
  },
  amountContainer: {
    alignItems: 'flex-end',
  },
  amount: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: -0.2,
  },
});
