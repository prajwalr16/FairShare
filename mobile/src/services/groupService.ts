import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiRequest } from './apiClient';
import { supabase } from '../config/supabase';

export type GroupRole = 'owner' | 'admin' | 'member' | 'viewer';

export type GroupSettings = {
  id: string;
  owner_id: string;
  name: string;
  type: string;
  currency: string;
  description?: string | null;
  created_at?: string | null;
  is_owner?: boolean;
  role?: GroupRole;
};

export type GroupSummary = {
  id: string;
  owner_id: string;
  name: string;
  type: string;
  currency: string;
  description?: string | null;
  created_at?: string | null;
};

export type GroupMemberRole = {
  id: string;
  group_id: string;
  user_id: string | null;
  email: string;
  full_name?: string | null;
  role: GroupRole;
  status: 'pending' | 'active' | string;
  created_at?: string | null;
};

export type GroupBalance = {
  user_id: string;
  full_name: string | null;
  email: string | null;
  role: string;
  total_paid: number | string;
  total_owed: number | string;
  net_balance: number | string;
};

export type GroupDebt = {
  from_user_id: string;
  to_user_id: string;
  from_name: string;
  to_name: string;
  amount: number | string;
};

export type GroupOverviewExpense = {
  id: string;
  group_id: string;
  title: string;
  amount: number | string;
  split_type: string;
  category: string;
  paid_by: string;
  created_at: string;
};

export type GroupOverview = {
  id: string;
  owner_id: string;
  name: string;
  type: string;
  currency: string;
  description?: string | null;
  created_at?: string | null;
  is_owner: boolean;
  role: GroupRole;
  current_user_balance: GroupBalance | null;
  top_debts: GroupDebt[];
  recent_expenses: GroupOverviewExpense[];
};

export type GroupHistorySettlement = {
  id: string;
  group_id: string;
  from_user_id: string;
  to_user_id: string;
  amount: number | string;
  note: string | null;
  created_by: string | null;
  created_at: string;
};

export type GroupHistory = {
  expenses: GroupOverviewExpense[];
  settlements: GroupHistorySettlement[];
};

const GROUPS_CACHE_PREFIX = 'fairshare:groups:v2:';

const groupOverviewCache = new Map<string, GroupOverview>();
const groupOverviewRequests = new Map<string, Promise<{ data: GroupOverview | null; error: any }>>();
const groupSettingsCache = new Map<string, GroupSettings>();
const groupsRequest: { promise: Promise<{ data: GroupSummary[] | null; error: any }> | null } = { promise: null };

export function getCachedGroupOverview(groupId: string) {
  return groupOverviewCache.get(groupId) || null;
}

export function invalidateGroupOverview(groupId: string) {
  groupOverviewCache.delete(groupId);
  groupSettingsCache.delete(groupId);
}

export function clearGroupOverviewCache() {
  groupOverviewCache.clear();
  groupSettingsCache.clear();
}

export async function getGroupOverview(groupId: string, signal?: AbortSignal) {
  const cached = groupOverviewCache.get(groupId);
  if (cached && !signal) {
    return { data: cached, error: null };
  }

  const inFlight = groupOverviewRequests.get(groupId);
  if (inFlight) return inFlight;

  const request = (async () => {
    try {
      const data = await apiRequest<GroupOverview>(`/groups/${groupId}/overview`, { signal });
      groupOverviewCache.set(groupId, data);
      groupSettingsCache.set(groupId, data);
      return { data, error: null };
    } catch (error: any) {
      return { data: null, error };
    }
  })();

  groupOverviewRequests.set(groupId, request);
  try {
    return await request;
  } finally {
    if (groupOverviewRequests.get(groupId) === request) {
      groupOverviewRequests.delete(groupId);
    }
  }
}

export async function prefetchGroupOverview(groupId: string) {
  if (getCachedGroupOverview(groupId)) return;
  void getGroupOverview(groupId);
}

