import type { AuthChangeEvent, Session } from '@supabase/supabase-js';

import { supabase } from './client';

export async function getCurrentSession(): Promise<Session | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}

export function subscribeToAuthChanges(callback: (event: AuthChangeEvent, session: Session | null) => void): () => void {
  if (!supabase) return () => undefined;
  const { data } = supabase.auth.onAuthStateChange(callback);
  return () => data.subscription.unsubscribe();
}

export async function sendCode(email: string): Promise<void> {
  if (!supabase) throw new Error('cloud_unavailable');
  const { error } = await supabase.auth.signInWithOtp({ email: email.trim(), options: { shouldCreateUser: true } });
  if (error) throw error;
}

export async function verifyCode(email: string, token: string): Promise<void> {
  if (!supabase) throw new Error('cloud_unavailable');
  const { error } = await supabase.auth.verifyOtp({ email: email.trim(), token: token.trim(), type: 'email' });
  if (error) throw error;
}

export async function signOut(): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function deleteCloudAccount(): Promise<void> {
  if (!supabase) throw new Error('cloud_unavailable');
  const { error } = await supabase.functions.invoke('delete-account', { method: 'POST' });
  if (error) throw error;
  await signOut();
}
