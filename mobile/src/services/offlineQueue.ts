import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { apiRequest } from './apiClient';
import { invalidateGroupOverview } from './groupService';
import { broadcastGroupMutation } from './realtimeService';

const OUTBOX_STORAGE_KEY = 'fairshare:offline_outbox:v1';

export type OutboxActionType = 'create_expense' | 'record_settlement';

export type OutboxMutation = {
  id: string;
  type: OutboxActionType;
  groupId: string;
  endpoint: string;
  method: 'POST' | 'PUT';
  body: any;
  createdAt: number;
  retries: number;
  title: string;
};

export type NetworkStatus = {
  isOnline: boolean;
  pendingCount: number;
  isSyncing: boolean;
};

let isOnline = true;
let isSyncing = false;
let outboxQueue: OutboxMutation[] = [];
let initialized = false;

const listeners = new Set<(status: NetworkStatus) => void>();

function notifyListeners() {
  const status: NetworkStatus = {
    isOnline,
    pendingCount: outboxQueue.length,
    isSyncing,
  };
  listeners.forEach((listener) => {
    try {
      listener(status);
    } catch {
      // Ignore listener error
    }
  });
}

/**
 * Initialize offline outbox and network listener.
 */
export async function initOfflineQueue(): Promise<void> {
  if (initialized) return;
  initialized = true;

  // 1. Load persisted outbox mutations
  try {
    const raw = await AsyncStorage.getItem(OUTBOX_STORAGE_KEY);
    if (raw) {
      outboxQueue = JSON.parse(raw);
    }
  } catch {
    outboxQueue = [];
  }

  // 2. Set initial online state
  if (Platform.OS === 'web' && typeof navigator !== 'undefined') {
    isOnline = navigator.onLine;

    window.addEventListener('online', () => {
      isOnline = true;
      notifyListeners();
      void flushOfflineQueue();
    });

    window.addEventListener('offline', () => {
      isOnline = false;
      notifyListeners();
    });
  }

  // 3. Listen with NetInfo
  NetInfo.addEventListener((state: NetInfoState) => {
    const reachable = state.isInternetReachable ?? state.isConnected ?? true;
    const wasOffline = !isOnline;
    isOnline = Boolean(reachable);

    notifyListeners();

    if (wasOffline && isOnline) {
      void flushOfflineQueue();
    }
  });

  notifyListeners();
}

/**
 * Check if the device is currently online.
 */
export function isDeviceOnline(): boolean {
  if (Platform.OS === 'web' && typeof navigator !== 'undefined') {
    return navigator.onLine && isOnline;
  }
  return isOnline;
}

/**
 * Subscribe to network and sync status updates.
 */
export function subscribeToNetworkStatus(
  callback: (status: NetworkStatus) => void,
): () => void {
  listeners.add(callback);
  callback({
    isOnline,
    pendingCount: outboxQueue.length,
    isSyncing,
  });

  return () => {
    listeners.delete(callback);
  };
}

/**
 * Save current outbox queue to persistent storage.
 */
async function persistQueue(): Promise<void> {
  try {
    await AsyncStorage.setItem(OUTBOX_STORAGE_KEY, JSON.stringify(outboxQueue));
  } catch {
    // Non-blocking error
  }
  notifyListeners();
}

/**
 * Enqueue a mutation for background sync when offline.
 */
export async function enqueueOfflineMutation(
  mutation: Omit<OutboxMutation, 'createdAt' | 'retries'>,
): Promise<void> {
  const entry: OutboxMutation = {
    ...mutation,
    createdAt: Date.now(),
    retries: 0,
  };

  outboxQueue.push(entry);
  await persistQueue();

  // If we happen to be online, attempt immediate flush
  if (isOnline && !isSyncing) {
    void flushOfflineQueue();
  }
}

/**
 * Flush all pending offline mutations in FIFO order.
 */
export async function flushOfflineQueue(): Promise<{ synced: number; failed: number }> {
  if (isSyncing || outboxQueue.length === 0 || !isOnline) {
    return { synced: 0, failed: 0 };
  }

  isSyncing = true;
  notifyListeners();

  let synced = 0;
  let failed = 0;
  const remaining: OutboxMutation[] = [];
  const affectedGroups = new Set<string>();

  for (const item of outboxQueue) {
    try {
      await apiRequest(item.endpoint, {
        method: item.method,
        body: item.body,
      });

      synced++;
      affectedGroups.add(item.groupId);
    } catch (error: any) {
      console.warn(`[OfflineQueue] Sync failed for ${item.type}:`, error?.message);
      item.retries += 1;

      // Keep if network error and under 5 retries
      if (item.retries < 5) {
        remaining.push(item);
      }
      failed++;
    }
  }

  outboxQueue = remaining;
  await persistQueue();

  isSyncing = false;
  notifyListeners();

  // Invalidate and broadcast for all synced groups
  affectedGroups.forEach((groupId) => {
    invalidateGroupOverview(groupId);
    void broadcastGroupMutation(groupId, 'general');
  });

  return { synced, failed };
}

