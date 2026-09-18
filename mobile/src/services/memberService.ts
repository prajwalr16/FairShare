import * as Linking from 'expo-linking';
import { supabase } from '../config/supabase';

export type GroupMember = {
  id: string;
  group_id: string;
  user_id: string | null;
  email: string;
  role: 'owner' | 'member' | string;
  status: 'pending' | 'active' | string;
  full_name?: string | null;
  created_at?: string;
};

export async function getGroupMembers(
  groupId: string
) {
  const { data: members, error } = await supabase
    .from('group_members')
    .select('*')
    .eq('group_id', groupId)
    .order('role', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) {
    return { data: null, error };
  }

  const userIds = (members || [])
    .map((member: any) => member.user_id)
    .filter(Boolean);

  let profileMap: Record<string, string | null> = {};

  if (userIds.length) {
    const { data: profiles, error: profileError } =
      await supabase
        .from('profiles')
        .select('id,full_name')
        .in('id', userIds);

    if (profileError) {
      return {
        data: null,
        error: profileError,
      };
    }

    profileMap = Object.fromEntries(
      (profiles || []).map((profile: any) => [
        profile.id,
        profile.full_name,
      ])
    );
  }

  const enriched = (members || []).map(
    (member: any) => ({
      ...member,
      full_name: member.user_id
        ? profileMap[member.user_id] || null
        : null,
    })
  );

  return {
    data: enriched as GroupMember[],
    error: null,
  };
}

export async function addGroupMember(
  groupId: string,
  email: string
) {
  const redirectTo = Linking.createURL(
    'accept-invite'
  );

  const { data, error } =
    await supabase.functions.invoke(
      'invite-group-member',
      {
        body: {
          groupId,
          email: email.trim().toLowerCase(),
          redirectTo,
        },
      }
    );

  if (error) {
    let message = error.message;

    try {
      const context = (error as any).context;

      if (context?.text) {
        const raw = await context.text();

        if (raw) {
          try {
            const body = JSON.parse(raw);
            message = body?.error || body?.message || raw;
          } catch {
            message = raw;
          }
        }
      }
    } catch {
      // Keep the SDK error when the response body cannot be read.
    }

    return {
      data: null,
      error: new Error(message),
    };
  }

  if (!data?.ok) {
    return {
      data: null,
      error: new Error(
        data?.error || 'Unable to add member.'
      ),
    };
  }

  return {
    data,
    error: null,
  };
}

export async function removeGroupMember(
  memberId: string
) {
  return await supabase
    .from('group_members')
    .delete()
    .eq('id', memberId);
}
