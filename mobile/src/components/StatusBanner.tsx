import React from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { formatAuthError } from '../utils/authErrors';

export type StatusBannerType = 'error' | 'success' | 'info';

export interface StatusBannerProps {
  type?: StatusBannerType | null;
  message?: string | null;
  title?: string | null;
  actionHint?: string | null;
  onDismiss?: () => void;
  style?: ViewStyle | ViewStyle[];
}

export default function StatusBanner({
  type,
  message,
  title,
  actionHint,
  onDismiss,
  style,
}: StatusBannerProps) {
  if (!type || !message) return null;

  const config = {
    error: {
      boxStyle: styles.errorBox,
      titleStyle: styles.errorTitle,
      textStyle: styles.errorText,
      hintStyle: styles.errorHint,
      icon: 'alert-circle' as const,
      iconColor: '#EF4444',
    },
    success: {
      boxStyle: styles.successBox,
      titleStyle: styles.successTitle,
      textStyle: styles.successText,
      hintStyle: styles.successHint,
      icon: 'checkmark-circle' as const,
      iconColor: '#10B981',
    },
    info: {
      boxStyle: styles.infoBox,
      titleStyle: styles.infoTitle,
      textStyle: styles.infoText,
      hintStyle: styles.infoHint,
      icon: 'information-circle' as const,
      iconColor: '#38BDF8',
    },
  }[type];

  // Clean raw JSON strings
  let rawMessage = message;
  try {
    if (message.startsWith('{') && message.endsWith('}')) {
      const parsed = JSON.parse(message);
      rawMessage = parsed.message || parsed.error_description || parsed.msg || message;
    }
  } catch {}

  // If this is an error and no custom title is provided, run our friendly diagnosis
  let displayTitle = title;
  let displayMessage = rawMessage;
  let displayHint = actionHint;

  if (type === 'error') {
    const formatted = formatAuthError(rawMessage);
    if (!displayTitle && (formatted.title !== 'Authentication Error' && formatted.title !== 'Unknown Error')) {
      displayTitle = formatted.title;
    }
    displayMessage = formatted.message;
    if (!displayHint && formatted.actionHint) {
      displayHint = formatted.actionHint;
    }
  }

  return (
    <View style={[styles.container, config.boxStyle, style]}>
      <Ionicons name={config.icon} size={22} color={config.iconColor} style={styles.icon} />
      <View style={styles.contentWrap}>
        {displayTitle ? (
          <Text style={[styles.title, config.titleStyle]}>{displayTitle}</Text>
        ) : null}
        <Text style={[styles.message, config.textStyle]}>{displayMessage}</Text>
        {displayHint ? (
          <Text style={[styles.hint, config.hintStyle]}>{displayHint}</Text>
        ) : null}
      </View>
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
    alignItems: 'flex-start',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    marginBottom: 16,
    width: '100%',
  },
  icon: {
    marginRight: 10,
    marginTop: 2,
  },
  contentWrap: {
    flex: 1,
  },
  title: {
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 3,
    letterSpacing: 0.2,
  },
  message: {
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '500',
  },
  hint: {
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '600',
    marginTop: 6,
    opacity: 0.92,
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
  errorTitle: {
    color: '#F87171',
  },
  errorText: {
    color: '#FCA5A5',
  },
  errorHint: {
    color: '#FED7AA',
  },
  successBox: {
    backgroundColor: '#064E3B',
    borderWidth: 1,
    borderColor: '#065F46',
  },
  successTitle: {
    color: '#34D399',
  },
  successText: {
    color: '#A7F3D0',
  },
  successHint: {
    color: '#D1FAE5',
  },
  infoBox: {
    backgroundColor: '#0F2942',
    borderWidth: 1,
    borderColor: '#1E40AF',
  },
  infoTitle: {
    color: '#60A5FA',
  },
  infoText: {
    color: '#BAE6FD',
  },
  infoHint: {
    color: '#E0F2FE',
  },
});
