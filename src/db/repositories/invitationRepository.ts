import * as Crypto from 'expo-crypto';

import { getDatabase } from '../database';
import type { Invitation, InvitationStatus, ReminderOffset } from '../../domain/types';
import { isValidDateOnly } from '../../domain/format';
import { scheduleSync } from '../../services/sync/syncScheduler';

export type InvitationInput = Pick<Invitation, 'familyId' | 'functionType' | 'functionDate'> &
  Partial<Pick<Invitation, 'functionName' | 'functionTime' | 'remindersEnabled' | 'reminderOffsets' | 'notes'>>;

type InvitationRow = {
  id: string;
  family_id: string;
  function_type: Invitation['functionType'];
  function_name: string | null;
  function_date: string;
  function_time: string | null;
  reminders_enabled: number;
  reminder_offsets: string;
  status: InvitationStatus;
  notes: string | null;
  notification_ids: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  is_dirty: number;
};

const DEFAULT_OFFSETS: ReminderOffset[] = ['7D', '1D', 'MORNING_OF', 'EVENING_OF', 'NEXT_MORNING'];

function fromRow(row: InvitationRow): Invitation {
  return {
    id: row.id,
    familyId: row.family_id,
    functionType: row.function_type,
    functionName: row.function_name,
    functionDate: row.function_date,
    functionTime: row.function_time,
    remindersEnabled: row.reminders_enabled === 1,
    reminderOffsets: JSON.parse(row.reminder_offsets) as ReminderOffset[],
    status: row.status,
    notes: row.notes,
    notificationIds: JSON.parse(row.notification_ids) as string[],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
    isDirty: row.is_dirty === 1,
  };
}

function validate(input: InvitationInput): void {
  if (!input.familyId) throw new Error('Family is required');
  if (!isValidDateOnly(input.functionDate)) throw new Error('Date must use YYYY-MM-DD');
}

export async function createInvitation(input: InvitationInput): Promise<Invitation> {
  validate(input);
  const db = await getDatabase();
  const now = new Date().toISOString();
  const invitation: Invitation = {
    id: Crypto.randomUUID(),
    familyId: input.familyId,
    functionType: input.functionType,
    functionName: input.functionName?.trim() || null,
    functionDate: input.functionDate,
    functionTime: input.functionTime || null,
    remindersEnabled: input.remindersEnabled ?? true,
    reminderOffsets: input.reminderOffsets ?? DEFAULT_OFFSETS,
    status: 'UPCOMING',
    notes: input.notes?.trim() || null,
    notificationIds: [],
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    isDirty: true,
  };
  await db.runAsync(
    `INSERT INTO invitations (id, family_id, function_type, function_name, function_date, function_time,
      reminders_enabled, reminder_offsets, status, notes, notification_ids, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    invitation.id,
    invitation.familyId,
    invitation.functionType,
    invitation.functionName,
    invitation.functionDate,
    invitation.functionTime,
    invitation.remindersEnabled ? 1 : 0,
    JSON.stringify(invitation.reminderOffsets),
    invitation.status,
    invitation.notes,
    JSON.stringify([]),
    invitation.createdAt,
    invitation.updatedAt,
  );
  scheduleSync();
  return invitation;
}

export async function getInvitation(id: string): Promise<Invitation | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<InvitationRow>('SELECT * FROM invitations WHERE id = ? AND deleted_at IS NULL', id);
  return row ? fromRow(row) : null;
}

export async function listInvitations(): Promise<Invitation[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<InvitationRow>(
    'SELECT * FROM invitations WHERE deleted_at IS NULL ORDER BY function_date, function_time',
  );
  return rows.map(fromRow);
}

export async function updateInvitation(id: string, input: InvitationInput): Promise<void> {
  validate(input);
  const db = await getDatabase();
  await db.runAsync(
    `UPDATE invitations SET family_id = ?, function_type = ?, function_name = ?, function_date = ?,
      function_time = ?, reminders_enabled = ?, reminder_offsets = ?, notes = ?, updated_at = ?, is_dirty = 1
     WHERE id = ? AND deleted_at IS NULL`,
    input.familyId,
    input.functionType,
    input.functionName?.trim() || null,
    input.functionDate,
    input.functionTime || null,
    input.remindersEnabled === false ? 0 : 1,
    JSON.stringify(input.reminderOffsets ?? DEFAULT_OFFSETS),
    input.notes?.trim() || null,
    new Date().toISOString(),
    id,
  );
  scheduleSync();
}

export async function setInvitationStatus(id: string, status: InvitationStatus): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    'UPDATE invitations SET status = ?, updated_at = ?, is_dirty = 1 WHERE id = ? AND deleted_at IS NULL',
    status,
    new Date().toISOString(),
    id,
  );
  scheduleSync();
}

export async function setInvitationNotificationIds(id: string, notificationIds: string[]): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    'UPDATE invitations SET notification_ids = ? WHERE id = ? AND deleted_at IS NULL',
    JSON.stringify(notificationIds),
    id,
  );
}

export async function softDeleteInvitation(id: string): Promise<string[]> {
  const invitation = await getInvitation(id);
  if (!invitation) return [];
  const db = await getDatabase();
  const now = new Date().toISOString();
  await db.runAsync(
    'UPDATE invitations SET deleted_at = ?, updated_at = ?, is_dirty = 1 WHERE id = ? AND deleted_at IS NULL',
    now,
    now,
    id,
  );
  scheduleSync();
  return invitation.notificationIds;
}

export async function clearNotebook(): Promise<void> {
  const db = await getDatabase();
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM invitations');
    await db.runAsync('DELETE FROM function_records');
    await db.runAsync('DELETE FROM families');
    await db.runAsync('DELETE FROM sync_state');
  });
}
