import NetInfo from '@react-native-community/netinfo';
import { AppState, type AppStateStatus } from 'react-native';

import { getDatabase } from '../../db/database';
import { countDirtyRows, getSyncValue, setSyncValue } from '../../db/repositories/syncStateRepository';
import type { Family, FunctionRecord, Invitation, ReminderOffset } from '../../domain/types';
import { cancelInvitationReminders, scheduleInvitationReminders } from '../notifications';
import { supabase } from '../../cloud/client';
import { useSyncStore } from '../../store/sync';
import { chooseMergedRow } from './merge';
import { cursorFilter, cursorFromRow, type PullCursor } from './cursor';
import {
  familyFromCloud,
  familyToCloud,
  invitationFromCloud,
  invitationToCloud,
  recordFromCloud,
  recordToCloud,
} from './mappers';

type LocalFamilyRow = {
  id: string; family_name: string; primary_person: string | null; place: string | null; relationship: string | null;
  phone: string | null; notes: string | null; created_at: string; updated_at: string; deleted_at: string | null; is_dirty: number;
};
type LocalRecordRow = {
  id: string; family_id: string; date: string; date_precision: FunctionRecord['datePrecision']; function_type: FunctionRecord['functionType'];
  function_name: string | null; direction: FunctionRecord['direction']; record_kind: FunctionRecord['recordKind']; amount: number; added_by: string | null;
  notes: string | null; created_at: string; updated_at: string; deleted_at: string | null; is_dirty: number;
};
type LocalInvitationRow = {
  id: string; family_id: string; function_type: Invitation['functionType']; function_name: string | null; function_date: string; function_time: string | null;
  reminders_enabled: number; reminder_offsets: string; status: Invitation['status']; notes: string | null; notification_ids: string;
  created_at: string; updated_at: string; deleted_at: string | null; is_dirty: number;
};

const PAGE_SIZE = 500;
const PUSH_BATCH_SIZE = 100;
let inFlight: Promise<void> | null = null;
let rerunRequested = false;
let retryAttempt = 0;
let retryTimer: ReturnType<typeof setTimeout> | undefined;

function familyFromLocal(row: LocalFamilyRow): Family {
  return {
    id: row.id, familyName: row.family_name, primaryPerson: row.primary_person, place: row.place,
    relationship: row.relationship, phone: row.phone, notes: row.notes, createdAt: row.created_at,
    updatedAt: row.updated_at, deletedAt: row.deleted_at, isDirty: row.is_dirty === 1,
  };
}

function recordFromLocal(row: LocalRecordRow): FunctionRecord {
  return {
    id: row.id, familyId: row.family_id, date: row.date, datePrecision: row.date_precision, functionType: row.function_type,
    functionName: row.function_name, direction: row.direction, recordKind: row.record_kind, amount: row.amount, addedBy: row.added_by,
    notes: row.notes, createdAt: row.created_at, updatedAt: row.updated_at, deletedAt: row.deleted_at, isDirty: row.is_dirty === 1,
  };
}

function invitationFromLocal(row: LocalInvitationRow): Invitation {
  let reminderOffsets: ReminderOffset[] = [];
  let notificationIds: string[] = [];
  try { reminderOffsets = JSON.parse(row.reminder_offsets) as ReminderOffset[]; } catch { reminderOffsets = ['7D', '1D', 'MORNING_OF']; }
  try { notificationIds = JSON.parse(row.notification_ids) as string[]; } catch { notificationIds = []; }
  return {
    id: row.id, familyId: row.family_id, functionType: row.function_type, functionName: row.function_name,
    functionDate: row.function_date, functionTime: row.function_time, remindersEnabled: row.reminders_enabled === 1,
    reminderOffsets, status: row.status, notes: row.notes, notificationIds, createdAt: row.created_at,
    updatedAt: row.updated_at, deletedAt: row.deleted_at, isDirty: row.is_dirty === 1,
  };
}

async function pushTable(table: 'families' | 'function_records' | 'invitations', householdId: string): Promise<void> {
  if (!supabase) return;
  const db = await getDatabase();
  while (true) {
    const rows = await db.getAllAsync<LocalFamilyRow | LocalRecordRow | LocalInvitationRow>(
      `SELECT * FROM ${table} WHERE is_dirty = 1 ORDER BY updated_at, id LIMIT ${PUSH_BATCH_SIZE}`,
    );
    if (!rows.length) break;
    const cloudRows = rows.map((row) => {
      if (table === 'families') return familyToCloud(familyFromLocal(row as LocalFamilyRow), householdId);
      if (table === 'function_records') return recordToCloud(recordFromLocal(row as LocalRecordRow), householdId);
      return invitationToCloud(invitationFromLocal(row as LocalInvitationRow), householdId);
    });
    const { data, error } = await supabase.from(table).upsert(cloudRows, { onConflict: 'id' }).select('id');
    if (error) throw error;
    if ((data ?? []).length < rows.length) await setSyncValue(`cursor_${table}`, '');
    for (const row of rows) {
      await db.runAsync(`UPDATE ${table} SET is_dirty = 0 WHERE id = ? AND updated_at = ?`, row.id, row.updated_at);
    }
    if (rows.length < PUSH_BATCH_SIZE) break;
  }
}

