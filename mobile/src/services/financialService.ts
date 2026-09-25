import { apiRequest } from './apiClient';
import type { GroupBalance, GroupDebt } from './groupService';

export type GroupFinancialSummary = {
  balances: GroupBalance[];
  direct: GroupDebt[];
  simplified: GroupDebt[];
};

export async function getGroupFinancialSummary(
  groupId: string,
  signal?: AbortSignal,
) {
  try {
    const data = await apiRequest<GroupFinancialSummary>(
      `/groups/${groupId}/financial`,
      { signal },
    );
    return { data, error: null };
  } catch (error: any) {
    return { data: null, error };
  }
}
