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

export type UpdateExpenseInput = CreateExpenseInput & {
  expenseId: string;
};

export type ExpenseDetailsRecord = {
  id: string;
  group_id: string;
  title: string;
  amount: number | string;
  split_type: SplitType;
  paid_by: string;
  created_at: string;
};

export type ExpenseSplitRecord = {
  id: string;
  expense_id: string;
  user_id: string;
  amount: number | string;
  created_at: string;
};

export async function createExpense(input: CreateExpenseInput) {
  const { data, error } = await supabase.rpc('create_expense_with_splits', {
    p_group_id: input.groupId,
    p_title: input.title.trim(),
    p_amount: Number(input.amount.toFixed(2)),
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
 * Compatibility wrapper for older callers.
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

export async function getExpenseDetails(expenseId: string) {
  if (!expenseId) {
    return {
      data: null,
      error: new Error('Expense information is missing.'),
    };
  }

  const [expenseResult, splitResult] = await Promise.all([
    supabase
      .from('expenses')
      .select('id,group_id,title,amount,split_type,paid_by,created_at')
      .eq('id', expenseId)
      .maybeSingle(),
    supabase
      .from('expense_splits')
      .select('id,expense_id,user_id,amount,created_at')
      .eq('expense_id', expenseId)
      .order('created_at', { ascending: true }),
  ]);

  if (expenseResult.error) {
    return { data: null, error: expenseResult.error };
  }

  if (!expenseResult.data) {
    return {
      data: null,
      error: new Error('Expense not found.'),
    };
  }

  if (splitResult.error) {
    return { data: null, error: splitResult.error };
  }

  return {
    data: {
      expense: expenseResult.data as ExpenseDetailsRecord,
      splits: (splitResult.data || []) as ExpenseSplitRecord[],
    },
    error: null,
  };
}

export async function updateExpense(input: UpdateExpenseInput) {
  const { data, error } = await supabase.rpc('update_expense_with_splits', {
    p_expense_id: input.expenseId,
    p_title: input.title.trim(),
    p_amount: Number(input.amount.toFixed(2)),
    p_paid_by: input.paidBy,
    p_split_type: input.splitType,
    p_splits: input.splits.map((split) => ({
      user_id: split.userId,
      value: split.value,
    })),
  });

  return { data, error };
}

export async function deleteExpense(expenseId: string) {
  const { data, error } = await supabase.rpc('delete_expense', {
    p_expense_id: expenseId,
  });

  return { data, error };
}

export function mapCalculatedSplitsToInputs(
  shares: CalculatedSplit[]
): SplitInput[] {
  return shares.map((share) => ({
    userId: share.userId,
    value: share.value,
  }));
}