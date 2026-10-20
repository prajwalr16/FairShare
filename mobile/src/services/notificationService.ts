import { Platform } from 'react-native';
import { apiRequest } from './apiClient';

/**
 * Register push token with the FairShare API backend.
 * Zero-cost service using Expo's free push notification infrastructure and Web Notification API.
 */
export async function registerPushNotificationToken(): Promise<boolean> {
  try {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined' && 'Notification' in window) {
        if (Notification.permission === 'default') {
          await Notification.requestPermission();
        }
      }
      return true;
    }

    try {
      const Notifications = require('expo-notifications');
      const Device = require('expo-device');

      if (!Device.isDevice) {
        return false;
      }

      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        return false;
      }

      const tokenData = await Notifications.getExpoPushTokenAsync();
      const token = tokenData?.data;
      if (token) {
        await apiRequest('/notifications/register-token', {
          method: 'POST',
          body: {
            token,
            platform: Platform.OS,
          },
        });
        return true;
      }
    } catch {
      // Dev simulator skip
    }

    return true;
  } catch {
    return false;
  }
}
