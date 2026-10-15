import * as Crypto from 'expo-crypto';

import { getDatabase } from '../database';
import type { DatePrecision, FunctionRecord } from '../../domain/types';
import { isValidDateOnly } from '../../domain/format';
import { getSyncValue } from './syncStateRepository';
import { scheduleSync } from '../../services/sync/syncScheduler';

export type FunctionRecordInput = Pick<
  FunctionRecord,
  'familyId' | 'date' | 'datePrecision' | 'functionType' | 'direction' | 'amount'
> & Partial<Pick<FunctionRecord, 'functionName' | 'notes' | 'addedBy'>> & { invitationId?: string };

type RecordRow = {
  id: string;
  family_id: string;
  date: string;
  date_precision: FunctionRecord['datePrecision'];
  function_type: FunctionRecord['functionType'];
  function_name: string | null;
  direction: FunctionRecord['direction'];
  record_kind: FunctionRecord['recordKind'];
  amount: number;
  added_by: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  is_dirty: number;
};

function fromRow(row: RecordRow): FunctionRecord {
  return {
    id: row.id,
    familyId: row.family_id,
    date: row.date,
    datePrecision: row.date_precision,
    functionType: row.function_type,
    functionName: row.function_name,
    direction: row.direction,
    recordKind: row.record_kind,
    amount: row.amount,
    addedBy: row.added_by,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
    isDirty: row.is_dirty === 1,
  };
}

function normalizedDate(date: string, precision: DatePrecision): string {
  const match = /^(\d{4})-\d{2}-\d{2}$/.exec(date);
  if (!match || !isValidDateOnly(date)) throw new Error('Date must use YYYY-MM-DD');
  return precision === 'YEAR' ? `${match[1]}-01-01` : date;
}

function validateInput(input: FunctionRecordInput): void {
  if (!input.familyId) throw new Error('Family is required');
  if (!Number.isInteger(input.amount) || input.amount < 0 || input.amount > 9999999) {
    throw new Error('Amount must be a whole number from 0 to 9999999');
  }
}

