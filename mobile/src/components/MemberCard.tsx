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
  const name =
    member.full_name?.trim() || '';

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
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>
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
          <Text style={styles.role}>
            {isOwner || member.role === 'owner'
              ? 'Owner'
              : pending
                ? 'Pending invitation'
                : 'Member'}
          </Text>

          {pending && name ? (
            <Text
              style={styles.email}
              numberOfLines={1}
            >
              {email}
            </Text>
          ) : null}
        </View>
      </View>

      {pending ? (
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
          hitSlop={8}
        >
          <Ionicons
            name="close-circle-outline"
            size={22}
            color="#64748B"
          />
        </Pressable>
      ) : (
        <Ionicons
          name="checkmark-circle"
          size={21}
          color="#0EA5A4"
        />
      )}
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
    color: '#0EA5A4',
    fontSize: 15,
    fontWeight: '800',
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

  removeButton: {
    paddingLeft: 12,
  },
});
