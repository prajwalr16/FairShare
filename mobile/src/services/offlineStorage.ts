import AsyncStorage from '@react-native-async-storage/async-storage';

type CacheEnvelope<T> = {
  data: T;
  cachedAt: number;
};

// In-memory hot cache for instant synchronous access
const memoryCache = new Map<string, CacheEnvelope<any>>();

/**
 * Get item synchronously from in-memory cache if available.
 */
export function getInMemoryCache<T>(key: string, ttlMs = 300_000): T | null {
  const item = memoryCache.get(key);
  if (!item) return null;
  if (Date.now() - item.cachedAt > ttlMs) {
    memoryCache.delete(key);
    return null;
  }
  return item.data as T;
}

/**
 * Put item into in-memory hot cache.
 */
export function setInMemoryCache<T>(key: string, data: T): void {
  memoryCache.set(key, { data, cachedAt: Date.now() });
}

/**
 * Clear item from in-memory hot cache.
 */
export function removeInMemoryCache(key: string): void {
  memoryCache.delete(key);
}

/**
 * Get item from persistent storage (AsyncStorage) with optional TTL.
 */
export async function getPersistentCache<T>(key: string, ttlMs = 86_400_000): Promise<T | null> {
  // First check memory cache
  const inMemory = getInMemoryCache<T>(key, ttlMs);
  if (inMemory !== null) return inMemory;

  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return null;

    const envelope = JSON.parse(raw) as CacheEnvelope<T>;
    if (!envelope || typeof envelope !== 'object' || !('cachedAt' in envelope) || !('data' in envelope)) {
      return null;
    }

    if (Date.now() - envelope.cachedAt > ttlMs) {
      void AsyncStorage.removeItem(key).catch(() => undefined);
      return null;
    }

    // Hydrate memory cache for subsequent instant access
    memoryCache.set(key, envelope);
    return envelope.data;
  } catch {
    return null;
  }
}

/**
 * Set item to persistent storage (AsyncStorage) and in-memory cache.
 */
export async function setPersistentCache<T>(key: string, data: T): Promise<void> {
  const envelope: CacheEnvelope<T> = { data, cachedAt: Date.now() };
  memoryCache.set(key, envelope);

  try {
    await AsyncStorage.setItem(key, JSON.stringify(envelope));
  } catch {
    // Persistent cache is a non-blocking progressive enhancement.
  }
}

/**
 * Remove item from both persistent and memory cache.
 */
export async function removePersistentCache(key: string): Promise<void> {
  memoryCache.delete(key);
  try {
    await AsyncStorage.removeItem(key);
  } catch {
    // Ignore error
  }
}

/**
 * Standard Cache Key Builders
 */
export const CacheKeys = {
  groupOverview: (groupId: string) => `fairshare:cache:group_overview:${groupId}`,
  groupExpenses: (groupId: string) => `fairshare:cache:group_expenses:${groupId}`,
  groupHistory: (groupId: string) => `fairshare:cache:group_history:${groupId}`,
  groupMembers: (groupId: string) => `fairshare:cache:group_members:${groupId}`,
  groupFinancial: (groupId: string) => `fairshare:cache:group_financial:${groupId}`,
  userGroups: (userId: string) => `fairshare:groups:v2:${userId}`,
  trip: (groupId: string) => `fairshare:cache:trip:${groupId}`,
  tripRoute: (groupId: string, dayNumber?: number | null) =>
    `fairshare:cache:trip_route:${groupId}:${dayNumber ?? 'all'}`,
};

