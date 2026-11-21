export interface UpiPaymentParams {
  payeeUpiId: string;
  payeeName: string;
  amount: number;
  note?: string;
  transactionRef?: string;
}

export const COMMON_UPI_HANDLES = [
  '@okhdfcbank',
  '@okaxis',
  '@oksbi',
  '@paytm',
  '@ybl',
  '@icici',
];

/**
 * Validates whether a given string is a valid NPCI UPI Virtual Payment Address (VPA).
 * Spec: username@handle (e.g., 9876543210@paytm, john.doe@okhdfcbank).
 */
export function isValidUpiId(upiId: string | null | undefined): boolean {
  if (!upiId) return false;
  const trimmed = upiId.trim();
  // Must match standard NPCI UPI handle regex: username@bank
  const upiRegex = /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z0-9]{2,64}$/;
  if (!upiRegex.test(trimmed)) return false;

  // Reject dummy placeholder handles
  if (trimmed.endsWith('@upi') && (trimmed.startsWith('member') || trimmed === 'payee@upi')) {
    return false;
  }
  return true;
}

/**
 * Builds standard NPCI UPI URI scheme compatible with Google Pay, PhonePe, Paytm, BHIM, and other UPI apps.
 * Spec: upi://pay?pa=...&pn=...&am=...&cu=INR&tn=...
 */
export function buildUpiUri(params: UpiPaymentParams): string {
  const { payeeUpiId, payeeName, amount, note, transactionRef } = params;
  const cleanId = (payeeUpiId || '').trim();
  const cleanName = (payeeName || 'Member').trim();
  const cleanAmount = Math.max(0, amount).toFixed(2);
  const cleanNote = (note || 'FairShare Settlement').trim().slice(0, 50);

  let url = `upi://pay?pa=${cleanId}&pn=${encodeURIComponent(cleanName)}&am=${cleanAmount}&cu=INR&tn=${encodeURIComponent(cleanNote)}`;

  if (transactionRef) {
    url += `&tr=${encodeURIComponent(transactionRef)}`;
  }

  return url;
}

/**
 * Generates a high-resolution QR code URL for the UPI payment link
 * with required 4-module quiet zone (white margin) for camera scanner detection.
 */
export function getUpiQrCodeUrl(upiUri: string, size = 260): string {
  // margin=4 is essential for phone camera QR readers to recognize corner finder patterns
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&margin=4&data=${encodeURIComponent(upiUri)}`;
}

/**
 * Fallback QR code provider in case qrserver is blocked or down.
 */
export function getUpiQrCodeFallbackUrl(upiUri: string, size = 260): string {
  return `https://quickchart.io/qr?size=${size}&margin=4&text=${encodeURIComponent(upiUri)}`;
}

export type SupportedUpiApp = 'gpay' | 'phonepe' | 'paytm' | 'generic';

/**
 * Builds targeted deep links for specific UPI applications.
 */
export function buildDirectUpiUri(app: SupportedUpiApp, params: UpiPaymentParams): string {
  const genericUri = buildUpiUri(params);
  const query = genericUri.replace(/^upi:\/\/pay\?/, '');
  switch (app) {
    case 'gpay':
      return `tez://upi/pay?${query}`;
    case 'phonepe':
      return `phonepe://pay?${query}`;
    case 'paytm':
      return `paytmmp://pay?${query}`;
    default:
      return genericUri;
  }
}

/**
 * Builds a friendly WhatsApp payment reminder link.
 */
export function buildWhatsAppReminder(params: {
  payeeName: string;
  payerName?: string;
  amount: number;
  currency: string;
  groupName?: string;
  payeeUpiId?: string;
}): string {
  const amountStr = `${params.currency || '₹'} ${params.amount.toFixed(2)}`;
  const groupStr = params.groupName ? ` for *${params.groupName}*` : '';
  const upiLink = params.payeeUpiId
    ? `\n\n📲 *Quick UPI Pay:* upi://pay?pa=${params.payeeUpiId}&pn=${encodeURIComponent(params.payeeName)}&am=${params.amount.toFixed(2)}&cu=INR`
    : '';

  const text = `Hey! 👋 Just a quick friendly settlement reminder${groupStr} on FairShare:\n\n💰 *Amount:* ${amountStr}\n👤 *Pay to:* ${params.payeeName}${params.payeeUpiId ? ` (${params.payeeUpiId})` : ''}${upiLink}\n\nLet's settle up whenever you have a moment. Thanks! ✨`;
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}
