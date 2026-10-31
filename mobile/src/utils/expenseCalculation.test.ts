import test, { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  calculateSplits,
  validateSplit,
  sharesTotal,
  type SplitInput,
} from './expenseCalculation.ts';

describe('expenseCalculation Unit Tests', () => {
  it('splits equal amounts with largest remainder distribution (33.34, 33.33, 33.33)', () => {
    const inputs: SplitInput[] = [
      { userId: 'u1', value: 0 },
      { userId: 'u2', value: 0 },
      { userId: 'u3', value: 0 },
    ];

    const result = calculateSplits('Equal', 100, inputs);
    assert.strictEqual(result.length, 3);

    const sum = sharesTotal(result);
    assert.strictEqual(sum, 100);

    // One person gets 33.34, others 33.33
    const amounts = result.map((r) => r.amount);
    assert.ok(amounts.includes(33.34));
    assert.ok(amounts.includes(33.33));
  });

  it('splits equal amounts evenly when divisible', () => {
    const inputs: SplitInput[] = [
      { userId: 'u1', value: 0 },
      { userId: 'u2', value: 0 },
      { userId: 'u3', value: 0 },
      { userId: 'u4', value: 0 },
    ];

    const result = calculateSplits('Equal', 100, inputs);
    assert.strictEqual(result.length, 4);
    for (const item of result) {
      assert.strictEqual(item.amount, 25);
    }
  });

  it('handles percentage splits correctly', () => {
    const inputs: SplitInput[] = [
      { userId: 'u1', value: 50 },
      { userId: 'u2', value: 25 },
      { userId: 'u3', value: 25 },
    ];

    const result = calculateSplits('Percentage', 200, inputs);
    assert.strictEqual(result.length, 3);
    assert.strictEqual(result.find((r) => r.userId === 'u1')?.amount, 100);
    assert.strictEqual(result.find((r) => r.userId === 'u2')?.amount, 50);
    assert.strictEqual(result.find((r) => r.userId === 'u3')?.amount, 50);

    const validation = validateSplit('Percentage', 200, inputs);
    assert.strictEqual(validation, null);
  });

  it('handles shares splits correctly', () => {
    const inputs: SplitInput[] = [
      { userId: 'u1', value: 2 },
      { userId: 'u2', value: 1 },
      { userId: 'u3', value: 1 },
    ];

    const result = calculateSplits('Shares', 100, inputs);
    assert.strictEqual(result.length, 3);
    assert.strictEqual(result.find((r) => r.userId === 'u1')?.amount, 50);
    assert.strictEqual(result.find((r) => r.userId === 'u2')?.amount, 25);
    assert.strictEqual(result.find((r) => r.userId === 'u3')?.amount, 25);

    const validation = validateSplit('Shares', 100, inputs);
    assert.strictEqual(validation, null);
  });

  it('handles exact splits correctly and validates sums', () => {
    const validInputs: SplitInput[] = [
      { userId: 'u1', value: 40.5 },
      { userId: 'u2', value: 59.5 },
    ];

    const result = calculateSplits('Exact', 100, validInputs);
    assert.strictEqual(result.length, 2);
    assert.strictEqual(result.find((r) => r.userId === 'u1')?.amount, 40.5);
    assert.strictEqual(result.find((r) => r.userId === 'u2')?.amount, 59.5);

    const validCheck = validateSplit('Exact', 100, validInputs);
    assert.strictEqual(validCheck, null);

    const invalidInputs: SplitInput[] = [
      { userId: 'u1', value: 40.0 },
      { userId: 'u2', value: 50.0 },
    ];
    const invalidCheck = validateSplit('Exact', 100, invalidInputs);
    assert.strictEqual(
      invalidCheck,
      'Exact amounts must add up to the expense total.'
    );
  });

  it('returns zero amounts when total is zero or empty', () => {
    const result = calculateSplits('Equal', 0, [{ userId: 'u1', value: 0 }]);
    assert.strictEqual(result.length, 1);
    assert.strictEqual(result[0].amount, 0);

    const emptyResult = calculateSplits('Equal', 100, []);
    assert.strictEqual(emptyResult.length, 0);
  });
});
