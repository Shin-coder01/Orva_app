import type { SQLiteDatabase } from 'expo-sqlite';

const MIGRATION_VERSION = 2;

export async function migrateDatabase(database: SQLiteDatabase): Promise<void> {
  const versionRow = await database.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const currentVersion = versionRow?.user_version ?? 0;
  if (currentVersion >= MIGRATION_VERSION) return;
  if (currentVersion !== 1) {
    throw new Error(`Cannot apply migration 002 from schema version ${currentVersion}`);
  }

  await database.withTransactionAsync(async () => {
    await database.execAsync(`
      CREATE TABLE function_records_new (
        id TEXT PRIMARY KEY NOT NULL,
        family_id TEXT NOT NULL REFERENCES families(id),
        date TEXT NOT NULL CHECK (length(date) = 10),
        date_precision TEXT NOT NULL CHECK (date_precision IN ('DAY', 'YEAR')),
        function_type TEXT NOT NULL CHECK (function_type IN (
          'WEDDING', 'ENGAGEMENT', 'HOUSEWARMING', 'BABY_FUNCTION',
          'EAR_PIERCING', 'PUBERTY_CEREMONY', 'BIRTHDAY', 'FUNERAL',
          'FESTIVAL', 'OTHER'
        )),
        function_name TEXT,
        direction TEXT NOT NULL CHECK (direction IN ('WE_GAVE', 'THEY_GAVE')),
        record_kind TEXT NOT NULL DEFAULT 'MONEY' CHECK (record_kind = 'MONEY'),
        amount INTEGER NOT NULL CHECK (amount BETWEEN 0 AND 9999999),
        added_by TEXT,
        notes TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        deleted_at TEXT,
        is_dirty INTEGER NOT NULL DEFAULT 1 CHECK (is_dirty IN (0, 1)),
        CHECK (date_precision <> 'YEAR' OR substr(date, 6, 5) = '01-01')
      );

      INSERT INTO function_records_new (
        id, family_id, date, date_precision, function_type, function_name, direction,
        record_kind, amount, added_by, notes, created_at, updated_at, deleted_at, is_dirty
      )
      SELECT
        id, family_id, date, date_precision, function_type, function_name, direction,
        record_kind, amount, NULL, notes, created_at, updated_at, deleted_at, is_dirty
      FROM function_records;

      DROP TABLE function_records;
      ALTER TABLE function_records_new RENAME TO function_records;

      CREATE INDEX function_records_family_date_idx ON function_records(family_id, date);
      CREATE INDEX function_records_deleted_at_idx ON function_records(deleted_at);
      CREATE INDEX function_records_is_dirty_idx ON function_records(is_dirty);
      PRAGMA user_version = ${MIGRATION_VERSION};
    `);
  });
}
