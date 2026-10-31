import { Platform } from 'react-native';

let Haptics: typeof import('expo-haptics') | null = null;
try {
  Haptics = require('expo-haptics');
} catch {
  Haptics = null;
}

/**
 * Safe cross-platform haptic feedback utilities.
 * Gracefully no-ops on web, desktop, and unsupported mobile environments.
 */
export async function hapticLight(): Promise<void> {
  if (Platform.OS === 'web' || !Haptics) return;
  try {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  } catch {
    // Ignore haptic failures
  }
}

export async function hapticMedium(): Promise<void> {
  if (Platform.OS === 'web' || !Haptics) return;
  try {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  } catch {
    // Ignore haptic failures
  }
}

export async function hapticHeavy(): Promise<void> {
  if (Platform.OS === 'web' || !Haptics) return;
  try {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
  } catch {
    // Ignore haptic failures
  }
}

export async function hapticSelection(): Promise<void> {
  if (Platform.OS === 'web' || !Haptics) return;
  try {
    await Haptics.selectionAsync();
  } catch {
    // Ignore haptic failures
  }
}

export async function hapticSuccess(): Promise<void> {
  if (Platform.OS === 'web' || !Haptics) return;
  try {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  } catch {
    // Ignore haptic failures
  }
}

export async function hapticWarning(): Promise<void> {
  if (Platform.OS === 'web' || !Haptics) return;
  try {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  } catch {
    // Ignore haptic failures
  }
}

export async function hapticError(): Promise<void> {
  if (Platform.OS === 'web' || !Haptics) return;
  try {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  } catch {
    // Ignore haptic failures
  }
}
