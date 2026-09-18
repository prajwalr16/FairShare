import { supabase } from '../config/supabase';
import {
  CalculatedSplit,
  SplitInput,
  SplitType,
} from '../utils/expenseCalculation';

export type CreateExpenseInput = {
  groupId: string;
  title: string;
  amount: number;
  paidBy: string;
  splitType: SplitType;
  splits: SplitInput[];
};

export type CreateEqualExpenseInput = {
  groupId: string;
  title: string;
  amount: number;
  paidBy: string;
  participantIds: string[];
};

export async function createExpense(input: CreateExpenseInput) {
  const { data, error } = await supabase.rpc('create_expense_with_splits', {
    p_group_id: input.groupId,
    p_title: input.title.trim(),
    p_amount: input.amount,
    p_paid_by: input.paidBy,
    p_split_type: input.splitType,
    p_splits: input.splits.map((split) => ({
      user_id: split.userId,
      value: split.value,
    })),
  });

  return { data, error };
}

/**
 * Kept as a compatibility wrapper for older callers. The new expense flow
 * uses createExpense() for every split type.
 */
export async function createEqualExpense(
  input: CreateEqualExpenseInput
) {
  return createExpense({
    groupId: input.groupId,
    title: input.title,
    amount: input.amount,
    paidBy: input.paidBy,
    splitType: 'Equal',
    splits: input.participantIds.map((userId) => ({
      userId,
      value: 1,
    })),
  });
}

export function mapCalculatedSplitsToInputs(
  shares: CalculatedSplit[]
): SplitInput[] {
  return shares.map((share) => ({
    userId: share.userId,
    value: share.value,
  }));
}
