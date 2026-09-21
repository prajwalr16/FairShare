import * as Linking from 'expo-linking';
import { apiRequest } from './apiClient';
import { invalidateGroupOverview } from './groupService';

export type GroupMember = {
  id: string;
  group_id: string;
  user_id: string | null;
  email: string;
  role: 'owner' | 'admin' | 'member' | 'viewer' | string;
  status: 'pending' | 'active' | string;
  full_name?: string | null;
  created_at?: string;
};

const GROUP_MEMBER_CACHE_TTL_MS = 60_000;
const groupMemberCache = new Map<string, { data: GroupMember[]; cachedAt: number }>();
const groupMemberRequests = new Map<string, Promise<{ data: GroupMember[] | null; error: any }>>();

export function invalidateGroupMembers(groupId: string) {
  groupMemberCache.delete(groupId);
}

export function clearGroupMemberCache() {
  groupMemberCache.clear();
  groupMemberRequests.clear();
}

export async function getGroupMembers(groupId: string, signal?: AbortSignal, force = false) {
  const cached = groupMemberCache.get(groupId);
  if (!force && cached && Date.now() - cached.cachedAt < GROUP_MEMBER_CACHE_TTL_MS) {
    return { data: cached.data, error: null };
  }

  if (!force) {
    const inFlight = groupMemberRequests.get(groupId);
    if (inFlight) return inFlight;
  }

  const request = (async () => {
    try {
      const data = await apiRequest<GroupMember[]>(`/groups/${groupId}/members`, { signal });
      groupMemberCache.set(groupId, { data, cachedAt: Date.now() });
      return { data, error: null };
    } catch (error: any) {
      return { data: null, error };
    }
  })();

  if (!force) groupMemberRequests.set(groupId, request);
  try {
    return await request;
  } finally {
    if (groupMemberRequests.get(groupId) === request) {
      groupMemberRequests.delete(groupId);
    }
  }
}

export async function addGroupMember(groupId: string, email: string) {
  try {
    const redirectTo = Linking.createURL('accept-invite');
    const data = await apiRequest<any>(`/groups/${groupId}/members/invite`, {
      method: 'POST',
      body: {
        email: email.trim().toLowerCase(),
        redirect_to: redirectTo,
      },
    });
    invalidateGroupMembers(groupId);
    invalidateGroupOverview(groupId);
    return { data, error: null };
  } catch (error: any) {
    return { data: null, error };
  }
}

export type PendingInvitation = {
  group_id: string;
  group_name: string;
  email: string;
  member_id: string;
  status: string;
};

export async function getPendingInvitation(groupId: string) {
  try {
    const data = await apiRequest<PendingInvitation>(`/groups/${groupId}/invitation`);
    return { data, error: null };
  } catch (error: any) {
    return { data: null, error };
  }
}

export async function acceptGroupInvitation(groupId: string, fullName?: string) {
  try {
    const data = await apiRequest<any>(`/groups/${groupId}/members/accept`, {
      method: 'POST',
      body: { group_id: groupId, full_name: fullName?.trim() || null },
    });
    invalidateGroupMembers(groupId);
    invalidateGroupOverview(groupId);
    return { data, error: null };
  } catch (error: any) {
    return { data: null, error };
  }
}

export async function removeGroupMember(groupId: string, memberId: string) {
  return removeGroupMemberFromGroup(groupId, memberId);
}

export async function removeGroupMemberFromGroup(groupId: string, memberId: string) {
  try {
    await apiRequest<void>(`/groups/${groupId}/members/${memberId}`, { method: 'DELETE' });
    invalidateGroupMembers(groupId);
    invalidateGroupOverview(groupId);
    return { error: null };
  } catch (error: any) {
    return { error };
  }
}