export async function createRecord(input: FunctionRecordInput): Promise<FunctionRecord> {
  validateInput(input);
  const database = await getDatabase();
  const now = new Date().toISOString();
  const inFamilyGroup = Boolean(await getSyncValue('cloudHouseholdId'));
  const displayName = inFamilyGroup ? await getSyncValue('displayName') : null;
  const record: FunctionRecord = {
    id: Crypto.randomUUID(),
    familyId: input.familyId,
    date: normalizedDate(input.date, input.datePrecision),
    datePrecision: input.datePrecision,
    functionType: input.functionType,
    functionName: input.functionName?.trim() || null,
    direction: input.direction,
    recordKind: 'MONEY',
    amount: input.amount,
    addedBy: input.addedBy ?? displayName,
    notes: input.notes?.trim() || null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    isDirty: true,
  };

  const insert = () => database.runAsync(
    `INSERT INTO function_records
      (id, family_id, date, date_precision, function_type, function_name, direction,
       record_kind, amount, added_by, notes, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    record.id,
    record.familyId,
    record.date,
    record.datePrecision,
    record.functionType,
    record.functionName,
    record.direction,
    record.recordKind,
    record.amount,
    record.addedBy,
    record.notes,
    record.createdAt,
    record.updatedAt,
  );
  if (input.invitationId) {
    await database.withTransactionAsync(async () => {
      await insert();
      const result = await database.runAsync(
        `UPDATE invitations SET status = 'ATTENDED', updated_at = ?, is_dirty = 1
         WHERE id = ? AND deleted_at IS NULL AND status = 'UPCOMING'`,
        now,
        input.invitationId ?? null,
      );
      if (result.changes !== 1) throw new Error('invitation_already_handled');
    });
  } else {
    await insert();
  }
  scheduleSync();
  return record;
}

export async function updateRecord(id: string, input: FunctionRecordInput): Promise<void> {
  validateInput(input);
  const database = await getDatabase();
  const update = () => database.runAsync(
    `UPDATE function_records SET family_id = ?, date = ?, date_precision = ?, function_type = ?,
      function_name = ?, direction = ?, amount = ?, notes = ?, updated_at = ?, is_dirty = 1
     WHERE id = ? AND deleted_at IS NULL`,
    input.familyId,
    normalizedDate(input.date, input.datePrecision),
    input.datePrecision,
    input.functionType,
    input.functionName?.trim() || null,
    input.direction,
    input.amount,
    input.notes?.trim() || null,
    new Date().toISOString(),
    id,
  );
  if (input.invitationId) {
    await database.withTransactionAsync(async () => {
      await update();
      await database.runAsync(
        `UPDATE invitations SET status = 'ATTENDED', updated_at = ?, is_dirty = 1
         WHERE id = ? AND deleted_at IS NULL`,
        new Date().toISOString(),
        input.invitationId ?? null,
      );
    });
  } else {
    await update();
  }
  scheduleSync();
}

export async function hasDuplicateRecord(input: {
  familyId: string;
  date: string;
  direction: FunctionRecord['direction'];
  excludeId?: string;
}): Promise<boolean> {
  const database = await getDatabase();
  const result = await database.getFirstAsync<{ id: string }>(
    `SELECT id FROM function_records WHERE family_id = ? AND date = ? AND date_precision = 'DAY'
     AND direction = ? AND deleted_at IS NULL AND (? IS NULL OR id <> ?) LIMIT 1`,
    input.familyId,
    input.date,
    input.direction,
    input.excludeId ?? null,
    input.excludeId ?? null,
  );
  return result !== null;
}

export async function getRecord(id: string): Promise<FunctionRecord | null> {
  const database = await getDatabase();
  const row = await database.getFirstAsync<RecordRow>(
    'SELECT * FROM function_records WHERE id = ? AND deleted_at IS NULL',
    id,
  );
  return row ? fromRow(row) : null;
}

export async function listRecords(familyId?: string): Promise<FunctionRecord[]> {
  const database = await getDatabase();
  const rows = familyId
    ? await database.getAllAsync<RecordRow>(
        `SELECT * FROM function_records WHERE family_id = ? AND deleted_at IS NULL
         ORDER BY date DESC, created_at DESC`,
        familyId,
      )
    : await database.getAllAsync<RecordRow>(
        'SELECT * FROM function_records WHERE deleted_at IS NULL ORDER BY date DESC, created_at DESC',
      );
  return rows.map(fromRow);
}

export async function getLastAmount(
  familyId: string,
  direction: FunctionRecord['direction'],
): Promise<number | null> {
  const database = await getDatabase();
  const row = await database.getFirstAsync<{ amount: number }>(
    `SELECT amount FROM function_records
     WHERE family_id = ? AND direction = ? AND record_kind = 'MONEY' AND deleted_at IS NULL
     ORDER BY date DESC, created_at DESC LIMIT 1`,
    familyId,
    direction,
  );
  return row?.amount ?? null;
}

export async function softDeleteRecord(id: string): Promise<string> {
  const database = await getDatabase();
  const now = new Date().toISOString();
  await database.runAsync(
    'UPDATE function_records SET deleted_at = ?, updated_at = ?, is_dirty = 1 WHERE id = ? AND deleted_at IS NULL',
    now,
    now,
    id,
  );
  scheduleSync();
  return now;
}

export async function restoreRecord(id: string, deletedAt: string): Promise<void> {
  const database = await getDatabase();
  await database.runAsync(
    'UPDATE function_records SET deleted_at = NULL, updated_at = ?, is_dirty = 1 WHERE id = ? AND deleted_at = ?',
    new Date().toISOString(),
    id,
    deletedAt,
  );
  scheduleSync();
}
