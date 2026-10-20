export const CURRENCY_SYMBOLS: Record<string, string> = {
  INR: '₹',
  USD: '$',
  EUR: '€',
  GBP: '£',
  JPY: '¥',
  AUD: 'A$',
  CAD: 'C$',
  AED: 'د.إ',
  SGD: 'S$',
};

export function getCurrencySymbol(currency?: string | null) {
  const code = (currency || 'INR').trim().toUpperCase();
  return CURRENCY_SYMBOLS[code] || `${code} `;
}

export function formatCurrency(
  value: number | string | null | undefined,
  currency?: string | null
) {
  const amount = Number(value ?? 0);
  const symbol = getCurrencySymbol(currency);
  if (!Number.isFinite(amount)) return `${symbol}0.00`;
  try {
    const formatted = Math.abs(amount).toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    const prefix = amount < 0 ? '-' : '';
    return `${prefix}${symbol}${formatted}`;
  } catch {
    return `${symbol}${Math.abs(amount).toFixed(2)}`;
  }
}
