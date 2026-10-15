import type { DatePrecision } from './types';

export function formatINR(amount: number): string {
  const digits = Math.trunc(Math.abs(amount)).toString();
  if (digits.length <= 3) return `\u20B9${digits}`;

  const lastThree = digits.slice(-3);
  const leading = digits.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',');
  return `\u20B9${leading},${lastThree}`;
}

export function formatDate(
  date: string,
  precision: DatePrecision,
  monthNames: readonly string[],
): string {
  const [year, month, day] = date.split('-');
  if (!year || !month || !day) return date;
  if (precision === 'YEAR') return year;

  const monthName = monthNames[Number(month) - 1];
  if (!monthName) return date;
  return `${day} ${monthName} ${year}`;
}

export function toDateOnly(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function isValidDateOnly(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  date.setUTCHours(0, 0, 0, 0);
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}
