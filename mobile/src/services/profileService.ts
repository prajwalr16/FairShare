import { supabase } from '../config/supabase';
import { apiRequest } from './apiClient';

export type UserProfile = {
  id: string;
  email: string;
  full_name: string;
  phone_number: string;
  created_at: string | null;
};

type ProfileMetadata = {
  full_name?: unknown;
  phone_number?: unknown;
};

function asText(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function toProfile(user: any | null): UserProfile | null {
  if (!user) return null;

  const metadata = (user.user_metadata || {}) as ProfileMetadata;

  return {
    id: user.id,
    email: asText(user.email),
    full_name: asText(metadata.full_name),
    phone_number: asText(metadata.phone_number),
    created_at: typeof user.created_at === 'string' ? user.created_at : null,
  };
}

export async function getUserProfile(): Promise<{
  data: UserProfile | null;
  error: any;
}> {
  const { data, error } = await supabase.auth.getUser();

  if (error) {
    return { data: null, error };
  }

  // Synchronize user into PostgreSQL users table in background
  void apiRequest('/me').catch(() => {});

  return { data: toProfile(data.user), error: null };
}

export async function updateUserProfile(input: {
  fullName: string;
  phoneNumber: string;
}): Promise<{
  data: UserProfile | null;
  error: any;
}> {
  const trimmedName = input.fullName.trim();
  const trimmedPhone = input.phoneNumber.trim();

  const { data, error } = await supabase.auth.updateUser({
    data: {
      full_name: trimmedName,
      phone_number: trimmedPhone,
    },
  });

  if (error) {
    return { data: null, error };
  }

  // Also synchronize directly with backend PostgreSQL users table
  try {
    await apiRequest('/me', {
      method: 'PATCH',
      body: { full_name: trimmedName },
    });
  } catch (backendError) {
    console.warn('[FairShare] Failed to sync updated profile to backend DB:', backendError);
  }

  return { data: toProfile(data.user), error: null };
}

export async function changePassword(
  email: string,
  currentPassword: string,
  newPassword: string,
) {
  const { error: verifyError } = await supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password: currentPassword,
  });

  if (verifyError) {
    return { error: verifyError };
  }

  return await supabase.auth.updateUser({ password: newPassword });
}

export async function signOutAccount() {
  return await supabase.auth.signOut({ scope: 'local' });
}