async function localFamily(id: string): Promise<Family | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<LocalFamilyRow>('SELECT * FROM families WHERE id = ?', id);
  return row ? familyFromLocal(row) : null;
}

async function localRecord(id: string): Promise<FunctionRecord | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<LocalRecordRow>('SELECT * FROM function_records WHERE id = ?', id);
  return row ? recordFromLocal(row) : null;
}

async function localInvitation(id: string): Promise<Invitation | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<LocalInvitationRow>('SELECT * FROM invitations WHERE id = ?', id);
  return row ? invitationFromLocal(row) : null;
}

async function writeFamily(family: Family): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT INTO families (id, family_name, primary_person, place, relationship, phone, notes, created_at, updated_at, deleted_at, is_dirty)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET family_name=excluded.family_name, primary_person=excluded.primary_person,
       place=excluded.place, relationship=excluded.relationship, phone=excluded.phone, notes=excluded.notes,
       created_at=excluded.created_at, updated_at=excluded.updated_at, deleted_at=excluded.deleted_at, is_dirty=excluded.is_dirty`,
    family.id, family.familyName, family.primaryPerson, family.place, family.relationship, family.phone, family.notes,
    family.createdAt, family.updatedAt, family.deletedAt, family.isDirty ? 1 : 0,
  );
}

async function writeRecord(record: FunctionRecord): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT INTO function_records (id, family_id, date, date_precision, function_type, function_name, direction, record_kind,
       amount, added_by, notes, created_at, updated_at, deleted_at, is_dirty)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET family_id=excluded.family_id, date=excluded.date, date_precision=excluded.date_precision,
       function_type=excluded.function_type, function_name=excluded.function_name, direction=excluded.direction,
       record_kind=excluded.record_kind, amount=excluded.amount, added_by=excluded.added_by, notes=excluded.notes,
       created_at=excluded.created_at, updated_at=excluded.updated_at, deleted_at=excluded.deleted_at, is_dirty=excluded.is_dirty`,
    record.id, record.familyId, record.date, record.datePrecision, record.functionType, record.functionName, record.direction,
    record.recordKind, record.amount, record.addedBy, record.notes, record.createdAt, record.updatedAt, record.deletedAt, record.isDirty ? 1 : 0,
  );
}

