import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import i18n from '../i18n';
import { getDatabase } from '../db/database';
import { listFamilies } from '../db/repositories/familyRepository';
import { listRecords } from '../db/repositories/recordRepository';
import { listInvitations } from '../db/repositories/invitationRepository';
import { cancelInvitationReminders, scheduleInvitationReminders } from './notifications';
import { createBackupPayload, parseBackup, type BackupPayload } from './backupSchema';
import { scheduleSync } from './sync/syncScheduler';

export async function exportBackupToShare(): Promise<void> {
  const [families, records, invitations] = await Promise.all([listFamilies(), listRecords(), listInvitations()]);
  const payload = createBackupPayload({ families, records, invitations });
  const file = new File(Paths.cache, `orva-backup-${Date.now()}.json`);
  file.create();
  file.write(JSON.stringify(payload, null, 2));
  if (!(await Sharing.isAvailableAsync())) throw new Error('sharing_unavailable');
  await Sharing.shareAsync(file.uri, {
    mimeType: 'application/json',
    dialogTitle: i18n.t('settings.backup'),
    UTI: 'public.json',
  });
}

export async function pickBackupFile(): Promise<BackupPayload | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ['application/json', 'text/json', 'public.json'],
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (result.canceled || !result.assets[0]) return null;
  const file = new File(result.assets[0].uri);
  const input: unknown = JSON.parse(await file.text());
  const payload = parseBackup(input);
  const familyIds = new Set(payload.families.map((family) => family.id));
  if (payload.records.some((record) => !familyIds.has(record.familyId)) ||
      payload.invitations.some((invitation) => !familyIds.has(invitation.familyId))) {
    throw new Error('backup_reference_invalid');
  }
  return payload;
}

export async function restoreBackup(payload: BackupPayload): Promise<void> {
  const database = await getDatabase();
  const previousInvitations = await listInvitations();
  await Promise.all(previousInvitations.map((invitation) => cancelInvitationReminders(invitation.notificationIds)));
  await database.withTransactionAsync(async () => {
    await database.runAsync('DELETE FROM invitations');
    await database.runAsync('DELETE FROM function_records');
    await database.runAsync('DELETE FROM families');

    for (const family of payload.families) {
      await database.runAsync(
        `INSERT INTO families (id, family_name, primary_person, place, relationship, phone, notes, created_at, updated_at, deleted_at, is_dirty)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 1)`,
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
    }
    for (const record of payload.records) {
      await database.runAsync(
        `INSERT INTO function_records (id, family_id, date, date_precision, function_type, function_name,
          direction, record_kind, amount, added_by, notes, created_at, updated_at, deleted_at, is_dirty)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 1)`,
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
    }
    for (const invitation of payload.invitations) {
      await database.runAsync(
        `INSERT INTO invitations (id, family_id, function_type, function_name, function_date, function_time,
          reminders_enabled, reminder_offsets, status, notes, notification_ids, created_at, updated_at, deleted_at, is_dirty)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '[]', ?, ?, NULL, 1)`,
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
        invitation.createdAt,
        invitation.updatedAt,
      );
    }
  });
  await Promise.all(payload.invitations.map(async (invitation) => {
    try { await scheduleInvitationReminders(invitation.id, { requestPermission: false }); }
    catch { /* Restored notebook data remains valid even if local scheduling fails. */ }
  }));
  scheduleSync();
}
