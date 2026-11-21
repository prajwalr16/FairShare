import { Linking, Platform } from 'react-native';
import {
  UpiPaymentParams,
  buildUpiUri,
  buildDirectUpiUri,
  buildWhatsAppReminder,
  SupportedUpiApp,
  isValidUpiId,
  getUpiQrCodeUrl,
  getUpiQrCodeFallbackUrl,
  COMMON_UPI_HANDLES,
} from './upiScheme';

export {
  UpiPaymentParams,
  buildUpiUri,
  buildDirectUpiUri,
  buildWhatsAppReminder,
  SupportedUpiApp,
  isValidUpiId,
  getUpiQrCodeUrl,
  getUpiQrCodeFallbackUrl,
  COMMON_UPI_HANDLES,
};

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

/**
 * Attempts to launch a specific targeted UPI app (Google Pay, PhonePe, Paytm),
 * and automatically falls back to standard UPI intent if the specific app is not found.
 */
export async function openDirectUpiApp(
  app: SupportedUpiApp,
  params: UpiPaymentParams
): Promise<boolean> {
  if (Platform.OS === 'web') {
    return false;
  }

  const targetedUri = buildDirectUpiUri(app, params);
  try {
    const supported = await Linking.canOpenURL(targetedUri);
    if (supported) {
      await Linking.openURL(targetedUri);
      return true;
    }
  } catch {
    // Fall back to standard upi://
  }

  return openUpiApp(params);
}

/**
 * Launches WhatsApp with a pre-filled friendly payment reminder.
 */
export async function openWhatsAppReminder(params: {
  payeeName: string;
  payerName?: string;
  amount: number;
  currency: string;
  groupName?: string;
  payeeUpiId?: string;
}): Promise<boolean> {
  const url = buildWhatsAppReminder(params);
  try {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined') {
        window.open(url, '_blank');
        return true;
      }
    }
    await Linking.openURL(url);
    return true;
  } catch (err) {
    console.warn('Could not launch WhatsApp reminder:', err);
    return false;
  }
}
