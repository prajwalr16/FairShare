import { Linking, Platform } from 'react-native';
import {
  UpiPaymentParams,
  buildUpiUri,
  isValidUpiId,
  getUpiQrCodeUrl,
  getUpiQrCodeFallbackUrl,
  COMMON_UPI_HANDLES,
} from './upiScheme';

export {
  UpiPaymentParams,
  buildUpiUri,
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
