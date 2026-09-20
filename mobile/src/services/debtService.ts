import { apiRequest } from './apiClient';

export type DebtRelationship = {
  from_user_id: string;
  to_user_id: string;
  from_name: string;
  to_name: string;
  amount: number | string;
};

export async function getGroupDebtRelationships(_expenses: unknown[] = [], _balances: unknown[] = [], groupId?: string) {
  if (!groupId) {
    return {
      data: { direct: [], simplified: [] },
      error: new Error('Group information is missing.'),
    };
  }

  try {
    const data = await apiRequest<{
      direct: DebtRelationship[];
      simplified: DebtRelationship[];
    }>(`/groups/${groupId}/debts`);
    return { data, error: null };
  } catch (error: any) {
    return { data: null, error };
  }
}

export async function getGroupDebts(groupId: string) {
  try {
    const data = await apiRequest<{
      direct: DebtRelationship[];
      simplified: DebtRelationship[];
    }>(`/groups/${groupId}/debts`);
    return { data, error: null };
  } catch (error: any) {
    return { data: null, error };
  }
}
