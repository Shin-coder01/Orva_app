import * as Crypto from 'expo-crypto';

import { sampleFamilies, sampleInvitations, sampleRecords } from '../domain/sampleData';
import { getDatabase } from './database';

export type SeedResult = { loaded: boolean; families: number; records: number; invitations: number };

export async function loadSampleData(): Promise<SeedResult> {
  const database = await getDatabase();
  const existing = await database.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) AS count FROM families WHERE deleted_at IS NULL',
  );
  if ((existing?.count ?? 0) > 0) return { loaded: false, families: 0, records: 0, invitations: 0 };

  const createdAt = new Date().toISOString();
  const familyIds = new Map<string, string>();

  await database.withTransactionAsync(async () => {
    for (const family of sampleFamilies) {
      const id = Crypto.randomUUID();
      familyIds.set(family.id, id);
      await database.runAsync(
        `INSERT INTO families
          (id, family_name, primary_person, place, relationship, phone, notes, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        id,
        family.familyName,
        family.primaryPerson,
        family.place,
        family.relationship,
        family.phone,
        family.notes,
        createdAt,
        createdAt,
      );
    }

    for (const record of sampleRecords) {
      const familyId = familyIds.get(record.familyId);
      if (!familyId) throw new Error('Sample record references an unknown family');
      await database.runAsync(
        `INSERT INTO function_records
          (id, family_id, date, date_precision, function_type, function_name, direction,
           record_kind, amount, added_by, notes, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        Crypto.randomUUID(),
        familyId,
        record.date,
        record.datePrecision,
        record.functionType,
        record.functionName,
        record.direction,
        record.recordKind,
        record.amount,
        record.addedBy,
        record.notes,
        createdAt,
        createdAt,
      );
    }

    for (const invitation of sampleInvitations) {
      const familyId = familyIds.get(invitation.familyId);
      if (!familyId) throw new Error('Sample invitation references an unknown family');
      await database.runAsync(
        `INSERT INTO invitations
          (id, family_id, function_type, function_name, function_date, function_time,
           reminders_enabled, reminder_offsets, status, notes, notification_ids, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        Crypto.randomUUID(),
        familyId,
        invitation.functionType,
        invitation.functionName,
        invitation.functionDate,
        invitation.functionTime,
        invitation.remindersEnabled ? 1 : 0,
        JSON.stringify(invitation.reminderOffsets),
        invitation.status,
        invitation.notes,
        JSON.stringify([]),
        createdAt,
        createdAt,
      );
    }
  });

  return { loaded: true, families: sampleFamilies.length, records: sampleRecords.length, invitations: sampleInvitations.length };
}
