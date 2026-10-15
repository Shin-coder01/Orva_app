import { describe, expect, it } from '@jest/globals';

import { chooseMergedRow } from './merge';

describe('chooseMergedRow', () => {
  const remote = { id: 'x', updatedAt: '2026-01-02T00:00:00.000Z', isDirty: false };
  it('inserts remote rows that do not exist locally', () => {
    expect(chooseMergedRow(null, remote)).toMatchObject({ kind: 'insert', value: { isDirty: false } });
  });
  it('replaces clean local rows', () => {
    expect(chooseMergedRow({ ...remote, updatedAt: '2025-01-01T00:00:00.000Z', isDirty: false }, remote).kind).toBe('replace');
  });
  it('uses the later timestamp for dirty rows and remote wins ties', () => {
    const dirty = { ...remote, updatedAt: '2026-01-02T00:00:00.000Z', isDirty: true };
    expect(chooseMergedRow(dirty, remote).kind).toBe('replace');
    expect(chooseMergedRow({ ...dirty, updatedAt: '2026-01-03T00:00:00.000Z' }, remote).kind).toBe('keep-local');
  });
});
