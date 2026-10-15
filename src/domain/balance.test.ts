import { describe, expect, it } from '@jest/globals';

import { calculateFamilyBalance, getLastRecords } from './balance';
import { sampleRecords } from './sampleData';
import type { FunctionRecord } from './types';

describe('calculateFamilyBalance', () => {
  it('matches the Section 7 totals for the three sample families', () => {
    const ravi = calculateFamilyBalance(sampleRecords.filter((record) => record.familyId === 'sample-ravi'));
    const kumar = calculateFamilyBalance(sampleRecords.filter((record) => record.familyId === 'sample-kumar'));
    const suresh = calculateFamilyBalance(sampleRecords.filter((record) => record.familyId === 'sample-suresh'));

    expect(ravi).toEqual({
      totalGiven: 15000,
      totalReceived: 10000,
      difference: 5000,
      differenceDirection: 'WE_GAVE_MORE',
      recordCount: 4,
      theirFunctionCount: 2,
      ourFunctionCount: 2,
    });
    expect(kumar).toMatchObject({
      totalGiven: 5000,
      totalReceived: 8000,
      difference: 3000,
      differenceDirection: 'THEY_GAVE_MORE',
      theirFunctionCount: 1,
      ourFunctionCount: 1,
    });
    expect(suresh).toMatchObject({
      totalGiven: 10000,
      totalReceived: 10000,
      difference: 0,
      differenceDirection: 'EQUAL',
      theirFunctionCount: 1,
      ourFunctionCount: 1,
    });

    expect(sampleRecords).toHaveLength(8);
    expect(sampleRecords.reduce((sum, record) => sum + (record.direction === 'WE_GAVE' ? record.amount : 0), 0)).toBe(30000);
    expect(sampleRecords.reduce((sum, record) => sum + (record.direction === 'THEY_GAVE' ? record.amount : 0), 0)).toBe(28000);
  });

  it('returns empty totals for no records', () => {
    expect(calculateFamilyBalance([])).toEqual({
      totalGiven: 0,
      totalReceived: 0,
      difference: 0,
      differenceDirection: 'EQUAL',
      recordCount: 0,
      theirFunctionCount: 0,
      ourFunctionCount: 0,
    });
  });

  it('counts zero-amount functions and returns the latest records in each direction', () => {
    const mohanRecords: FunctionRecord[] = [
      {
        id: 'mohan-wedding', familyId: 'mohan', date: '2024-03-10', datePrecision: 'DAY',
        functionType: 'WEDDING', functionName: null, direction: 'THEY_GAVE', recordKind: 'MONEY',
        amount: 0, addedBy: null, notes: null, createdAt: '2024-03-10T10:00:00.000Z',
        updatedAt: '2024-03-10T10:00:00.000Z', deletedAt: null, isDirty: true,
      },
      {
        id: 'mohan-housewarming', familyId: 'mohan', date: '2025-05-04', datePrecision: 'DAY',
        functionType: 'HOUSEWARMING', functionName: null, direction: 'WE_GAVE', recordKind: 'MONEY',
        amount: 2000, addedBy: null, notes: null, createdAt: '2025-05-04T10:00:00.000Z',
        updatedAt: '2025-05-04T10:00:00.000Z', deletedAt: null, isDirty: true,
      },
    ];

    expect(calculateFamilyBalance(mohanRecords)).toEqual({
      totalGiven: 2000,
      totalReceived: 0,
      difference: 2000,
      differenceDirection: 'WE_GAVE_MORE',
      recordCount: 2,
      theirFunctionCount: 1,
      ourFunctionCount: 1,
    });
    expect(getLastRecords(mohanRecords)).toEqual({
      lastWeGave: mohanRecords[1],
      lastTheyGave: mohanRecords[0],
    });

    const deletedLater = {
      ...mohanRecords[1],
      id: 'deleted-later',
      date: '2026-01-01',
      deletedAt: '2026-01-02T00:00:00.000Z',
    };
    const nonMoneyLater = {
      ...mohanRecords[0],
      id: 'non-money-later',
      date: '2026-01-01',
      recordKind: 'GOLD',
    } as unknown as FunctionRecord;
    expect(getLastRecords([...mohanRecords, deletedLater, nonMoneyLater])).toEqual({
      lastWeGave: mohanRecords[1],
      lastTheyGave: mohanRecords[0],
    });
  });

  it('ignores soft-deleted records', () => {
    expect(calculateFamilyBalance([
      sampleRecords[0],
      { ...sampleRecords[1], deletedAt: '2026-10-01T00:00:00.000Z' },
    ])).toMatchObject({
      totalGiven: 5000,
      totalReceived: 0,
      recordCount: 1,
      theirFunctionCount: 1,
      ourFunctionCount: 0,
    });
  });

  it('ignores record kinds other than money', () => {
    const futureRecord = { ...sampleRecords[0], recordKind: 'GOLD' } as unknown as FunctionRecord;
    expect(calculateFamilyBalance([futureRecord])).toMatchObject({
      totalGiven: 0,
      totalReceived: 0,
      recordCount: 0,
      theirFunctionCount: 0,
      ourFunctionCount: 0,
    });
  });
});
