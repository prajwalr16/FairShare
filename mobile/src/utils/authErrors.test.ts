import test from 'node:test';
import assert from 'node:assert/strict';
import { formatAuthError } from './authErrors.ts';

test('authErrors Utility Unit Tests', async (t) => {
  await t.test('detects Supabase hourly email rate limit and provides informative explanation', () => {
    const rawErrors = [
      { message: 'Email rate limit exceeded', status: 429 },
      { message: 'over_email_send_rate_limit' },
      'Rate limit exceeded: too many emails requested',
    ];

    for (const err of rawErrors) {
      const formatted = formatAuthError(err);
      assert.equal(formatted.title, 'Hourly Email Limit Reached');
      assert.equal(formatted.isRateLimit, true);
      assert.match(formatted.message, /wait up to an hour/i);
      assert.match(formatted.actionHint || '', /placeholder member/i);
    }
  });

  await t.test('detects 60-second security cooldown', () => {
    const err = { message: 'For security purposes, you can only request this once every 60 seconds.' };
    const formatted = formatAuthError(err);
    assert.equal(formatted.title, 'Security Cooldown (60s)');
    assert.match(formatted.message, /wait 60 seconds/i);
  });

  await t.test('detects user already registered error', () => {
    const err = { message: 'User already registered' };
    const formatted = formatAuthError(err);
    assert.equal(formatted.title, 'Account Already Exists');
    assert.match(formatted.actionHint || '', /Sign In/i);
  });

  await t.test('detects invalid credentials', () => {
    const err = { message: 'Invalid login credentials' };
    const formatted = formatAuthError(err);
    assert.equal(formatted.title, 'Incorrect Credentials');
    assert.match(formatted.message, /incorrect/i);
  });

  await t.test('detects connection timeouts and backend cold-starts', () => {
    const err = { message: 'Unable to reach the FairShare server. Check backend.' };
    const formatted = formatAuthError(err);
    assert.equal(formatted.title, 'Connection Timeout');
    assert.match(formatted.actionHint || '', /warming up/i);
  });

  await t.test('safely falls back for generic or undefined errors', () => {
    const formattedNull = formatAuthError(null);
    assert.equal(formattedNull.title, 'Unknown Error');

    const formattedCustom = formatAuthError({ message: 'Custom specialized reason' });
    assert.equal(formattedCustom.title, 'Authentication Error');
    assert.equal(formattedCustom.message, 'Custom specialized reason');
  });
});
