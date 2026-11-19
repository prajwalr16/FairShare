/**
 * Trip date calculation and formatting utilities.
 * Handles ISO strings (YYYY-MM-DD), Date objects, day counting, and display formats.
 */

export function parseDate(value: string | null | undefined): Date {
  if (!value) return new Date();
  const parts = value.split('-').map(Number);
  if (parts.length < 3 || !parts[0] || !parts[1] || !parts[2]) {
    return new Date();
  }
  const [year, month, day] = parts;
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

export function toIsoDate(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return 'Not set';
  const parts = value.split('-').map(Number);
  if (parts.length < 3 || !parts[0] || !parts[1] || !parts[2]) return value;
  const [year, month, day] = parts;
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(year, month - 1, day));
}

export function formatShortDate(value: string): string {
  const parts = value.split('-').map(Number);
  if (parts.length < 3 || !parts[0] || !parts[1] || !parts[2]) return value;
  const [year, month, day] = parts;
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
  }).format(new Date(year, month - 1, day));
}

export function getDayCount(startDate: string | null | undefined, endDate: string | null | undefined): number {
  if (!startDate || !endDate) return 1;
  const start = parseDate(startDate).getTime();
  const end = parseDate(endDate).getTime();
  if (end < start) return 1;
  return Math.max(1, Math.round((end - start) / 86400000) + 1);
}

export function addDaysIso(value: string, days: number): string {
  const date = parseDate(value);
  date.setDate(date.getDate() + days);
  return toIsoDate(date);
}

export function isValidDateRange(startDate: string | null | undefined, endDate: string | null | undefined): boolean {
  if (!startDate || !endDate) return true;
  const start = parseDate(startDate).getTime();
  const end = parseDate(endDate).getTime();
  return end >= start;
}
