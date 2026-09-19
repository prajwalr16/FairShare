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
  return `${symbol}${Number.isFinite(amount) ? amount.toFixed(2) : '0.00'}`;
}
