import test from 'node:test';
import assert from 'node:assert/strict';
import { parseBulkMemberNames, findAutoMatchPlaceholder } from './memberOnboarding.ts';

test('memberOnboarding Utility Unit Tests', async (t) => {
  await t.test('parses comma-separated member names cleanly with trimming and deduplication', () => {
    const raw = ' Rahul , Sneha,  Rohan , Sneha , Amit ';
    const parsed = parseBulkMemberNames(raw);
    assert.deepEqual(parsed, ['Rahul', 'Sneha', 'Rohan', 'Amit']);
  });

  await t.test('parses newline-separated member names', () => {
    const raw = "Rahul\nSneha\n\nRohan\n";
    const parsed = parseBulkMemberNames(raw);
    assert.deepEqual(parsed, ['Rahul', 'Sneha', 'Rohan']);
  });

  await t.test('handles empty, whitespace-only, or invalid inputs safely', () => {
    assert.deepEqual(parseBulkMemberNames(''), []);
    assert.deepEqual(parseBulkMemberNames('   ,  , \n '), []);
  });

  await t.test('auto-matches candidate placeholder by email taking top precedence', () => {
    const candidates = [
      { id: '1', display_name: 'Rahul S', email: 'rahul@example.com' },
      { id: '2', display_name: 'Sneha', email: 'sneha@example.com' },
    ];
    const match = findAutoMatchPlaceholder(candidates, 'RAHUL@EXAMPLE.COM', 'Different Name');
    assert.ok(match);
    assert.equal(match.id, '1');
    assert.equal(match.display_name, 'Rahul S');
  });

  await t.test('auto-matches candidate placeholder by display name when email does not match', () => {
    const candidates = [
      { id: '1', display_name: 'Rahul', email: null },
      { id: '2', display_name: 'Sneha', email: null },
    ];
    const match = findAutoMatchPlaceholder(candidates, 'unknown@example.com', 'rahul');
    assert.ok(match);
    assert.equal(match.id, '1');
  });

  await t.test('returns null when no candidate matches', () => {
    const candidates = [
      { id: '1', display_name: 'Rahul', email: null },
      { id: '2', display_name: 'Sneha', email: null },
    ];
    const match = findAutoMatchPlaceholder(candidates, 'random@example.com', 'Vikas');
    assert.equal(match, null);
  });
});
