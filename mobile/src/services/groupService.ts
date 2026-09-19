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

type GroupSettingsInput = {
  groupId: string;
  name: string;
  type: string;
  currency: string;
  description?: string;
};

export async function getGroupSettings(groupId: string) {
  const { data, error } = await supabase.rpc('get_group_settings', {
    p_group_id: groupId,
  });

  if (error) {
    return { data: null, error };
  }

  const row = Array.isArray(data) ? data[0] : data;

  if (!row) {
    return { data: null, error: new Error('Group not found.') };
  }

  return {
    data: row as GroupSettings,
    error: null,
  };
}

export async function updateGroupSettings(input: GroupSettingsInput) {
  const { data, error } = await supabase.rpc('update_group_settings', {
    p_group_id: input.groupId,
    p_name: input.name,
    p_type: input.type,
    p_currency: input.currency,
    p_description: input.description?.trim() || null,
  });

  return {
    data: (data || null) as GroupSettings | null,
    error: error || null,
  };
}

export async function leaveGroup(groupId: string) {
  const { error } = await supabase.rpc('leave_group', {
    p_group_id: groupId,
  });

  return { error: error || null };
}

export async function deleteGroup(groupId: string) {
  const { error } = await supabase.rpc('delete_group', {
    p_group_id: groupId,
  });

  return { error: error || null };
}


export async function getGroupMemberRoles(groupId: string) {
  const { data, error } = await supabase.rpc('get_group_member_roles', {
    p_group_id: groupId,
  });

  return {
    data: (data || []) as GroupMemberRole[],
    error: error || null,
  };
}

export async function updateGroupMemberRole(input: {
  groupId: string;
  userId: string;
  role: Exclude<GroupRole, 'owner'>;
}) {
  const { data, error } = await supabase.rpc('update_group_member_role', {
    p_group_id: input.groupId,
    p_user_id: input.userId,
    p_role: input.role,
  });

  const row = Array.isArray(data) ? data[0] : data;
  return {
    data: (row || null) as GroupMemberRole | null,
    error: error || null,
  };
}