export async function getCachedGroups(): Promise<GroupSummary[] | null> {
  try {
    const { data } = await supabase.auth.getSession();
    const userId = data.session?.user?.id;
    if (!userId) return null;
    const raw = await AsyncStorage.getItem(`${GROUPS_CACHE_PREFIX}${userId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { cachedAt: number; data: GroupSummary[] };
    if (!parsed?.data || !Array.isArray(parsed.data)) return null;
    return parsed.data;
  } catch {
    return null;
  }
}

async function persistGroups(groups: GroupSummary[]) {
  try {
    const { data } = await supabase.auth.getSession();
    const userId = data.session?.user?.id;
    if (!userId) return;
    await AsyncStorage.setItem(
      `${GROUPS_CACHE_PREFIX}${userId}`,
      JSON.stringify({ cachedAt: Date.now(), data: groups }),
    );
  } catch {
    // Persistent cache is an optimization only; never fail the API path.
  }
}

export async function getGroups() {
  if (groupsRequest.promise) return groupsRequest.promise;

  const request = (async () => {
    try {
      const data = await apiRequest<GroupSummary[]>('/groups');
      void persistGroups(data);
      return { data, error: null };
    } catch (error: any) {
      return { data: null, error };
    }
  })();

  groupsRequest.promise = request;
  try {
    return await request;
  } finally {
    groupsRequest.promise = null;
  }
}

export async function createGroup(input: { name: string; type: string; currency?: string; description?: string }) {
  try {
    const data = await apiRequest<GroupSummary>('/groups', {
      method: 'POST',
      body: {
        name: input.name,
        type: input.type,
        currency: input.currency || 'INR',
        description: input.description || null,
      },
    });
    clearGroupOverviewCache();
    return { data, error: null };
  } catch (error: any) {
    return { data: null, error };
  }
}

export async function getGroup(groupId: string) {
  try {
    return { data: await apiRequest<GroupSummary>(`/groups/${groupId}`), error: null };
  } catch (error: any) {
    return { data: null, error };
  }
}

export async function getGroupSettings(groupId: string) {
  const cached = groupSettingsCache.get(groupId) || groupOverviewCache.get(groupId);
  if (cached) {
    groupSettingsCache.set(groupId, cached);
    return { data: cached, error: null };
  }
  try {
    const data = await apiRequest<GroupSettings>(`/groups/${groupId}/settings`);
    groupSettingsCache.set(groupId, data);
    return { data, error: null };
  } catch (error: any) {
    return { data: null, error };
  }
}

export async function updateGroupSettings(input: { groupId: string; name: string; type: string; currency: string; description?: string }) {
  try {
    const data = await apiRequest<GroupSettings>(`/groups/${input.groupId}`, {
      method: 'PATCH',
      body: { name: input.name, type: input.type, currency: input.currency, description: input.description?.trim() || null },
    });
    invalidateGroupOverview(input.groupId);
    return { data, error: null };
  } catch (error: any) {
    return { data: null, error };
  }
}

export async function leaveGroup(groupId: string) {
  try {
    await apiRequest<void>(`/groups/${groupId}/leave`, { method: 'POST' });
    invalidateGroupOverview(groupId);
    return { error: null };
  } catch (error: any) {
    return { error };
  }
}

export async function deleteGroup(groupId: string) {
  try {
    await apiRequest<void>(`/groups/${groupId}`, { method: 'DELETE' });
    invalidateGroupOverview(groupId);
    return { error: null };
  } catch (error: any) {
    return { error };
  }
}

export async function getGroupMemberRoles(groupId: string) {
  try {
    return { data: await apiRequest<GroupMemberRole[]>(`/groups/${groupId}/members/roles`), error: null };
  } catch (error: any) {
    return { data: [], error };
  }
}

export async function updateGroupMemberRole(input: { groupId: string; userId: string; role: Exclude<GroupRole, 'owner'> }) {
  try {
    const data = await apiRequest<GroupMemberRole>(`/groups/${input.groupId}/members/${input.userId}/role`, {
      method: 'PATCH',
      body: { role: input.role },
    });
    invalidateGroupOverview(input.groupId);
    return { data, error: null };
  } catch (error: any) {
    return { data: null, error };
  }
}

export async function getGroupHistory(groupId: string, limit = 100, signal?: AbortSignal) {
  try {
    const data = await apiRequest<GroupHistory>(`/groups/${groupId}/history?limit=${limit}`, { signal });
    return { data, error: null };
  } catch (error: any) {
    return { data: null, error };
  }
}
