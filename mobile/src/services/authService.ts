import { supabase } from '../config/supabase';

export const signUp = (email:string,password:string)=>
  supabase.auth.signUp({ email, password });

export const signIn = (email:string,password:string)=>
  supabase.auth.signInWithPassword({ email, password });

export const forgotPassword = (email:string)=>
  supabase.auth.resetPasswordForEmail(email);

export const signOut = ()=>supabase.auth.signOut();
