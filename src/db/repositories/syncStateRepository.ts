import { getDatabase } from '../database';

export async function getSyncValue(key: string): Promise<string | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM sync_state WHERE key = ?', key);
  return row?.value ?? null;
}

export async function setSyncValue(key: string, value: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('INSERT OR REPLACE INTO sync_state (key, value) VALUES (?, ?)', key, value);
}

export async function deleteSyncValues(keys: string[]): Promise<void> {
  if (!keys.length) return;
  const db = await getDatabase();
  await db.withTransactionAsync(async () => {
    for (const key of keys) await db.runAsync('DELETE FROM sync_state WHERE key = ?', key);
  });
}

export async function resetPullCursors(): Promise<void> {
  const db = await getDatabase();
  await db.runAsync("DELETE FROM sync_state WHERE key LIKE 'cursor_%'");
}

export async function markAllRowsDirty(): Promise<void> {
  const db = await getDatabase();
  await db.withTransactionAsync(async () => {
    await db.runAsync('UPDATE families SET is_dirty = 1 WHERE deleted_at IS NULL');
    await db.runAsync('UPDATE function_records SET is_dirty = 1 WHERE deleted_at IS NULL');
    await db.runAsync('UPDATE invitations SET is_dirty = 1 WHERE deleted_at IS NULL');
  });
}

export async function countDirtyRows(): Promise<number> {
  const db = await getDatabase();
  const result = await db.getFirstAsync<{ count: number }>(
    'SELECT (SELECT COUNT(*) FROM families WHERE is_dirty = 1) + (SELECT COUNT(*) FROM function_records WHERE is_dirty = 1) + (SELECT COUNT(*) FROM invitations WHERE is_dirty = 1) AS count',
  );
  return result?.count ?? 0;
}
