import type { SQLiteDatabase } from 'expo-sqlite';

const DATABASE_VERSION = 1;

export async function migrateDatabase(database: SQLiteDatabase): Promise<void> {
  const versionRow = await database.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const currentVersion = versionRow?.user_version ?? 0;
  if (currentVersion >= DATABASE_VERSION) return;

  await database.withTransactionAsync(async () => {
    if (currentVersion === 0) {
      await database.execAsync(`
        CREATE TABLE families (
          id TEXT PRIMARY KEY NOT NULL,
          family_name TEXT NOT NULL CHECK (length(trim(family_name)) > 0),
          primary_person TEXT,
          place TEXT,
          relationship TEXT,
          phone TEXT,
          notes TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          deleted_at TEXT,
          is_dirty INTEGER NOT NULL DEFAULT 1 CHECK (is_dirty IN (0, 1))
        );

        CREATE TABLE function_records (
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
          amount INTEGER NOT NULL CHECK (amount BETWEEN 1 AND 9999999),
          notes TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          deleted_at TEXT,
          is_dirty INTEGER NOT NULL DEFAULT 1 CHECK (is_dirty IN (0, 1)),
          CHECK (date_precision <> 'YEAR' OR substr(date, 6, 5) = '01-01')
        );

        CREATE TABLE sync_state (
          key TEXT PRIMARY KEY NOT NULL,
          value TEXT NOT NULL
        );

        CREATE INDEX families_name_idx ON families(family_name COLLATE NOCASE);
        CREATE INDEX families_deleted_at_idx ON families(deleted_at);
        CREATE INDEX families_is_dirty_idx ON families(is_dirty);
        CREATE INDEX function_records_family_date_idx ON function_records(family_id, date);
        CREATE INDEX function_records_deleted_at_idx ON function_records(deleted_at);
        CREATE INDEX function_records_is_dirty_idx ON function_records(is_dirty);
      `);
    }

    await database.execAsync(`PRAGMA user_version = ${DATABASE_VERSION};`);
  });
}
