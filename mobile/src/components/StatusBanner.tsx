import React from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export type StatusBannerType = 'error' | 'success' | 'info';

export interface StatusBannerProps {
  type?: StatusBannerType | null;
  message?: string | null;
  onDismiss?: () => void;
  style?: ViewStyle | ViewStyle[];
}

export default function StatusBanner({
  type,
  message,
  onDismiss,
  style,
}: StatusBannerProps) {
  if (!type || !message) return null;

  const config = {
    error: {
      boxStyle: styles.errorBox,
      textStyle: styles.errorText,
      icon: 'alert-circle' as const,
      iconColor: '#EF4444',
    },
    success: {
      boxStyle: styles.successBox,
      textStyle: styles.successText,
      icon: 'checkmark-circle' as const,
      iconColor: '#10B981',
    },
    info: {
      boxStyle: styles.infoBox,
      textStyle: styles.infoText,
      icon: 'information-circle' as const,
      iconColor: '#38BDF8',
    },
  }[type];

  // Clean and format message if it is raw JSON or Supabase error code
  let displayMessage = message;
  try {
    if (message.startsWith('{') && message.endsWith('}')) {
      const parsed = JSON.parse(message);
      displayMessage = parsed.message || parsed.error_description || parsed.msg || message;
    }
  } catch {}

  // Friendly human-readable translation for common rate limit or auth errors
  if (displayMessage.toLowerCase().includes('rate limit')) {
    displayMessage = `${displayMessage}. Please wait a few seconds and try again.`;
  }

  return (
    <View style={[styles.container, config.boxStyle, style]}>
      <Ionicons name={config.icon} size={20} color={config.iconColor} style={styles.icon} />
      <Text style={[styles.message, config.textStyle]}>{displayMessage}</Text>
      {onDismiss && (
        <Pressable hitSlop={8} onPress={onDismiss} style={styles.dismissButton}>
          <Ionicons name="close" size={16} color="#94A3B8" />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    marginBottom: 16,
    width: '100%',
  },
  icon: {
    marginRight: 10,
  },
  message: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
  },
  dismissButton: {
    padding: 4,
    marginLeft: 8,
  },
  errorBox: {
    backgroundColor: '#3B1720',
    borderWidth: 1,
    borderColor: '#7F1D1D',
  },
  errorText: {
    color: '#FCA5A5',
  },
  successBox: {
    backgroundColor: '#064E3B',
    borderWidth: 1,
    borderColor: '#065F46',
  },
  successText: {
    color: '#A7F3D0',
  },
  infoBox: {
    backgroundColor: '#0F2942',
    borderWidth: 1,
    borderColor: '#1E40AF',
  },
  infoText: {
    color: '#93C5FD',
  },
});

