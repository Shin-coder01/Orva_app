import type { TFunction } from 'i18next';

import type { FamilyBalance, FunctionRecord, FunctionType, Invitation } from './types';
import { formatDate, formatINR } from './format';

export function functionLabel(type: FunctionType, t: TFunction): string {
  return t(`functionTypes.${type}`);
}

export function formatTranslatedDate(date: string, precision: 'DAY' | 'YEAR', t: TFunction): string {
  const months = t('months', { returnObjects: true }) as string[];
  return formatDate(date, precision, months);
}

export function differenceLabel(balance: FamilyBalance, t: TFunction): string {
  if (!balance.recordCount) return t('differenceSentence.none');
  if (balance.totalGiven === 0 && balance.totalReceived === 0) return t('differenceSentence.noAmounts');
  if (balance.differenceDirection === 'EQUAL') {
    return t('differenceSentence.equal', { amount: formatINR(balance.totalGiven) });
  }
  return balance.differenceDirection === 'WE_GAVE_MORE'
    ? t('differenceSentence.weGaveMore', { amount: formatINR(balance.difference) })
    : t('differenceSentence.theyGaveMore', { amount: formatINR(balance.difference) });
}

export function recordAmountLabel(record: FunctionRecord, t: TFunction): string {
  if (record.amount === 0) return t(record.direction === 'WE_GAVE' ? 'settings.weDidntGive' : 'settings.theyDidntGive');
  return formatINR(record.amount);
}

export function invitationFunctionLabel(invitation: Invitation, t: TFunction): string {
  return invitation.functionName?.trim() || functionLabel(invitation.functionType, t);
}

export function groupRecordsByYear(records: FunctionRecord[]): [string, FunctionRecord[]][] {
  const grouped = new Map<string, FunctionRecord[]>();
  for (const record of records) {
    const year = record.date.slice(0, 4);
    const group = grouped.get(year) ?? [];
    group.push(record);
    grouped.set(year, group);
  }
  return [...grouped.entries()].sort(([left], [right]) => right.localeCompare(left));
}
