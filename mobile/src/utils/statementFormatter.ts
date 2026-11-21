export interface ExportExpenseItem {
  id?: string;
  title: string;
  amount: number | string;
  category?: string;
  paid_by_name?: string | null;
  paid_by?: string;
  created_at?: string;
  expense_date?: string | null;
}

export interface StatementData {
  group: { name: string; currency?: string; [key: string]: any };
  expenses: ExportExpenseItem[];
  settlements: Array<{
    id?: string;
    from_name?: string | null;
    to_name?: string | null;
    amount: number | string;
    note?: string | null;
    created_at?: string;
    [key: string]: any;
  }>;
  currentUserId?: string;
}

/**
 * Builds standard RFC 4180 compliant CSV string for group expenses and settlements.
 */
export function generateGroupCsv(data: StatementData): string {
  const { group, expenses, settlements } = data;
  const currency = group.currency || 'INR';

  const totalExpenseNum = expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

  const rows: string[][] = [
    ['FAIRSHARE GROUP STATEMENT'],
    ['Group Name', group.name],
    ['Currency', currency],
    ['Exported Date', new Date().toISOString().split('T')[0]],
    ['Total Group Expenses', totalExpenseNum.toFixed(2)],
    [],
    ['CHRONOLOGICAL ACTIVITY LEDGER'],
    ['Date', 'Type', 'Title / Note', 'Category', 'Paid By / Sender', 'Split With / Receiver', 'Amount', 'Currency'],
  ];

  type LedgerItem = {
    date: string;
    type: 'Expense' | 'Settlement';
    title: string;
    category: string;
    from: string;
    to: string;
    amount: number;
  };

  const ledger: LedgerItem[] = [];

  for (const exp of expenses) {
    ledger.push({
      date: exp.expense_date || exp.created_at || '',
      type: 'Expense',
      title: exp.title,
      category: exp.category || 'General',
      from: exp.paid_by_name || 'Member',
      to: 'All Participants',
      amount: Number(exp.amount) || 0,
    });
  }

  for (const st of settlements) {
    ledger.push({
      date: st.created_at || '',
      type: 'Settlement',
      title: st.note || 'Debt Settlement',
      category: 'Settlement',
      from: st.from_name || 'Sender',
      to: st.to_name || 'Receiver',
      amount: Number(st.amount) || 0,
    });
  }

  ledger.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  for (const item of ledger) {
    const formattedDate = item.date ? item.date.split('T')[0] : 'N/A';
    rows.push([
      `"${formattedDate}"`,
      `"${item.type}"`,
      `"${item.title.replace(/"/g, '""')}"`,
      `"${item.category}"`,
      `"${item.from.replace(/"/g, '""')}"`,
      `"${item.to.replace(/"/g, '""')}"`,
      item.amount.toFixed(2),
      currency,
    ]);
  }

  return rows.map((r) => r.join(',')).join('\r\n');
}
