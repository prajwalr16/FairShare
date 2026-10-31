import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NetworkStatus, subscribeToNetworkStatus } from '../services/offlineQueue';

export default function OfflineStatusBar() {
  const [status, setStatus] = useState<NetworkStatus>({
    isOnline: true,
    pendingCount: 0,
    isSyncing: false,
  });

  useEffect(() => {
    return subscribeToNetworkStatus(setStatus);
  }, []);

  // When fully online and no pending offline changes, render nothing
  if (status.isOnline && status.pendingCount === 0 && !status.isSyncing) {
    return null;
  }

  return (
    <View style={[styles.container, !status.isOnline ? styles.offlineBg : styles.syncingBg]}>
      {status.isSyncing ? (
        <ActivityIndicator size="small" color="#00E5FF" style={styles.icon} />
      ) : (
        <Ionicons
          name={status.isOnline ? 'cloud-upload-outline' : 'cloud-offline-outline'}
          size={14}
          color={status.isOnline ? '#00E5FF' : '#F59E0B'}
          style={styles.icon}
        />
      )}
      <Text style={styles.text} numberOfLines={1}>
        {!status.isOnline
          ? `Offline mode ${status.pendingCount > 0 ? `• ${status.pendingCount} pending sync` : '• Cached data'}`
          : status.isSyncing
            ? `Syncing ${status.pendingCount} offline change${status.pendingCount === 1 ? '' : 's'}…`
            : `${status.pendingCount} change${status.pendingCount === 1 ? '' : 's'} queued for sync`}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
  },
  offlineBg: {
    backgroundColor: '#1E170A',
    borderBottomColor: 'rgba(245, 158, 11, 0.3)',
  },
  syncingBg: {
    backgroundColor: '#091522',
    borderBottomColor: 'rgba(0, 229, 255, 0.3)',
  },
  icon: {
    marginRight: 6,
  },
  text: {
    color: '#E2E8F0',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});

