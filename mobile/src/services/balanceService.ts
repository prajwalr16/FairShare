import { apiRequest } from './apiClient';

export type GroupBalance = {
  user_id: string;
  full_name: string | null;
  email: string | null;
  role: string | null;
  total_paid: number | string;
  total_owed: number | string;
  net_balance: number | string;
};

export async function getGroupBalances(groupId: string) {
  try {
    const data = await apiRequest<GroupBalance[]>(`/groups/${groupId}/balances`);
    return { data, error: null };
  } catch (error: any) {
    return { data: null, error };
  }
}
