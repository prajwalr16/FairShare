import test, { describe, it } from 'node:test';
import assert from 'node:assert';
import { generateGroupCsv, type StatementData } from './statementFormatter.ts';

describe('statementFormatter Utility Unit Tests', () => {
  it('generates standard RFC 4180 CSV with header metadata and total expense sum', () => {
    const data: StatementData = {
      group: {
        name: 'Goa Trip 2026',
        currency: 'INR',
      },
      expenses: [
        {
          id: 'e1',
          title: 'Dinner at Britto’s',
          amount: 2500.5,
          category: 'Food',
          paid_by_name: 'Alice',
          created_at: '2026-11-20T20:00:00Z',
        },
        {
          id: 'e2',
          title: 'Scooter Rental',
          amount: 800.0,
          category: 'Transport',
          paid_by_name: 'Bob',
          created_at: '2026-11-21T10:00:00Z',
        },
      ],
      settlements: [
        {
          id: 's1',
          group_id: 'g1',
          from_user_id: 'u2',
          to_user_id: 'u1',
          from_name: 'Bob',
          to_name: 'Alice',
          amount: 400.0,
          note: 'UPI Payment',
          created_at: '2026-11-21T15:00:00Z',
        },
      ],
    };

    const csv = generateGroupCsv(data);
    assert.ok(csv.includes('FAIRSHARE GROUP STATEMENT'));
    assert.ok(csv.includes('Group Name,Goa Trip 2026'));
    assert.ok(csv.includes('Currency,INR'));
    assert.ok(csv.includes('Total Group Expenses,3300.50'));
    assert.ok(csv.includes('CHRONOLOGICAL ACTIVITY LEDGER'));

    // Verify activity columns
    assert.ok(csv.includes('"Dinner at Britto’s"'));
    assert.ok(csv.includes('"Scooter Rental"'));
    assert.ok(csv.includes('"UPI Payment"'));
    assert.ok(csv.includes('"Settlement"'));
  });

  it('correctly escapes quotes and commas in titles and participant names', () => {
    const data: StatementData = {
      group: { name: 'Apartment "402", Bangalore', currency: 'INR' },
      expenses: [
        {
          id: 'e1',
          title: 'Groceries, Fruits & "Special" Snacks',
          amount: 500,
          category: 'Food',
          paid_by_name: 'John "The Chef" Doe',
          created_at: '2026-11-20T12:00:00Z',
        },
      ],
      settlements: [],
    };

    const csv = generateGroupCsv(data);
    // Double quotes should be escaped as ""
    assert.ok(csv.includes('""Special""'));
    assert.ok(csv.includes('""The Chef""'));
  });

  it('handles empty expenses and settlements gracefully', () => {
    const data: StatementData = {
      group: { name: 'Fresh Group', currency: 'USD' },
      expenses: [],
      settlements: [],
    };

    const csv = generateGroupCsv(data);
    assert.ok(csv.includes('Total Group Expenses,0.00'));
    assert.ok(csv.includes('Fresh Group'));
  });
});
