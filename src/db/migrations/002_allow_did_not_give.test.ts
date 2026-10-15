import { describe, expect, it } from '@jest/globals';
import { DatabaseSync } from 'node:sqlite';
import type { SQLiteDatabase } from 'expo-sqlite';

import { migrateDatabase as migrate001 } from './001_initial';
import { migrateDatabase as migrate002 } from './002_allow_did_not_give';

function expoDatabaseAdapter(native: DatabaseSync): SQLiteDatabase {
  return {
    getFirstAsync: async <T>(sql: string) =>
      native.prepare(sql).get() as T | undefined,
    execAsync: async (sql: string) => {
      native.exec(sql);
    },
    withTransactionAsync: async (task: () => Promise<void>) => {
      native.exec('BEGIN');
      try {
        await task();
        native.exec('COMMIT');
      } catch (error) {
        native.exec('ROLLBACK');
        throw error;
      }
    },
  } as unknown as SQLiteDatabase;
}

describe('local migration 002', () => {
  it('preserves existing rows and accepts a zero amount', async () => {
    const native = new DatabaseSync(':memory:');
    try {
      native.exec('PRAGMA foreign_keys = ON');
      const database = expoDatabaseAdapter(native);
      await migrate001(database);

      native.prepare(`
        INSERT INTO families (id, family_name, place, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(
        'ravi-family',
        'Ravi Family',
        'Salem',
        '2024-10-03T10:00:00.000Z',
        '2024-10-03T10:00:00.000Z',
      );
      native.prepare(`
        INSERT INTO function_records (
          id, family_id, date, date_precision, function_type, function_name, direction,
          record_kind, amount, notes, created_at, updated_at, is_dirty
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        'ravi-record',
        'ravi-family',
        '2024-10-03',
        'DAY',
        'WEDDING',
        'Their daughter wedding',
        'WE_GAVE',
        'MONEY',
        5000,
        'Existing note',
        '2024-10-03T10:00:00.000Z',
        '2024-10-03T10:00:00.000Z',
        0,
      );

      await migrate002(database);

      const migrated = native.prepare(`
        SELECT id, family_id, amount, added_by, notes, is_dirty
        FROM function_records WHERE id = ?
      `).get('ravi-record') as {
        id: string;
        family_id: string;
        amount: number;
        added_by: string | null;
        notes: string;
        is_dirty: number;
      };
      expect(migrated).toEqual({
        id: 'ravi-record',
        family_id: 'ravi-family',
        amount: 5000,
        added_by: null,
        notes: 'Existing note',
        is_dirty: 0,
      });

      native.prepare(`
        INSERT INTO function_records (
          id, family_id, date, date_precision, function_type, direction, record_kind,
          amount, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        'no-gift-record',
        'ravi-family',
        '2025-01-01',
        'YEAR',
        'WEDDING',
        'THEY_GAVE',
        'MONEY',
        0,
        '2025-01-01T10:00:00.000Z',
        '2025-01-01T10:00:00.000Z',
      );

      expect(native.prepare('PRAGMA user_version').get()).toEqual({ user_version: 2 });
      expect(native.prepare('SELECT COUNT(*) AS count FROM function_records').get()).toEqual({ count: 2 });
      expect(native.prepare('PRAGMA foreign_key_check').all()).toEqual([]);
    } finally {
      native.close();
    }
  });
});
