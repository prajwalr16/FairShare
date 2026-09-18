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
  return await supabase.auth.signOut();
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
