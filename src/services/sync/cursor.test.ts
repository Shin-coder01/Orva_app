import { describe, expect, it } from '@jest/globals';

import { cursorFilter, cursorFromRow } from './cursor';

describe('composite sync cursor', () => {
  it('includes the id tie-breaker when timestamps match', () => {
    expect(cursorFilter({ timestamp: '2026-10-13T12:00:00.000Z', id: 'record-2' })).toBe(
      'server_updated_at.gt.2026-10-13T12:00:00.000Z,and(server_updated_at.eq.2026-10-13T12:00:00.000Z,id.gt.record-2)',
    );
  });

  it('starts at the first page without a cursor and builds one from the last row', () => {
    expect(cursorFilter(null)).toBeNull();
    expect(cursorFromRow({ server_updated_at: '2026-10-13T12:00:00.000Z', id: 'record-3' })).toEqual({
      timestamp: '2026-10-13T12:00:00.000Z', id: 'record-3',
    });
  });
});
