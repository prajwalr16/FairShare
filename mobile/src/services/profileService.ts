import { supabase } from '../config/supabase';

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

  return { data: toProfile(data.user), error: null };
}

export async function updateUserProfile(input: {
  fullName: string;
  phoneNumber: string;
}): Promise<{
  data: UserProfile | null;
  error: any;
}> {
  const { data, error } = await supabase.auth.updateUser({
    data: {
      full_name: input.fullName.trim(),
      phone_number: input.phoneNumber.trim(),
    },
  });

  if (error) {
    return { data: null, error };
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
  return await supabase.auth.signOut();
}
