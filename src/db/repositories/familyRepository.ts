import * as Crypto from 'expo-crypto';

import { getDatabase } from '../database';
import type { Family } from '../../domain/types';
import { scheduleSync } from '../../services/sync/syncScheduler';

export type FamilyInput = Pick<Family, 'familyName'> &
  Partial<Pick<Family, 'primaryPerson' | 'place' | 'relationship' | 'phone' | 'notes'>>;

type FamilyRow = {
  id: string;
  family_name: string;
  primary_person: string | null;
  place: string | null;
  relationship: string | null;
  phone: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  is_dirty: number;
};

function fromRow(row: FamilyRow): Family {
  return {
    id: row.id,
    familyName: row.family_name,
    primaryPerson: row.primary_person,
    place: row.place,
    relationship: row.relationship,
    phone: row.phone,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
    isDirty: row.is_dirty === 1,
  };
}

function cleanOptional(value: string | null | undefined): string | null {
  const cleaned = value?.trim();
  return cleaned ? cleaned : null;
}

export async function createFamily(input: FamilyInput): Promise<Family> {
  const familyName = input.familyName.trim();
  if (!familyName) throw new Error('Family name is required');

  const database = await getDatabase();
  const now = new Date().toISOString();
  const family: Family = {
    id: Crypto.randomUUID(),
    familyName,
    primaryPerson: cleanOptional(input.primaryPerson),
    place: cleanOptional(input.place),
    relationship: cleanOptional(input.relationship),
    phone: cleanOptional(input.phone),
    notes: cleanOptional(input.notes),
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    isDirty: true,
  };

  await database.runAsync(
    `INSERT INTO families
      (id, family_name, primary_person, place, relationship, phone, notes, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    family.id,
    family.familyName,
    family.primaryPerson,
    family.place,
    family.relationship,
    family.phone,
    family.notes,
    family.createdAt,
    family.updatedAt,
  );
  scheduleSync();
  return family;
}

export async function updateFamily(id: string, input: FamilyInput): Promise<void> {
  const familyName = input.familyName.trim();
  if (!familyName) throw new Error('Family name is required');

  const database = await getDatabase();
  await database.runAsync(
    `UPDATE families SET family_name = ?, primary_person = ?, place = ?, relationship = ?,
      phone = ?, notes = ?, updated_at = ?, is_dirty = 1
     WHERE id = ? AND deleted_at IS NULL`,
    familyName,
    cleanOptional(input.primaryPerson),
    cleanOptional(input.place),
    cleanOptional(input.relationship),
    cleanOptional(input.phone),
    cleanOptional(input.notes),
    new Date().toISOString(),
    id,
  );
  scheduleSync();
}

export async function getFamily(id: string): Promise<Family | null> {
  const database = await getDatabase();
  const row = await database.getFirstAsync<FamilyRow>(
    'SELECT * FROM families WHERE id = ? AND deleted_at IS NULL',
    id,
  );
  return row ? fromRow(row) : null;
}

export async function listFamilies(): Promise<Family[]> {
  const database = await getDatabase();
  const rows = await database.getAllAsync<FamilyRow>(
    'SELECT * FROM families WHERE deleted_at IS NULL ORDER BY family_name COLLATE NOCASE',
  );
  return rows.map(fromRow);
}

export async function findDuplicateFamilies(name: string): Promise<Family[]> {
  const normalized = normalizeFamilyName(name);
  if (!normalized) return [];
  const families = await listFamilies();
  return families.filter((family) => normalizeFamilyName(family.familyName) === normalized);
}

export function normalizeFamilyName(value: string): string {
  return value
    .toLocaleLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\s+(family|குடும்பம்)$/u, '')
    .trim();
}

export async function countFamilyRecords(id: string): Promise<number> {
  const database = await getDatabase();
  const row = await database.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) AS count FROM function_records WHERE family_id = ? AND deleted_at IS NULL',
    id,
  );
  return row?.count ?? 0;
}

export async function softDeleteFamily(id: string): Promise<{ recordsHidden: number; deletedAt: string }> {
  const database = await getDatabase();
  const now = new Date().toISOString();
  let recordsHidden = 0;

  await database.withTransactionAsync(async () => {
    const count = await database.getFirstAsync<{ count: number }>(
      'SELECT COUNT(*) AS count FROM function_records WHERE family_id = ? AND deleted_at IS NULL',
      id,
    );
    recordsHidden = count?.count ?? 0;
    await database.runAsync(
      'UPDATE families SET deleted_at = ?, updated_at = ?, is_dirty = 1 WHERE id = ? AND deleted_at IS NULL',
      now,
      now,
      id,
    );
    await database.runAsync(
      'UPDATE function_records SET deleted_at = ?, updated_at = ?, is_dirty = 1 WHERE family_id = ? AND deleted_at IS NULL',
      now,
      now,
      id,
    );
    await database.runAsync(
      'UPDATE invitations SET deleted_at = ?, updated_at = ?, is_dirty = 1 WHERE family_id = ? AND deleted_at IS NULL',
      now,
      now,
      id,
    );
  });
  scheduleSync();

  return { recordsHidden, deletedAt: now };
}

export async function restoreSoftDeletedFamily(id: string, deletedAt: string): Promise<void> {
  const database = await getDatabase();
  const now = new Date().toISOString();
  await database.withTransactionAsync(async () => {
    await database.runAsync(
      'UPDATE families SET deleted_at = NULL, updated_at = ?, is_dirty = 1 WHERE id = ? AND deleted_at = ?',
      now,
      id,
      deletedAt,
    );
    await database.runAsync(
      'UPDATE function_records SET deleted_at = NULL, updated_at = ?, is_dirty = 1 WHERE family_id = ? AND deleted_at = ?',
      now,
      id,
      deletedAt,
    );
    await database.runAsync(
      'UPDATE invitations SET deleted_at = NULL, updated_at = ?, is_dirty = 1 WHERE family_id = ? AND deleted_at = ?',
      now,
      id,
      deletedAt,
    );
  });
  scheduleSync();
}

export type MergeSnapshot = {
  sourceId: string;
  targetId: string;
  mergedAt: string;
  source: Pick<Family, 'deletedAt' | 'updatedAt' | 'isDirty'>;
  targetFields: Pick<Family, 'primaryPerson' | 'place' | 'relationship' | 'phone'>;
};

export async function mergeFamilies(sourceId: string, targetId: string): Promise<MergeSnapshot> {
  if (sourceId === targetId) throw new Error('Cannot merge a family into itself');
  const database = await getDatabase();
  const [source, target] = await Promise.all([getFamily(sourceId), getFamily(targetId)]);
  if (!source || !target) throw new Error('Family not found');
  const now = new Date().toISOString();
  const snapshot: MergeSnapshot = {
    sourceId,
    targetId,
    mergedAt: now,
    source: { deletedAt: source.deletedAt, updatedAt: source.updatedAt, isDirty: source.isDirty },
    targetFields: {
      primaryPerson: target.primaryPerson,
      place: target.place,
      relationship: target.relationship,
      phone: target.phone,
    },
  };

  await database.withTransactionAsync(async () => {
    await database.runAsync(
      `UPDATE function_records SET family_id = ?, updated_at = ?, is_dirty = 1
       WHERE family_id = ? AND deleted_at IS NULL`,
      targetId,
      now,
      sourceId,
    );
    await database.runAsync(
      `UPDATE invitations SET family_id = ?, updated_at = ?, is_dirty = 1
       WHERE family_id = ? AND deleted_at IS NULL`,
      targetId,
      now,
      sourceId,
    );
    await database.runAsync(
      `UPDATE families SET
        primary_person = COALESCE(primary_person, ?), place = COALESCE(place, ?),
        relationship = COALESCE(relationship, ?), phone = COALESCE(phone, ?),
        updated_at = ?, is_dirty = 1
       WHERE id = ? AND deleted_at IS NULL`,
      source.primaryPerson,
      source.place,
      source.relationship,
      source.phone,
      now,
      targetId,
    );
    await database.runAsync(
      'UPDATE families SET deleted_at = ?, updated_at = ?, is_dirty = 1 WHERE id = ? AND deleted_at IS NULL',
      now,
      now,
      sourceId,
    );
  });
  scheduleSync();
  return snapshot;
}

export async function undoMerge(snapshot: MergeSnapshot): Promise<void> {
  const database = await getDatabase();
  await database.withTransactionAsync(async () => {
    await database.runAsync(
      `UPDATE function_records SET family_id = ?, updated_at = ?, is_dirty = 1
       WHERE family_id = ? AND updated_at = ?`,
      snapshot.sourceId,
      new Date().toISOString(),
      snapshot.targetId,
      snapshot.mergedAt,
    );
    await database.runAsync(
      `UPDATE invitations SET family_id = ?, updated_at = ?, is_dirty = 1
       WHERE family_id = ? AND updated_at = ?`,
      snapshot.sourceId,
      new Date().toISOString(),
      snapshot.targetId,
      snapshot.mergedAt,
    );
    await database.runAsync(
      `UPDATE families SET deleted_at = ?, updated_at = ?, is_dirty = 1 WHERE id = ?`,
      snapshot.source.deletedAt,
      new Date().toISOString(),
      snapshot.sourceId,
    );
    await database.runAsync(
      `UPDATE families SET primary_person = ?, place = ?, relationship = ?, phone = ?,
       updated_at = ?, is_dirty = 1 WHERE id = ?`,
      snapshot.targetFields.primaryPerson,
      snapshot.targetFields.place,
      snapshot.targetFields.relationship,
      snapshot.targetFields.phone,
      new Date().toISOString(),
      snapshot.targetId,
    );
  });
  scheduleSync();
}
