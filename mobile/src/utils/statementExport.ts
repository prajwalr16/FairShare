import { Platform, Share } from 'react-native';
import { GroupOverview } from '../services/groupService';
import { GroupSettlement } from '../services/settlementService';
import { formatCurrency } from './currency';

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
  group: GroupOverview | { name: string; currency?: string; [key: string]: any };
  expenses: ExportExpenseItem[];
  settlements: GroupSettlement[];
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

/**
 * Triggers CSV download on Web or native Share Sheet on iOS/Android.
 */
export async function downloadGroupCsv(data: StatementData): Promise<boolean> {
  const csvContent = generateGroupCsv(data);
  const cleanName = (data.group.name || 'Group').replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `FairShare_${cleanName}_Statement.csv`;

  if (Platform.OS === 'web' && typeof window !== 'undefined' && typeof document !== 'undefined') {
    try {
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      return true;
    } catch {
      return false;
    }
  }

  try {
    await Share.share({
      title: filename,
      message: csvContent,
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Generates an executive CRED luxury dark printable HTML statement report.
 */
export function openPrintableStatement(data: StatementData): boolean {
  if (Platform.OS !== 'web' || typeof window === 'undefined') {
    return false;
  }

  const { group, expenses, settlements } = data;
  const currency = group.currency || 'INR';
  const cleanName = group.name || 'Group';
  const exportDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  const totalExpense = expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  const totalSettled = settlements.reduce((sum, s) => sum + (Number(s.amount) || 0), 0);

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>FairShare Statement - ${cleanName}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
    body { background-color: #06090F; color: #E2E8F0; padding: 40px 24px; max-width: 900px; margin: 0 auto; }
    .header { border-bottom: 1px solid rgba(0, 229, 255, 0.2); padding-bottom: 24px; margin-bottom: 28px; display: flex; justify-content: space-between; align-items: flex-start; }
    .title-row h1 { font-size: 28px; font-weight: 800; color: #FFFFFF; letter-spacing: -0.5px; }
    .subtitle { color: #00E5FF; font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 1.5px; margin-top: 4px; }
    .meta-box { text-align: right; font-size: 13px; color: #94A3B8; }
    .kpi-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; margin-bottom: 32px; }
    .kpi-card { background: #0E1524; border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 14px; padding: 18px; }
    .kpi-label { font-size: 11px; text-transform: uppercase; color: #94A3B8; font-weight: 700; letter-spacing: 1px; }
    .kpi-value { font-size: 24px; font-weight: 800; color: #FFFFFF; margin-top: 6px; }
    .kpi-accent { color: #00E5FF; }
    .kpi-success { color: #10B981; }
    h2 { font-size: 18px; color: #FFFFFF; margin: 28px 0 14px 0; font-weight: 700; display: flex; align-items: center; gap: 8px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 24px; background: #0E1524; border-radius: 12px; overflow: hidden; border: 1px solid rgba(255,255,255,0.06); }
    th { background: rgba(255,255,255,0.03); color: #94A3B8; text-align: left; padding: 12px 16px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.8px; font-weight: 700; border-bottom: 1px solid rgba(255,255,255,0.08); }
    td { padding: 14px 16px; font-size: 13px; border-bottom: 1px solid rgba(255,255,255,0.04); color: #CBD5E1; }
    tr:last-child td { border-bottom: none; }
    .text-right { text-align: right; }
    .badge { display: inline-block; padding: 3px 8px; border-radius: 6px; font-size: 11px; font-weight: 700; }
    .badge-exp { background: rgba(0, 229, 255, 0.15); color: #00E5FF; }
    .badge-st { background: rgba(16, 185, 129, 0.15); color: #10B981; }
    .actions-bar { margin-top: 36px; padding-top: 20px; border-top: 1px solid rgba(255,255,255,0.08); display: flex; justify-content: space-between; align-items: center; }
    .print-btn { background: #00E5FF; color: #06090F; border: none; padding: 12px 24px; border-radius: 10px; font-weight: 700; font-size: 14px; cursor: pointer; transition: opacity 0.2s; }
    .print-btn:hover { opacity: 0.9; }
    @media print {
      body { background: #FFFFFF; color: #0F172A; padding: 0; }
      .header { border-bottom-color: #E2E8F0; }
      .title-row h1 { color: #0F172A; }
      .kpi-card { background: #F8FAFC; border-color: #E2E8F0; }
      .kpi-value { color: #0F172A; }
      table { background: #FFFFFF; border-color: #E2E8F0; }
      th { background: #F1F5F9; color: #475569; border-bottom-color: #CBD5E1; }
      td { border-bottom-color: #E2E8F0; color: #1E293B; }
      .print-btn, .actions-bar { display: none; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="title-row">
      <div class="subtitle">FairShare Statement</div>
      <h1>${cleanName}</h1>
    </div>
    <div class="meta-box">
      <div>Generated on: <strong>${exportDate}</strong></div>
      <div>Currency: <strong>${currency}</strong></div>
    </div>
  </div>

  <div class="kpi-grid">
    <div class="kpi-card">
      <div class="kpi-label">Total Group Spend</div>
      <div class="kpi-value kpi-accent">${formatCurrency(totalExpense, currency)}</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">Total Debt Settled</div>
      <div class="kpi-value kpi-success">${formatCurrency(totalSettled, currency)}</div>
    </div>
  </div>

  <h2>Activity Ledger</h2>
  <table>
    <thead>
      <tr>
        <th>Date</th>
        <th>Type</th>
        <th>Title / Note</th>
        <th>Category</th>
        <th>Payer / From</th>
        <th class="text-right">Amount</th>
      </tr>
    </thead>
    <tbody>
      ${expenses
        .slice(0, 50)
        .map((e) => {
          const dateStr = e.expense_date || e.created_at || '';
          return `<tr>
            <td>${dateStr ? dateStr.split('T')[0] : 'N/A'}</td>
            <td><span class="badge badge-exp">Expense</span></td>
            <td><strong>${e.title}</strong></td>
            <td>${e.category || 'General'}</td>
            <td>${e.paid_by_name || 'Member'}</td>
            <td class="text-right" style="font-weight: 800; color: #FFFFFF;">${formatCurrency(e.amount, currency)}</td>
          </tr>`;
        })
        .join('')}
      ${settlements
        .slice(0, 30)
        .map((s) => {
          const dateStr = s.created_at || '';
          return `<tr>
            <td>${dateStr ? dateStr.split('T')[0] : 'N/A'}</td>
            <td><span class="badge badge-st">Settlement</span></td>
            <td>${s.note || 'Debt Settlement'}</td>
            <td>Settlement</td>
            <td>${s.from_name || 'Sender'} &rarr; ${s.to_name || 'Receiver'}</td>
            <td class="text-right" style="font-weight: 800; color: #10B981;">${formatCurrency(s.amount, currency)}</td>
          </tr>`;
        })
        .join('')}
    </tbody>
  </table>

  <div class="actions-bar">
    <div style="font-size: 12px; color: #64748B;">Generated by FairShare &bull; Zero Conflict Group Finances</div>
    <button class="print-btn" onclick="window.print()">Print / Save as PDF</button>
  </div>
</body>
</html>`;

  try {
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
      return true;
    }
  } catch {
    // Popup blocked
  }

  return false;
}
