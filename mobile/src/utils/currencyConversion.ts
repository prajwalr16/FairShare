/**
 * Manual Multi-Currency Conversion Utility.
 * 100% offline, private and secure calculation with zero external APIs.
 */

export function calculateManualExchange(
  foreignAmount: number | string | null | undefined,
  exchangeRate: number | string | null | undefined
): number {
  if (foreignAmount == null || exchangeRate == null) return 0;
  const famt = typeof foreignAmount === 'string' ? parseFloat(foreignAmount.replace(/,/g, '').trim()) : foreignAmount;
  const rate = typeof exchangeRate === 'string' ? parseFloat(exchangeRate.replace(/,/g, '').trim()) : exchangeRate;

  if (!Number.isFinite(famt) || !Number.isFinite(rate) || famt <= 0 || rate <= 0) {
    return 0;
  }

  return Number((famt * rate).toFixed(2));
}

export function formatConversionFormula(
  foreignAmount: number | string,
  foreignCurrency: string,
  rate: number | string,
  targetCurrency: string
): string {
  const normForeignCurr = (foreignCurrency || 'USD').trim().toUpperCase();
  const normTargetCurr = (targetCurrency || 'INR').trim().toUpperCase();
  const famt = typeof foreignAmount === 'string' ? parseFloat(foreignAmount.replace(/,/g, '').trim()) || 0 : foreignAmount;
  const rateNum = typeof rate === 'string' ? parseFloat(rate.replace(/,/g, '').trim()) || 0 : rate;
  const total = calculateManualExchange(famt, rateNum);

  return `${famt} ${normForeignCurr} × ${rateNum} = ${total.toFixed(2)} ${normTargetCurr}`;
}
