import { supabase } from '../config/supabase';

export async function signUp(
  email: string,
  password: string,
  fullName = ''
) {
  return await supabase.auth.signUp({
    email: email.trim().toLowerCase(),
    password,
    options: {
      data: {
        full_name: fullName.trim(),
      },
    },
  });
}

export async function signIn(
  email: string,
  password: string
) {
  return await supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  });
}

export async function signOut() {
  return await supabase.auth.signOut({ scope: 'local' });
}

export async function forgotPassword(
  email: string,
  redirectTo: string
) {
  return await supabase.auth.resetPasswordForEmail(
    email.trim().toLowerCase(),
    { redirectTo }
  );
}

/**
 * UI-side current user lookup should use the locally persisted Supabase session.
 * The FastAPI bearer-token boundary remains the authoritative security check.
 */
export async function getCurrentUser() {
  const { data, error } = await supabase.auth.getSession();
  return {
    data: { user: data.session?.user ?? null },
    error,
  };
}

export async function getCurrentSession() {
  return await supabase.auth.getSession();
}
