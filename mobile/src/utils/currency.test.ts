import test, { describe, it } from 'node:test';
import assert from 'node:assert';
import { formatCurrency, getCurrencySymbol, CURRENCY_SYMBOLS } from './currency.ts';

describe('currency Utility Unit Tests', () => {
  it('resolves correct currency symbols', () => {
    assert.strictEqual(getCurrencySymbol('INR'), '₹');
    assert.strictEqual(getCurrencySymbol('USD'), '$');
    assert.strictEqual(getCurrencySymbol('EUR'), '€');
    assert.strictEqual(getCurrencySymbol('GBP'), '£');
    assert.strictEqual(getCurrencySymbol(null), '₹');
    assert.strictEqual(getCurrencySymbol('XYZ'), 'XYZ ');
  });

  it('formats positive numbers with correct 2 decimal precision', () => {
    const formatted = formatCurrency(1250.5, 'INR');
    assert.ok(formatted.includes('₹'));
    assert.ok(formatted.includes('1,250.50'));
  });

  it('formats negative balances cleanly with leading minus sign', () => {
    const formatted = formatCurrency(-450.25, 'USD');
    assert.strictEqual(formatted, '-$450.25');
  });

  it('handles null, undefined, and non-numeric values safely', () => {
    assert.strictEqual(formatCurrency(null, 'INR'), '₹0.00');
    assert.strictEqual(formatCurrency(undefined, 'USD'), '$0.00');
    assert.strictEqual(formatCurrency('invalid', 'EUR'), '€0.00');
  });
});
