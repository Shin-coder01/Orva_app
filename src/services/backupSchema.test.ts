import { describe, expect, it } from '@jest/globals';

import { createBackupPayload, parseBackup } from './backupSchema';
import { sampleFamilies, sampleRecords } from '../domain/sampleData';

describe('backup schema compatibility', () => {
  it('exports amount zero and addedBy in schema version 2', () => {
    const zeroRecord = { ...sampleRecords[0], amount: 0, addedBy: 'Appa' };
    const payload = createBackupPayload({
      families: sampleFamilies,
      records: [zeroRecord],
      exportedAt: '2026-10-13T00:00:00.000Z',
    });

    expect(payload.schemaVersion).toBe(2);
    expect(payload.records[0]).toMatchObject({ amount: 0, addedBy: 'Appa' });
    expect(payload.invitations).toEqual([]);
  });

  it('restores a version 1 backup without addedBy as version 2', () => {
    const { addedBy: _addedBy, ...legacyRecord } = sampleRecords[0];
    const restored = parseBackup({
      schemaVersion: 1,
      exportedAt: '2025-01-01T00:00:00.000Z',
      families: sampleFamilies.map(({ isDirty: _isDirty, deletedAt: _deletedAt, ...family }) => family),
      records: [legacyRecord],
      invitations: [],
    });

    expect(restored.schemaVersion).toBe(2);
    expect(restored.records[0].addedBy).toBeNull();
    expect(restored.records[0].amount).toBe(5000);
  });
});
