import { apiRequest } from './apiClient';

export type GroupSettlement = {
  id: string;
  group_id: string;
  from_user_id: string;
  to_user_id: string;
  amount: number | string;
  note: string | null;
  created_by: string | null;
  created_at: string;
};

export type RecordSettlementInput = {
  groupId: string;
  fromUserId: string;
  toUserId: string;
  amount: number;
  note?: string;
};

export type UpdateSettlementInput = {
  groupId: string;
  settlementId: string;
  amount: number;
  note?: string;
};

export async function recordSettlement(input: RecordSettlementInput) {
  try {
    const data = await apiRequest<GroupSettlement>(
      `/groups/${input.groupId}/settlements`,
      {
        method: 'POST',
        body: {
          from_user_id: input.fromUserId,
          to_user_id: input.toUserId,
          amount: Number(input.amount.toFixed(2)),
          note: input.note?.trim() || null,
        },
      },
    );
    return { data, error: null };
  } catch (error: any) {
    return { data: null, error };
  }
}

export async function updateSettlement(input: UpdateSettlementInput) {
  try {
    const data = await apiRequest<GroupSettlement>(
      `/groups/${input.groupId}/settlements/${input.settlementId}`,
      {
        method: 'PUT',
        body: {
          amount: Number(input.amount.toFixed(2)),
          note: input.note?.trim() || null,
        },
      },
    );
    return { data, error: null };
  } catch (error: any) {
    return { data: null, error };
  }
}

export async function deleteSettlement(groupId: string, settlementId: string) {
  try {
    await apiRequest<void>(
      `/groups/${groupId}/settlements/${settlementId}`,
      { method: 'DELETE' },
    );
    return { error: null };
  } catch (error: any) {
    return { error };
  }
}

export async function getGroupSettlements(groupId: string) {
  try {
    const data = await apiRequest<GroupSettlement[]>(
      `/groups/${groupId}/settlements`,
    );
    return { data, error: null };
  } catch (error: any) {
    return { data: null, error };
  }
}
