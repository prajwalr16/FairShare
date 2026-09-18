import React from 'react';
import {
  View,
  Text,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type Expense = {
  id?: string;
  title?: string;
  amount?: number | string | null;
  split_type?: string | null;
  paid_by?: string | null;
  created_at?: string | null;
};

type Props = {
  expense?: Expense | null;
};

export default function ExpenseCard({ expense }: Props) {
  const safeAmount = Number(expense?.amount ?? 0);

  const title =
    expense?.title?.trim() || 'Expense';

  const splitType =
    expense?.split_type || 'Equal';

  const formattedAmount =
    Number.isFinite(safeAmount)
      ? safeAmount.toFixed(2)
      : '0.00';

  let formattedDate = '';

  if (expense?.created_at) {
    const date = new Date(expense.created_at);

    if (!Number.isNaN(date.getTime())) {
      formattedDate = date.toLocaleDateString(
        'en-IN',
        {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        }
      );
    }
  }

  return (
    <View style={styles.card}>
      <View style={styles.iconContainer}>
        <Ionicons
          name="receipt-outline"
          size={22}
          color="#0EA5A4"
        />
      </View>

      <View style={styles.details}>
        <Text
          style={styles.title}
          numberOfLines={1}
        >
          {title}
        </Text>

        <View style={styles.metaRow}>
          <Text style={styles.splitType}>
            {splitType}
          </Text>

          {formattedDate ? (
            <>
              <Text style={styles.dot}>
                •
              </Text>

              <Text style={styles.date}>
                {formattedDate}
              </Text>
            </>
          ) : null}
        </View>
      </View>

      <View style={styles.amountContainer}>
        <Text style={styles.amount}>
          ₹{formattedAmount}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#1E293B',
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },

  iconContainer: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },

  details: {
    flex: 1,
    minWidth: 0,
  },

  title: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },

  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },

  splitType: {
    color: '#94A3B8',
    fontSize: 12,
  },

  dot: {
    color: '#475569',
    fontSize: 12,
    marginHorizontal: 6,
  },

  date: {
    color: '#64748B',
    fontSize: 12,
  },

  amountContainer: {
    marginLeft: 12,
    alignItems: 'flex-end',
  },

  amount: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
});