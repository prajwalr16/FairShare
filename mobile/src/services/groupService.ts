import { apiRequest } from './apiClient';

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

export async function getGroups() {
  try {
    return { data: await apiRequest<GroupSummary[]>('/groups'), error: null };
  } catch (error: any) {
    return { data: null, error };
  }
}

export async function createGroup(input: {
  name: string;
  type: string;
  currency?: string;
  description?: string;
}) {
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
  try {
    return {
      data: await apiRequest<GroupSettings>(`/groups/${groupId}/settings`),
      error: null,
    };
  } catch (error: any) {
    return { data: null, error };
  }
}

export async function updateGroupSettings(input: {
  groupId: string;
  name: string;
  type: string;
  currency: string;
  description?: string;
}) {
  try {
    const data = await apiRequest<GroupSettings>(`/groups/${input.groupId}`, {
      method: 'PATCH',
      body: {
        name: input.name,
        type: input.type,
        currency: input.currency,
        description: input.description?.trim() || null,
      },
    });
    return { data, error: null };
  } catch (error: any) {
    return { data: null, error };
  }
}

export async function leaveGroup(groupId: string) {
  try {
    await apiRequest<void>(`/groups/${groupId}/leave`, { method: 'POST' });
    return { error: null };
  } catch (error: any) {
    return { error };
  }
}

export async function deleteGroup(groupId: string) {
  try {
    await apiRequest<void>(`/groups/${groupId}`, { method: 'DELETE' });
    return { error: null };
  } catch (error: any) {
    return { error };
  }
}

export async function getGroupMemberRoles(groupId: string) {
  try {
    return {
      data: await apiRequest<GroupMemberRole[]>(`/groups/${groupId}/members/roles`),
      error: null,
    };
  } catch (error: any) {
    return { data: [], error };
  }
}

export async function updateGroupMemberRole(input: {
  groupId: string;
  userId: string;
  role: Exclude<GroupRole, 'owner'>;
}) {
  try {
    const data = await apiRequest<GroupMemberRole>(
      `/groups/${input.groupId}/members/${input.userId}/role`,
      {
        method: 'PATCH',
        body: { role: input.role },
      },
    );
    return { data, error: null };
  } catch (error: any) {
    return { data: null, error };
  }
}
