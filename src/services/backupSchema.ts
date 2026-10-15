import { z } from 'zod';

import type { Family, FunctionRecord, Invitation } from '../domain/types';
import { isValidDateOnly } from '../domain/format';

export const BACKUP_SCHEMA_VERSION = 2;

const familySchema = z.object({
  id: z.string().min(1),
  familyName: z.string().trim().min(1),
  primaryPerson: z.string().nullable(),
  place: z.string().nullable(),
  relationship: z.string().nullable(),
  phone: z.string().nullable(),
  notes: z.string().nullable(),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
});

const recordFields = {
  id: z.string().min(1),
  familyId: z.string().min(1),
  date: z.string().refine(isValidDateOnly),
  datePrecision: z.enum(['DAY', 'YEAR']),
  functionType: z.enum([
    'WEDDING', 'ENGAGEMENT', 'HOUSEWARMING', 'BABY_FUNCTION', 'EAR_PIERCING',
    'PUBERTY_CEREMONY', 'BIRTHDAY', 'FUNERAL', 'FESTIVAL', 'OTHER',
  ]),
  functionName: z.string().nullable(),
  direction: z.enum(['WE_GAVE', 'THEY_GAVE']),
  recordKind: z.literal('MONEY'),
  amount: z.number().int().min(0).max(9999999),
  notes: z.string().nullable(),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
};

const legacyRecordSchema = z.object({
  ...recordFields,
  amount: z.number().int().min(1).max(9999999),
});

const currentRecordSchema = z.object({
  ...recordFields,
  addedBy: z.string().nullable(),
});

const functionTypeSchema = z.enum([
  'WEDDING', 'ENGAGEMENT', 'HOUSEWARMING', 'BABY_FUNCTION', 'EAR_PIERCING',
  'PUBERTY_CEREMONY', 'BIRTHDAY', 'FUNERAL', 'FESTIVAL', 'OTHER',
]);
const invitationSchema = z.object({
  id: z.string().min(1),
  familyId: z.string().min(1),
  functionType: functionTypeSchema,
  functionName: z.string().nullable(),
  functionDate: z.string().refine(isValidDateOnly),
  functionTime: z.string().nullable(),
  remindersEnabled: z.boolean(),
  reminderOffsets: z.array(z.enum(['7D', '1D', 'MORNING_OF', 'EVENING_OF', 'NEXT_MORNING'])),
  status: z.enum(['UPCOMING', 'ATTENDED', 'SKIPPED']),
  notes: z.string().nullable(),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
});

const legacyBackupSchema = z.object({
  schemaVersion: z.literal(1),
  exportedAt: z.string().min(1),
  families: z.array(familySchema),
  records: z.array(legacyRecordSchema),
  invitations: z.array(invitationSchema),
});

const currentBackupSchema = z.object({
  schemaVersion: z.literal(BACKUP_SCHEMA_VERSION),
  exportedAt: z.string().min(1),
  families: z.array(familySchema),
  records: z.array(currentRecordSchema),
  invitations: z.array(invitationSchema),
});

export type BackupPayload = z.infer<typeof currentBackupSchema>;
export type BackupInvitation = Invitation;

export function createBackupPayload(input: {
  families: Family[];
  records: FunctionRecord[];
  invitations?: BackupInvitation[];
  exportedAt?: string;
}): BackupPayload {
  return currentBackupSchema.parse({
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt: input.exportedAt ?? new Date().toISOString(),
    families: input.families
      .filter((family) => family.deletedAt === null)
      .map(({ isDirty: _isDirty, deletedAt: _deletedAt, ...family }) => family),
    records: input.records
      .filter((record) => record.deletedAt === null)
      .map(({ isDirty: _isDirty, deletedAt: _deletedAt, ...record }) => record),
    invitations: (input.invitations ?? [])
      .filter((invitation) => invitation.deletedAt == null)
      .map(({ deletedAt: _deletedAt, isDirty: _isDirty, notificationIds: _ids, ...invitation }) => invitation),
  });
}

export function parseBackup(input: unknown): BackupPayload {
  const version = z.object({ schemaVersion: z.number().int() }).parse(input).schemaVersion;

  if (version === 1) {
    const legacy = legacyBackupSchema.parse(input);
    return currentBackupSchema.parse({
      ...legacy,
      schemaVersion: BACKUP_SCHEMA_VERSION,
      records: legacy.records.map((record) => ({ ...record, addedBy: null })),
    });
  }

  if (version === BACKUP_SCHEMA_VERSION) return currentBackupSchema.parse(input);
  throw new Error(`Unsupported backup schema version: ${version}`);
}