async function writeInvitation(invitation: Invitation): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT INTO invitations (id, family_id, function_type, function_name, function_date, function_time, reminders_enabled,
       reminder_offsets, status, notes, notification_ids, created_at, updated_at, deleted_at, is_dirty)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET family_id=excluded.family_id, function_type=excluded.function_type,
       function_name=excluded.function_name, function_date=excluded.function_date, function_time=excluded.function_time,
       reminders_enabled=excluded.reminders_enabled, reminder_offsets=excluded.reminder_offsets, status=excluded.status,
       notes=excluded.notes, notification_ids=excluded.notification_ids, created_at=excluded.created_at,
       updated_at=excluded.updated_at, deleted_at=excluded.deleted_at, is_dirty=excluded.is_dirty`,
    invitation.id, invitation.familyId, invitation.functionType, invitation.functionName, invitation.functionDate, invitation.functionTime,
    invitation.remindersEnabled ? 1 : 0, JSON.stringify(invitation.reminderOffsets), invitation.status, invitation.notes,
    JSON.stringify(invitation.notificationIds), invitation.createdAt, invitation.updatedAt, invitation.deletedAt, invitation.isDirty ? 1 : 0,
  );
}

async function applyFamily(row: Record<string, unknown>): Promise<void> {
  const remote = familyFromCloud(row);
  const choice = chooseMergedRow(await localFamily(remote.id), remote);
  if (choice.kind !== 'keep-local') await writeFamily(choice.value);
}

async function applyRecord(row: Record<string, unknown>): Promise<void> {
  const remote = recordFromCloud(row);
  const choice = chooseMergedRow(await localRecord(remote.id), remote);
  if (choice.kind !== 'keep-local') await writeRecord(choice.value);
}

async function applyInvitation(row: Record<string, unknown>, changedIds: Set<string>): Promise<void> {
  const remote = invitationFromCloud(row);
  const local = await localInvitation(remote.id);
  const choice = chooseMergedRow(local, remote);
  if (choice.kind === 'keep-local') return;
  if (local) await cancelInvitationReminders(local.notificationIds);
  await writeInvitation({ ...choice.value, notificationIds: [] });
  changedIds.add(remote.id);
}

async function loadCursor(table: string): Promise<PullCursor | null> {
  const raw = await getSyncValue(`cursor_${table}`);
  if (!raw) return null;
  try {
    const cursor = JSON.parse(raw) as Partial<PullCursor>;
    return typeof cursor.timestamp === 'string' && typeof cursor.id === 'string'
      ? { timestamp: cursor.timestamp, id: cursor.id }
      : null;
  } catch { return null; }
}

async function pullTable(table: 'families' | 'function_records' | 'invitations', householdId: string, changedInvitations: Set<string>): Promise<void> {
  if (!supabase) return;
  let cursor = await loadCursor(table);
  while (true) {
    let query = supabase.from(table).select('*').eq('household_id', householdId)
      .order('server_updated_at', { ascending: true }).order('id', { ascending: true }).limit(PAGE_SIZE);
    const filter = cursorFilter(cursor);
    if (filter) query = query.or(filter);
    const { data, error } = await query;
    if (error) throw error;
    const rows = (data ?? []) as unknown as Record<string, unknown>[];
    if (!rows.length) break;
    for (const row of rows) {
      if (table === 'families') await applyFamily(row);
      else if (table === 'function_records') await applyRecord(row);
      else await applyInvitation(row, changedInvitations);
    }
    const last = rows[rows.length - 1];
    cursor = cursorFromRow(last);
    await setSyncValue(`cursor_${table}`, JSON.stringify(cursor));
    if (rows.length < PAGE_SIZE) break;
  }
}

async function performSync(): Promise<void> {
  const state = useSyncStore.getState();
  if (!supabase) {
    state.setStatus('idle');
    state.setPendingCount(await countDirtyRows());
    return;
  }
  const householdId = await getSyncValue('cloudHouseholdId');
  if (!householdId) {
    state.setStatus('idle');
    state.setPendingCount(await countDirtyRows());
    return;
  }
  const network = await NetInfo.fetch();
  if (network.isConnected === false) {
    state.setStatus('offline');
    state.setPendingCount(await countDirtyRows());
    return;
  }
  state.setStatus('syncing');
  try {
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) throw sessionError;
    const session = sessionData.session;
    if (!session) { state.setStatus('idle'); return; }
    const previousAccount = await getSyncValue('accountUserId');
    if (previousAccount && previousAccount !== session.user.id) throw new Error('account_switch_required');

    for (const table of ['families', 'function_records', 'invitations'] as const) await pushTable(table, householdId);
    const changedInvitations = new Set<string>();
    for (const table of ['families', 'function_records', 'invitations'] as const) await pullTable(table, householdId, changedInvitations);
    for (const id of changedInvitations) await scheduleInvitationReminders(id, { requestPermission: false });

    const { data: members, error: memberError } = await supabase.from('household_members')
      .select('user_id').eq('household_id', householdId);
    if (memberError) throw memberError;
    if (!members?.some((member) => member.user_id === session.user.id)) throw new Error('membership_lost');
    await setSyncValue('memberCount', String(members.length));
    const syncedAt = new Date().toISOString();
    await setSyncValue('lastSyncedAt', syncedAt);
    await setSyncValue('accountUserId', session.user.id);
    state.setLastSyncedAt(syncedAt);
    state.setStatus('idle');
    state.setPendingCount(await countDirtyRows());
    retryAttempt = 0;
    if (retryTimer) clearTimeout(retryTimer);
    retryTimer = undefined;
  } catch {
    state.setStatus('error');
    state.setPendingCount(await countDirtyRows());
    if (!retryTimer) {
      const delay = Math.min(300000, 5000 * (2 ** retryAttempt));
      retryAttempt = Math.min(retryAttempt + 1, 6);
      retryTimer = setTimeout(() => {
        retryTimer = undefined;
        void syncNow();
      }, delay);
    }
  }
}

export function syncNow(): Promise<void> {
  if (inFlight) {
    rerunRequested = true;
    return inFlight.then(async () => {
      if (!rerunRequested) return;
      rerunRequested = false;
      await syncNow();
    });
  }
  inFlight = performSync().finally(() => { inFlight = null; });
  return inFlight;
}

export function attachSyncAutoTriggers(): () => void {
  const currentStatus = (state: AppStateStatus) => {
    if (!supabase) return;
    if (state === 'active') {
      void supabase.auth.startAutoRefresh();
      void syncNow();
    } else {
      void supabase.auth.stopAutoRefresh();
    }
  };
  void supabase?.auth.startAutoRefresh();
  const appSubscription = AppState.addEventListener('change', currentStatus);
  const networkUnsubscribe = NetInfo.addEventListener((state) => {
    if (state.isConnected) void syncNow();
  });
  return () => { appSubscription.remove(); networkUnsubscribe(); void supabase?.auth.stopAutoRefresh(); };
}
