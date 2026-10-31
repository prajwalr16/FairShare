import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../config/supabase';

export type RealtimeMutationType = 'expense' | 'settlement' | 'member' | 'settings' | 'general';

export type RealtimeGroupEvent = {
  groupId: string;
  type: RealtimeMutationType;
  table?: string;
  eventType?: 'INSERT' | 'UPDATE' | 'DELETE' | 'BROADCAST';
  timestamp: number;
};

type GroupSubscription = {
  channel: RealtimeChannel;
  listeners: Set<(event: RealtimeGroupEvent) => void>;
  debounceTimer: any | null;
};

const activeSubscriptions = new Map<string, GroupSubscription>();

/**
 * Broadcast a client-side mutation event on the group's channel.
 * This provides 0-millisecond peer notifications alongside database CDC.
 */
export async function broadcastGroupMutation(
  groupId: string,
  type: RealtimeMutationType,
): Promise<void> {
  const sub = activeSubscriptions.get(groupId);
  if (!sub) return;

  try {
    await sub.channel.send({
      type: 'broadcast',
      event: 'group_mutated',
      payload: {
        groupId,
        type,
        timestamp: Date.now(),
      },
    });
  } catch {
    // Broadcast is best-effort alongside database changes.
  }
}

/**
 * Subscribe to all real-time changes (expenses, settlements, members, settings)
 * for a specific group. Returns an unsubscribe cleanup function.
 */
export function subscribeToGroupRealtime(
  groupId: string,
  onUpdate: (event: RealtimeGroupEvent) => void,
): () => void {
  if (!groupId) return () => undefined;

  let sub = activeSubscriptions.get(groupId);

  if (!sub) {
    const channelName = `group-realtime:${groupId}`;
    const listeners = new Set<(event: RealtimeGroupEvent) => void>();

    const dispatchDebounced = (event: RealtimeGroupEvent) => {
      if (sub?.debounceTimer) clearTimeout(sub.debounceTimer);
      sub!.debounceTimer = setTimeout(() => {
        listeners.forEach((listener) => {
          try {
            listener(event);
          } catch (err) {
            console.warn('[Realtime] Listener error:', err);
          }
        });
        sub!.debounceTimer = null;
      }, 300);
    };

    const channel = supabase
      .channel(channelName)
      // 1. Listen for PostgreSQL changes on expenses
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'expenses',
          filter: `group_id=eq.${groupId}`,
        },
        (payload) => {
          dispatchDebounced({
            groupId,
            type: 'expense',
            table: 'expenses',
            eventType: payload.eventType as any,
            timestamp: Date.now(),
          });
        },
      )
      // 2. Listen for PostgreSQL changes on settlements
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'settlements',
          filter: `group_id=eq.${groupId}`,
        },
        (payload) => {
          dispatchDebounced({
            groupId,
            type: 'settlement',
            table: 'settlements',
            eventType: payload.eventType as any,
            timestamp: Date.now(),
          });
        },
      )
      // 3. Listen for PostgreSQL changes on group members
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'group_members',
          filter: `group_id=eq.${groupId}`,
        },
        (payload) => {
          dispatchDebounced({
            groupId,
            type: 'member',
            table: 'group_members',
            eventType: payload.eventType as any,
            timestamp: Date.now(),
          });
        },
      )
      // 4. Listen for fast broadcast events from fellow peers
      .on('broadcast', { event: 'group_mutated' }, ({ payload }) => {
        if (payload?.groupId === groupId) {
          dispatchDebounced({
            groupId,
            type: payload.type || 'general',
            eventType: 'BROADCAST',
            timestamp: payload.timestamp || Date.now(),
          });
        }
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          // Connected cleanly
        }
      });

    sub = { channel, listeners, debounceTimer: null };
    activeSubscriptions.set(groupId, sub);
  }

  sub.listeners.add(onUpdate);

  // Return unsubscribe cleanup function
  return () => {
    const existing = activeSubscriptions.get(groupId);
    if (!existing) return;

    existing.listeners.delete(onUpdate);

    if (existing.listeners.size === 0) {
      if (existing.debounceTimer) clearTimeout(existing.debounceTimer);
      void supabase.removeChannel(existing.channel);
      activeSubscriptions.delete(groupId);
    }
  };
}

