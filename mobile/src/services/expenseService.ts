import { apiRequest } from './apiClient';
import { invalidateGroupOverview, clearGroupOverviewCache } from './groupService';
import { ExpenseCategory } from '../constants/expenseCategories';
import { CalculatedSplit, SplitInput, SplitType } from '../utils/expenseCalculation';

export type CreateExpenseInput = {
  groupId: string;
  title: string;
  amount: number;
  paidBy: string;
  splitType: SplitType;
  category: ExpenseCategory;
  splits: SplitInput[];
};

export type CreateEqualExpenseInput = {
  groupId: string;
  title: string;
  amount: number;
  paidBy: string;
  participantIds: string[];
  category?: ExpenseCategory;
};

export type UpdateExpenseInput = CreateExpenseInput & { expenseId: string };

export type ExpenseDetailsRecord = {
  id: string;
  group_id: string;
  title: string;
  amount: number | string;
  split_type: SplitType;
  category: ExpenseCategory;
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

type ExpenseDetailsPayload = {
  expense: ExpenseDetailsRecord;
  splits: ExpenseSplitRecord[];
};

const EXPENSE_DETAILS_CACHE_TTL_MS = 120_000;
const expenseDetailsCache = new Map<string, { data: ExpenseDetailsPayload; cachedAt: number }>();
const expenseDetailsRequests = new Map<string, Promise<{ data: ExpenseDetailsPayload | null; error: any }>>();

export function invalidateExpenseDetails(expenseId: string) {
  expenseDetailsCache.delete(expenseId);
}

export function clearExpenseDetailsCache() {
  expenseDetailsCache.clear();
  expenseDetailsRequests.clear();
}

export async function createExpense(input: CreateExpenseInput) {
  try {
    const data = await apiRequest<ExpenseDetailsRecord>(`/groups/${input.groupId}/expenses`, {
      method: 'POST',
      body: {
        title: input.title.trim(),
        amount: Number(input.amount.toFixed(2)),
        paid_by: input.paidBy,
        split_type: input.splitType,
        category: input.category,
        splits: input.splits.map((split) => ({ user_id: split.userId, value: split.value })),
      },
    });
    invalidateGroupOverview(input.groupId);
    return { data, error: null };
  } catch (error: any) {
    return { data: null, error };
  }
}

export async function createEqualExpense(input: CreateEqualExpenseInput) {
  return createExpense({
    groupId: input.groupId,
    title: input.title,
    amount: input.amount,
    paidBy: input.paidBy,
    splitType: 'Equal',
    category: input.category || 'Other',
    splits: input.participantIds.map((userId) => ({ userId, value: 1 })),
  });
}

export async function getExpenseDetails(expenseId: string, force = false, signal?: AbortSignal) {
  if (!expenseId) {
    return { data: null, error: new Error('Expense information is missing.') };
  }

  const cached = expenseDetailsCache.get(expenseId);
  if (!force && cached && Date.now() - cached.cachedAt < EXPENSE_DETAILS_CACHE_TTL_MS) {
    return { data: cached.data, error: null };
  }

  if (!force && !signal) {
    const inFlight = expenseDetailsRequests.get(expenseId);
    if (inFlight) return inFlight;
  }

  const request = (async () => {
    try {
      const data = await apiRequest<ExpenseDetailsPayload>(`/expenses/${expenseId}`, { signal });
      expenseDetailsCache.set(expenseId, { data, cachedAt: Date.now() });
      return { data, error: null };
    } catch (error: any) {
      return { data: null, error };
    }
  })();

  if (!force && !signal) expenseDetailsRequests.set(expenseId, request);
  try {
    return await request;
  } finally {
    if (expenseDetailsRequests.get(expenseId) === request) expenseDetailsRequests.delete(expenseId);
  }
}

export async function updateExpense(input: UpdateExpenseInput) {
  try {
    const data = await apiRequest<ExpenseDetailsRecord>(`/expenses/${input.expenseId}`, {
      method: 'PUT',
      body: {
        title: input.title.trim(),
        amount: Number(input.amount.toFixed(2)),
        paid_by: input.paidBy,
        split_type: input.splitType,
        category: input.category,
        splits: input.splits.map((split) => ({ user_id: split.userId, value: split.value })),
      },
    });
    invalidateExpenseDetails(input.expenseId);
    invalidateGroupOverview(input.groupId);
    return { data, error: null };
  } catch (error: any) {
    return { data: null, error };
  }
}

export async function deleteExpense(expenseId: string) {
  try {
    await apiRequest<void>(`/expenses/${expenseId}`, { method: 'DELETE' });
    invalidateExpenseDetails(expenseId);
    clearGroupOverviewCache();
    return { data: expenseId, error: null };
  } catch (error: any) {
    return { data: null, error };
  }
}

export async function getGroupExpenses(
  groupId: string,
  limit?: number,
  category?: ExpenseCategory | 'All',
  scope: 'all' | 'mine' = 'all',
  signal?: AbortSignal,
) {
  try {
    const params = new URLSearchParams();
    if (limit) params.set('limit', String(limit));
    if (category && category !== 'All') params.set('category', category);
    if (scope !== 'all') params.set('scope', scope);
    const query = params.toString() ? `?${params.toString()}` : '';
    const data = await apiRequest<ExpenseDetailsRecord[]>(`/groups/${groupId}/expenses${query}`, { signal });
    return { data, error: null };
  } catch (error: any) {
    return { data: null, error };
  }
}

export function mapCalculatedSplitsToInputs(shares: CalculatedSplit[]): SplitInput[] {
  return shares.map((share) => ({ userId: share.userId, value: share.value }));
}
