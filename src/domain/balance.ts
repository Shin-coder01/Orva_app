import type { FamilyBalance, FunctionRecord } from './types';

export function calculateFamilyBalance(records: FunctionRecord[]): FamilyBalance {
  let totalGiven = 0;
  let totalReceived = 0;
  let recordCount = 0;
  let theirFunctionCount = 0;
  let ourFunctionCount = 0;

  for (const record of records) {
    if (record.deletedAt !== null || record.recordKind !== 'MONEY') continue;

    recordCount += 1;
    if (record.direction === 'WE_GAVE') {
      totalGiven += record.amount;
      theirFunctionCount += 1;
    } else {
      totalReceived += record.amount;
      ourFunctionCount += 1;
    }
  }

  return {
    totalGiven,
    totalReceived,
    difference: Math.abs(totalGiven - totalReceived),
    differenceDirection:
      totalGiven > totalReceived
        ? 'WE_GAVE_MORE'
        : totalReceived > totalGiven
          ? 'THEY_GAVE_MORE'
          : 'EQUAL',
    recordCount,
    theirFunctionCount,
    ourFunctionCount,
  };
}

export function getLastRecords(records: FunctionRecord[]): {
  lastWeGave: FunctionRecord | null;
  lastTheyGave: FunctionRecord | null;
} {
  const eligible = records.filter(
    (record) => record.deletedAt === null && record.recordKind === 'MONEY',
  );
  const newestFirst = (left: FunctionRecord, right: FunctionRecord) =>
    right.date.localeCompare(left.date) || right.createdAt.localeCompare(left.createdAt);

  return {
    lastWeGave:
      eligible.filter((record) => record.direction === 'WE_GAVE').sort(newestFirst)[0] ?? null,
    lastTheyGave:
      eligible.filter((record) => record.direction === 'THEY_GAVE').sort(newestFirst)[0] ?? null,
  };
}
