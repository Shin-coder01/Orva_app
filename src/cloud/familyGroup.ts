import * as Crypto from 'expo-crypto';

import { getSyncValue, markAllRowsDirty, resetPullCursors, setSyncValue } from '../db/repositories/syncStateRepository';
import { supabase } from './client';

export type FamilyGroupMember = { user_id: string; role: 'owner' | 'member'; display_name: string | null; created_at: string };
export type CurrentFamilyGroup = { householdId: string; displayName: string | null };

function requireCloud() {
  if (!supabase) throw new Error('cloud_unavailable');
  return supabase;
}

export async function findMyFamilyGroup(): Promise<CurrentFamilyGroup | null> {
  const client = requireCloud();
  const { data: sessionData, error: sessionError } = await client.auth.getSession();
  if (sessionError) throw sessionError;
  const userId = sessionData.session?.user.id;
  if (!userId) return null;
  const { data, error } = await client.from('household_members')
    .select('household_id, display_name').eq('user_id', userId).maybeSingle();
  if (error) throw error;
  return data ? { householdId: data.household_id, displayName: data.display_name } : null;
}

export async function startFamilyGroup(displayName: string): Promise<string> {
  const client = requireCloud();
  const localId = Crypto.randomUUID();
  const { data, error } = await client.rpc('ensure_household', { p_id: localId, p_display_name: displayName.trim() });
  if (error) throw error;
  const groupId = String(data);
  await setSyncValue('cloudHouseholdId', groupId);
  await setSyncValue('displayName', displayName.trim());
  await resetPullCursors();
  await markAllRowsDirty();
  return groupId;
}

export async function joinFamilyGroup(code: string, displayName: string): Promise<string> {
  const client = requireCloud();
  const { data, error } = await client.rpc('join_household', { p_code: code.trim().toUpperCase(), p_display_name: displayName.trim() });
  if (error) throw error;
  const groupId = String(data);
  await setSyncValue('cloudHouseholdId', groupId);
  await setSyncValue('displayName', displayName.trim());
  await resetPullCursors();
  await markAllRowsDirty();
  return groupId;
}

export async function loadFamilyGroupMembers(): Promise<FamilyGroupMember[]> {
  const client = requireCloud();
  const groupId = await getSyncValue('cloudHouseholdId');
  if (!groupId) return [];
  const { data, error } = await client.from('household_members')
    .select('user_id, role, display_name, created_at')
    .eq('household_id', groupId)
    .order('created_at');
  if (error) throw error;
  await setSyncValue('memberCount', String(data.length));
  return data as FamilyGroupMember[];
}

export async function createFamilyInvite(): Promise<string> {
  const client = requireCloud();
  const { data, error } = await client.rpc('create_invite');
  if (error) throw error;
  return String(data);
}

export async function updateMyDisplayName(displayName: string): Promise<void> {
  const client = requireCloud();
  const { data: sessionData } = await client.auth.getSession();
  const userId = sessionData.session?.user.id;
  const groupId = await getSyncValue('cloudHouseholdId');
  if (!userId || !groupId) throw new Error('not_in_group');
  const { error } = await client.from('household_members')
    .update({ display_name: displayName.trim() })
    .eq('household_id', groupId)
    .eq('user_id', userId);
  if (error) throw error;
  await setSyncValue('displayName', displayName.trim());
}

export async function leaveFamilyGroup(): Promise<void> {
  const client = requireCloud();
  const { error } = await client.rpc('leave_household');
  if (error) throw error;
  await setSyncValue('cloudHouseholdId', '');
  await setSyncValue('memberCount', '0');
  await resetPullCursors();
}
