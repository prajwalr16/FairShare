import { apiRequest } from './apiClient';
import { invalidateGroupOverview } from './groupService';
import { broadcastGroupMutation } from './realtimeService';
import { enqueueOfflineMutation, isDeviceOnline } from './offlineQueue';

export type GroupSettlement = {
  id: string;
  group_id: string;
  from_user_id: string;
  to_user_id: string;
  amount: number | string;
  note: string | null;
  created_by: string | null;
  created_at: string;
  updated_at?: string | null;
  from_name?: string | null;
  to_name?: string | null;
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
  const body = {
    from_user_id: input.fromUserId,
    to_user_id: input.toUserId,
    amount: Number(input.amount.toFixed(2)),
    note: input.note?.trim() || null,
  };

  // If device is offline, enqueue immediately and return optimistic settlement
  if (!isDeviceOnline()) {
    const optimistic: GroupSettlement = {
      id: `offline-st-${Date.now()}`,
      group_id: input.groupId,
      from_user_id: input.fromUserId,
      to_user_id: input.toUserId,
      amount: input.amount,
      note: input.note?.trim() || null,
      created_by: null,
      created_at: new Date().toISOString(),
    };

    void enqueueOfflineMutation({
      id: optimistic.id,
      type: 'record_settlement',
      groupId: input.groupId,
      endpoint: `/groups/${input.groupId}/settlements`,
      method: 'POST',
      body,
      title: `Settlement ${input.amount}`,
    });

    invalidateGroupOverview(input.groupId);
    return { data: optimistic, error: null };
  }

  try {
    const data = await apiRequest<GroupSettlement>(
      `/groups/${input.groupId}/settlements`,
      {
        method: 'POST',
        body,
      },
    );
    invalidateGroupOverview(input.groupId);
    void broadcastGroupMutation(input.groupId, 'settlement');
    return { data, error: null };
  } catch (error: any) {
    // If network error occurred, fallback to offline queue
    const isNetworkError =
      error?.status === 0 ||
      error?.name === 'TypeError' ||
      /network|offline|failed to fetch/i.test(error?.message || '');

    if (isNetworkError) {
      const optimistic: GroupSettlement = {
        id: `offline-st-${Date.now()}`,
        group_id: input.groupId,
        from_user_id: input.fromUserId,
        to_user_id: input.toUserId,
        amount: input.amount,
        note: input.note?.trim() || null,
        created_by: null,
        created_at: new Date().toISOString(),
      };

      void enqueueOfflineMutation({
        id: optimistic.id,
        type: 'record_settlement',
        groupId: input.groupId,
        endpoint: `/groups/${input.groupId}/settlements`,
        method: 'POST',
        body,
        title: `Settlement ${input.amount}`,
      });

      invalidateGroupOverview(input.groupId);
      return { data: optimistic, error: null };
    }

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
    invalidateGroupOverview(input.groupId);
    void broadcastGroupMutation(input.groupId, 'settlement');
    return { data, error: null };
  } catch (error: any) {
    return { data: null, error };
  }
}

export async function deleteSettlement(groupId: string, settlementId: string) {
  try {
    await apiRequest<void>(`/groups/${groupId}/settlements/${settlementId}`, { method: 'DELETE' });
    invalidateGroupOverview(groupId);
    void broadcastGroupMutation(groupId, 'settlement');
    return { error: null };
  } catch (error: any) {
    return { error };
  }
}

export async function getGroupSettlements(groupId: string) {
  try {
    const data = await apiRequest<GroupSettlement[]>(`/groups/${groupId}/settlements`);
    return { data, error: null };
  } catch (error: any) {
    return { data: null, error };
  }
}
