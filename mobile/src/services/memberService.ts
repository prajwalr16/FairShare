import * as Linking from 'expo-linking';
import { apiRequest } from './apiClient';

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

export async function getGroupMembers(groupId: string) {
  try {
    const data = await apiRequest<GroupMember[]>(`/groups/${groupId}/members`);
    return { data, error: null };
  } catch (error: any) {
    return { data: null, error };
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
    const data = await apiRequest<PendingInvitation>(
      `/groups/${groupId}/invitation`,
    );
    return { data, error: null };
  } catch (error: any) {
    return { data: null, error };
  }
}

export async function acceptGroupInvitation(groupId: string, fullName?: string) {
  try {
    const data = await apiRequest<any>(`/groups/${groupId}/members/accept`, {
      method: 'POST',
      body: {
        group_id: groupId,
        full_name: fullName?.trim() || null,
      },
    });
    return { data, error: null };
  } catch (error: any) {
    return { data: null, error };
  }
}

export async function removeGroupMember(
  groupId: string,
  memberId: string,
) {
  return removeGroupMemberFromGroup(groupId, memberId);
}

export async function removeGroupMemberFromGroup(
  groupId: string,
  memberId: string,
) {
  try {
    await apiRequest<void>(`/groups/${groupId}/members/${memberId}`, {
      method: 'DELETE',
    });
    return { error: null };
  } catch (error: any) {
    return { error };
  }
}
