import { describe, it } from 'node:test';
import assert from 'node:assert';
import { calculateManualExchange, formatConversionFormula } from './currencyConversion.ts';

describe('currencyConversion Utility Unit Tests', () => {
  it('calculates exact conversion for typical currency exchanges', () => {
    // 500 Thai Baht at 2.45 INR/THB = 1,225 INR
    const result1 = calculateManualExchange(500, 2.45);
    assert.strictEqual(result1, 1225);

    // 100 USD at 86.50 INR/USD = 8,650 INR
    const result2 = calculateManualExchange('100', '86.50');
    assert.strictEqual(result2, 8650);

    // 25.50 EUR at 92.40 INR/EUR = 2,356.20 INR
    const result3 = calculateManualExchange(25.5, 92.4);
    assert.strictEqual(result3, 2356.2);
  });

  it('handles fractional amounts and rounds to exact 2-decimal precision', () => {
    // 15.33 USD at 86.732 rate = 1329.59604 -> 1329.60
    const result = calculateManualExchange('15.33', '86.732');
    assert.strictEqual(result, 1329.6);

    // 7 JPY at 0.584 rate = 4.088 -> 4.09
    const resultJpy = calculateManualExchange(7, 0.584);
    assert.strictEqual(resultJpy, 4.09);
  });

  it('safely handles comma-separated inputs', () => {
    const result = calculateManualExchange('1,500', '2.50');
    assert.strictEqual(result, 3750);
  });

  it('returns 0 for zero, negative, null, empty or invalid inputs', () => {
    assert.strictEqual(calculateManualExchange(0, 86.5), 0);
    assert.strictEqual(calculateManualExchange(100, 0), 0);
    assert.strictEqual(calculateManualExchange(-50, 86.5), 0);
    assert.strictEqual(calculateManualExchange(50, -86.5), 0);
    assert.strictEqual(calculateManualExchange(null, 86.5), 0);
    assert.strictEqual(calculateManualExchange(50, null), 0);
    assert.strictEqual(calculateManualExchange(undefined, undefined), 0);
    assert.strictEqual(calculateManualExchange('abc', 'xyz'), 0);
    assert.strictEqual(calculateManualExchange('', ''), 0);
  });

  it('formats conversion formula summary string correctly', () => {
    const formula = formatConversionFormula('500', 'thb', '2.45', 'inr');
    assert.strictEqual(formula, '500 THB × 2.45 = 1225.00 INR');

    const formulaEur = formatConversionFormula(100, 'eur', 92.5, 'inr');
    assert.strictEqual(formulaEur, '100 EUR × 92.5 = 9250.00 INR');
  });
});
