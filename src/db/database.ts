import * as SQLite from 'expo-sqlite';

import { migrateDatabase as migrate001 } from './migrations/001_initial';
import { migrateDatabase as migrate002 } from './migrations/002_allow_did_not_give';
import { migrateDatabase as migrate003 } from './migrations/003_invitations';

let databasePromise: Promise<SQLite.SQLiteDatabase> | undefined;

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!databasePromise) {
    databasePromise = SQLite.openDatabaseAsync('orva.db')
      .then(async (database) => {
        await database.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
        await migrate001(database);
        await migrate002(database);
        await migrate003(database);
        return database;
      })
      .catch((error: unknown) => {
        databasePromise = undefined;
        throw error;
      });
  }

  return databasePromise;
}
