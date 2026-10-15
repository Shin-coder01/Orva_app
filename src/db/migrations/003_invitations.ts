import type { SQLiteDatabase } from 'expo-sqlite';

const MIGRATION_VERSION = 3;

export async function migrateDatabase(database: SQLiteDatabase): Promise<void> {
  const versionRow = await database.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const currentVersion = versionRow?.user_version ?? 0;
  if (currentVersion >= MIGRATION_VERSION) return;
  if (currentVersion !== 2) {
    throw new Error(`Cannot apply migration 003 from schema version ${currentVersion}`);
  }

  await database.withTransactionAsync(async () => {
    await database.execAsync(`
      CREATE TABLE invitations (
        id TEXT PRIMARY KEY NOT NULL,
        family_id TEXT NOT NULL REFERENCES families(id),
        function_type TEXT NOT NULL CHECK (function_type IN (
          'WEDDING', 'ENGAGEMENT', 'HOUSEWARMING', 'BABY_FUNCTION',
          'EAR_PIERCING', 'PUBERTY_CEREMONY', 'BIRTHDAY', 'FUNERAL', 'FESTIVAL', 'OTHER'
        )),
        function_name TEXT,
        function_date TEXT NOT NULL CHECK (length(function_date) = 10),
        function_time TEXT,
        reminders_enabled INTEGER NOT NULL DEFAULT 1 CHECK (reminders_enabled IN (0, 1)),
        reminder_offsets TEXT NOT NULL DEFAULT '["7D","1D","MORNING_OF","EVENING_OF","NEXT_MORNING"]',
        status TEXT NOT NULL DEFAULT 'UPCOMING' CHECK (status IN ('UPCOMING', 'ATTENDED', 'SKIPPED')),
        notes TEXT,
        notification_ids TEXT NOT NULL DEFAULT '[]',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        deleted_at TEXT,
        is_dirty INTEGER NOT NULL DEFAULT 1 CHECK (is_dirty IN (0, 1))
      );
      CREATE INDEX invitations_family_date_idx ON invitations(family_id, function_date);
      CREATE INDEX invitations_date_status_idx ON invitations(function_date, status);
      CREATE INDEX invitations_deleted_at_idx ON invitations(deleted_at);
      CREATE INDEX invitations_is_dirty_idx ON invitations(is_dirty);
      PRAGMA user_version = ${MIGRATION_VERSION};
    `);

    await database.runAsync(
      `UPDATE sync_state SET value = '["7D","1D","MORNING_OF","EVENING_OF","NEXT_MORNING"]'
       WHERE key = 'defaultReminderOffsets'`,
    );
  });
}
