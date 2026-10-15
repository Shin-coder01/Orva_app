export type PullCursor = { timestamp: string; id: string };

export function cursorFilter(cursor: PullCursor | null): string | null {
  if (!cursor) return null;
  return `server_updated_at.gt.${cursor.timestamp},and(server_updated_at.eq.${cursor.timestamp},id.gt.${cursor.id})`;
}

export function cursorFromRow(row: Record<string, unknown>): PullCursor {
  return { timestamp: String(row.server_updated_at), id: String(row.id) };
}
