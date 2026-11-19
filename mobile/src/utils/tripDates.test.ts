import test, { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  parseDate,
  toIsoDate,
  formatDate,
  formatShortDate,
  getDayCount,
  addDaysIso,
  isValidDateRange,
} from './tripDates.ts';

describe('tripDates Utility Unit Tests', () => {
  it('parses YYYY-MM-DD string into a valid Date at noon', () => {
    const date = parseDate('2026-11-20');
    assert.strictEqual(date.getFullYear(), 2026);
    assert.strictEqual(date.getMonth(), 10); // 0-indexed November
    assert.strictEqual(date.getDate(), 20);
    assert.strictEqual(date.getHours(), 12);
  });

  it('converts Date object into correct YYYY-MM-DD ISO string', () => {
    const date = new Date(2026, 4, 9); // May 9, 2026
    assert.strictEqual(toIsoDate(date), '2026-05-09');
  });

  it('calculates single-day and multi-day day counts accurately', () => {
    assert.strictEqual(getDayCount('2026-12-01', '2026-12-01'), 1);
    assert.strictEqual(getDayCount('2026-12-01', '2026-12-05'), 5);
    assert.strictEqual(getDayCount('2026-12-28', '2027-01-02'), 6);
  });

  it('handles null, empty, or inverted day counts safely', () => {
    assert.strictEqual(getDayCount(null, null), 1);
    assert.strictEqual(getDayCount('2026-12-10', null), 1);
    // End date before start date defaults to 1
    assert.strictEqual(getDayCount('2026-12-10', '2026-12-05'), 1);
  });

  it('adds days across months and leap years correctly in ISO format', () => {
    assert.strictEqual(addDaysIso('2026-11-28', 3), '2026-12-01');
    assert.strictEqual(addDaysIso('2028-02-28', 1), '2028-02-29'); // 2028 is leap year
    assert.strictEqual(addDaysIso('2028-02-28', 2), '2028-03-01');
  });

  it('validates date ranges correctly', () => {
    assert.strictEqual(isValidDateRange('2026-11-01', '2026-11-10'), true);
    assert.strictEqual(isValidDateRange('2026-11-10', '2026-11-10'), true);
    assert.strictEqual(isValidDateRange('2026-11-10', '2026-11-05'), false);
    assert.strictEqual(isValidDateRange(null, '2026-11-05'), true);
  });

  it('formats dates cleanly for Indian locale display', () => {
    const formatted = formatDate('2026-11-20');
    assert.ok(formatted.includes('20'));
    assert.ok(formatted.includes('Nov'));
    assert.ok(formatted.includes('2026'));
  });
});
