import { describe, expect, it } from '@jest/globals';
import { DatabaseSync } from 'node:sqlite';
import type { SQLiteDatabase } from 'expo-sqlite';

import { migrateDatabase as migrate001 } from './001_initial';
import { migrateDatabase as migrate002 } from './002_allow_did_not_give';
import { migrateDatabase as migrate003 } from './003_invitations';

type SqlParameters = Parameters<ReturnType<DatabaseSync['prepare']>['run']>;

function expoDatabaseAdapter(native: DatabaseSync): SQLiteDatabase {
  return {
    getFirstAsync: async <T>(sql: string) => native.prepare(sql).get() as T | undefined,
    runAsync: async (sql: string, ...parameters: SqlParameters) => native.prepare(sql).run(...parameters),
    execAsync: async (sql: string) => { native.exec(sql); },
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

describe('local migration 003', () => {
  it('keeps existing families and records while adding invitation reminders', async () => {
    const native = new DatabaseSync(':memory:');
    try {
      native.exec('PRAGMA foreign_keys = ON');
      const database = expoDatabaseAdapter(native);
      await migrate001(database);
      await migrate002(database);

      native.prepare(`INSERT INTO families (id, family_name, place, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?)`).run(
        'ravi-family', 'Ravi Family', 'Salem', '2024-10-03T10:00:00.000Z', '2024-10-03T10:00:00.000Z',
      );
      native.prepare(`INSERT INTO function_records (
        id, family_id, date, date_precision, function_type, function_name, direction,
        record_kind, amount, added_by, notes, created_at, updated_at, is_dirty
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
        'ravi-record', 'ravi-family', '2024-10-03', 'DAY', 'WEDDING', 'Their daughter wedding',
        'WE_GAVE', 'MONEY', 5000, 'Appa', 'Kept from the previous schema',
        '2024-10-03T10:00:00.000Z', '2024-10-03T10:00:00.000Z', 0,
      );

      await migrate003(database);
      native.prepare(`INSERT INTO invitations (
        id, family_id, function_type, function_date, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?)`).run(
        'ravi-invitation', 'ravi-family', 'WEDDING', '2026-11-15',
        '2026-10-13T10:00:00.000Z', '2026-10-13T10:00:00.000Z',
      );

      expect(native.prepare('SELECT family_name FROM families WHERE id = ?').get('ravi-family')).toEqual({ family_name: 'Ravi Family' });
      expect(native.prepare('SELECT amount, added_by, notes, is_dirty FROM function_records WHERE id = ?').get('ravi-record')).toEqual({
        amount: 5000, added_by: 'Appa', notes: 'Kept from the previous schema', is_dirty: 0,
      });
      expect(native.prepare('SELECT reminder_offsets FROM invitations WHERE id = ?').get('ravi-invitation')).toEqual({
        reminder_offsets: '["7D","1D","MORNING_OF","EVENING_OF","NEXT_MORNING"]',
      });
      expect(native.prepare('PRAGMA user_version').get()).toEqual({ user_version: 3 });
      expect(native.prepare('PRAGMA foreign_key_check').all()).toEqual([]);
    } finally {
      native.close();
    }
  });
});
