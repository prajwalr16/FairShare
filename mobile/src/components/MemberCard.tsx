import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type Member = {
  id?: string;
  user_id?: string | null;
  email?: string | null;
  role?: string | null;
  status?: string | null;
  full_name?: string | null;
  is_placeholder?: boolean;
  display_name?: string | null;
};

type Props = {
  member: Member;
  isOwner?: boolean;
  onRemove?: () => void;
};

export default function MemberCard({
  member,
  isOwner = false,
  onRemove,
}: Props) {
  const isPlaceholder = Boolean(member.is_placeholder);
  const name =
    member.display_name?.trim() || member.full_name?.trim() || '';

  const email =
    member.email?.trim() || 'Unknown email';

  const pending =
    member.status === 'pending';

  const displayName =
    name || (isOwner ? 'You' : email);

  const initials = displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('') || '?';

  return (
    <View style={styles.card}>
      <View style={[styles.avatar, isPlaceholder && styles.virtualAvatar]}>
        <Text style={[styles.avatarText, isPlaceholder && styles.virtualAvatarText]}>
          {initials}
        </Text>
      </View>

      <View style={styles.info}>
        <Text
          style={styles.name}
          numberOfLines={1}
        >
          {displayName}
        </Text>

        <View style={styles.metaRow}>
          <Text style={[styles.role, isPlaceholder && styles.virtualRole]}>
            {isOwner || member.role === 'owner'
              ? 'Owner'
              : isPlaceholder
                ? 'Virtual • Unclaimed'
                : pending
                  ? 'Pending invitation'
                  : member.role === 'admin'
                    ? 'Admin'
                    : member.role === 'viewer'
                      ? 'Viewer'
                      : 'Member'}
          </Text>

          {!isPlaceholder && pending && name ? (
            <Text
              style={styles.email}
              numberOfLines={1}
            >
              {email}
            </Text>
          ) : null}
        </View>
      </View>

      {isPlaceholder ? (
        <View style={styles.virtualBadge}>
          <Ionicons
            name="sparkles"
            size={12}
            color="#00E5FF"
            style={{ marginRight: 4 }}
          />
          <Text style={styles.virtualBadgeText}>Virtual</Text>
        </View>
      ) : pending ? (
        <View style={styles.pendingBadge}>
          <Ionicons
            name="mail-outline"
            size={15}
            color="#F59E0B"
          />
        </View>
      ) : !isOwner && onRemove ? (
        <Pressable
          style={styles.removeButton}
          onPress={onRemove}
        >
          <Ionicons
            name="trash-outline"
            size={17}
            color="#EF4444"
          />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },

  avatar: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },

  avatarText: {
    color: '#00E5FF',
    fontSize: 15,
    fontWeight: '800',
  },

  virtualAvatar: {
    backgroundColor: 'rgba(0, 229, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.3)',
  },

  virtualAvatarText: {
    color: '#00E5FF',
  },

  info: {
    flex: 1,
    minWidth: 0,
  },

  name: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },

  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },

  role: {
    color: '#64748B',
    fontSize: 12,
  },

  email: {
    flex: 1,
    color: '#475569',
    fontSize: 11,
    marginLeft: 7,
  },

  pendingBadge: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: 'rgba(245,158,11,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  virtualRole: {
    color: '#00E5FF',
    fontWeight: '600',
  },

  virtualBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 229, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.3)',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },

  virtualBadgeText: {
    color: '#00E5FF',
    fontSize: 11,
    fontWeight: '700',
  },

  removeButton: {
    paddingLeft: 12,
  },
});