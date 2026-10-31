import { Linking, Platform } from 'react-native';

export interface UpiPaymentParams {
  payeeUpiId: string;
  payeeName: string;
  amount: number;
  note?: string;
  transactionRef?: string;
}

/**
 * Builds standard NPCI UPI URI scheme compatible with Google Pay, PhonePe, Paytm, BHIM, Cred, etc.
 * Spec: upi://pay?pa=...&pn=...&am=...&cu=INR&tn=...
 */
export function buildUpiUri(params: UpiPaymentParams): string {
  const { payeeUpiId, payeeName, amount, note, transactionRef } = params;
  const cleanId = payeeUpiId.trim();
  const cleanName = payeeName.trim();
  const cleanAmount = Math.max(0, amount).toFixed(2);
  const cleanNote = (note || 'FairShare Settlement').trim();

  let url = `upi://pay?pa=${cleanId}&pn=${encodeURIComponent(cleanName)}&am=${cleanAmount}&cu=INR&tn=${encodeURIComponent(cleanNote)}`;

  if (transactionRef) {
    url += `&tr=${encodeURIComponent(transactionRef)}`;
  }

  return url;
}

/**
 * Generates a high-resolution QR code URL for the UPI payment link
 * for desktop/web cross-device scanning.
 */
export function getUpiQrCodeUrl(upiUri: string, size = 260): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(upiUri)}`;
}

/**
 * Attempts to launch installed UPI apps (GPay, PhonePe, Paytm, BHIM) on mobile.
 * Returns true if opened successfully, false if unsupported or not installed.
 */
export async function openUpiApp(params: UpiPaymentParams): Promise<boolean> {
  const uri = buildUpiUri(params);

  if (Platform.OS === 'web') {
    return false;
  }

  try {
    const supported = await Linking.canOpenURL(uri);
    if (supported) {
      await Linking.openURL(uri);
      return true;
    }
  } catch {
    // If canOpenURL check throws or fails, try direct open
    try {
      await Linking.openURL(uri);
      return true;
    } catch {
      return false;
    }
  }

  return false;
}

