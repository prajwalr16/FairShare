import { supabase } from '../config/supabase';
import type { GroupBalance } from './balanceService';

export type DebtRelationship = {
  from_user_id: string;
  to_user_id: string;
  from_name: string;
  to_name: string;
  amount: number;
};

type ExpenseForDebt = {
  id: string;
  paid_by?: string | null;
};

type ExpenseSplitForDebt = {
  expense_id: string;
  user_id: string;
  amount: number | string;
};

const MONEY_EPSILON = 0.005;

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function balanceDisplayName(balance?: GroupBalance) {
  return balance?.full_name?.trim() || balance?.email?.trim() || 'Member';
}

function buildNameMap(balances: GroupBalance[]) {
  const map = new Map<string, string>();

  balances.forEach((balance) => {
    map.set(balance.user_id, balanceDisplayName(balance));
  });

  return map;
}

function buildDirectDebts(
  expenses: ExpenseForDebt[],
  splits: ExpenseSplitForDebt[],
  nameMap: Map<string, string>
): DebtRelationship[] {
  const splitMap = new Map<string, ExpenseSplitForDebt[]>();

  splits.forEach((split) => {
    const current = splitMap.get(split.expense_id) || [];
    current.push(split);
    splitMap.set(split.expense_id, current);
  });

  const pairAmounts = new Map<string, number>();

  expenses.forEach((expense) => {
    const payerId = expense.paid_by;

    if (!payerId) return;

    const expenseSplits = splitMap.get(expense.id) || [];

    expenseSplits.forEach((split) => {
      if (!split.user_id || split.user_id === payerId) return;

      const amount = roundMoney(Number(split.amount ?? 0));

      if (amount <= MONEY_EPSILON) return;

      const key = `${split.user_id}::${payerId}`;
      pairAmounts.set(
        key,
        roundMoney((pairAmounts.get(key) || 0) + amount)
      );
    });
  });

  return Array.from(pairAmounts.entries())
    .map(([key, amount]) => {
      const [fromUserId, toUserId] = key.split('::');

      return {
        from_user_id: fromUserId,
        to_user_id: toUserId,
        from_name: nameMap.get(fromUserId) || 'Member',
        to_name: nameMap.get(toUserId) || 'Member',
        amount: roundMoney(amount),
      };
    })
    .filter((debt) => debt.amount > MONEY_EPSILON)
    .sort((a, b) => b.amount - a.amount);
}

function buildSimplifiedDebts(
  balances: GroupBalance[],
  nameMap: Map<string, string>
): DebtRelationship[] {
  const creditors = balances
    .map((balance) => ({
      userId: balance.user_id,
      amount: roundMoney(Math.max(Number(balance.net_balance ?? 0), 0)),
    }))
    .filter((entry) => entry.amount > MONEY_EPSILON)
    .sort((a, b) => b.amount - a.amount);

  const debtors = balances
    .map((balance) => ({
      userId: balance.user_id,
      amount: roundMoney(Math.max(-Number(balance.net_balance ?? 0), 0)),
    }))
    .filter((entry) => entry.amount > MONEY_EPSILON)
    .sort((a, b) => b.amount - a.amount);

  const relationships: DebtRelationship[] = [];
  let debtorIndex = 0;
  let creditorIndex = 0;

  while (
    debtorIndex < debtors.length &&
    creditorIndex < creditors.length
  ) {
    const debtor = debtors[debtorIndex];
    const creditor = creditors[creditorIndex];
    const amount = roundMoney(
      Math.min(debtor.amount, creditor.amount)
    );

    if (amount > MONEY_EPSILON) {
      relationships.push({
        from_user_id: debtor.userId,
        to_user_id: creditor.userId,
        from_name: nameMap.get(debtor.userId) || 'Member',
        to_name: nameMap.get(creditor.userId) || 'Member',
        amount,
      });
    }

    debtor.amount = roundMoney(debtor.amount - amount);
    creditor.amount = roundMoney(creditor.amount - amount);

    if (debtor.amount <= MONEY_EPSILON) {
      debtorIndex += 1;
    }

    if (creditor.amount <= MONEY_EPSILON) {
      creditorIndex += 1;
    }
  }

  return relationships;
}

export async function getGroupDebtRelationships(
  expenses: ExpenseForDebt[],
  balances: GroupBalance[]
): Promise<{
  data: {
    direct: DebtRelationship[];
    simplified: DebtRelationship[];
  } | null;
  error: Error | null;
}> {
  if (expenses.length === 0 || balances.length === 0) {
    return {
      data: {
        direct: [],
        simplified: [],
      },
      error: null,
    };
  }

  const expenseIds = expenses.map((expense) => expense.id);

  const { data: splits, error } = await supabase
    .from('expense_splits')
    .select('expense_id,user_id,amount')
    .in('expense_id', expenseIds);

  if (error) {
    return {
      data: null,
      error: new Error(error.message),
    };
  }

  const nameMap = buildNameMap(balances);

  return {
    data: {
      direct: buildDirectDebts(
        expenses,
        (splits || []) as ExpenseSplitForDebt[],
        nameMap
      ),
      simplified: buildSimplifiedDebts(balances, nameMap),
    },
    error: null,
  };
}