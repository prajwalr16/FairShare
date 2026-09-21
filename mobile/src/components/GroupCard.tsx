import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const accentColors: Record<string, string> = {
  Trip: '#0EA5A4',
  Home: '#F59E0B',
  Friends: '#3B82F6',
  Office: '#64748B',
  Other: '#8B5CF6',
};

const icons: Record<string, keyof typeof Ionicons.glyphMap> = {
  Trip: 'airplane',
  Home: 'home',
  Friends: 'people',
  Office: 'briefcase',
  Other: 'grid',
};

type Props = {
  group: {
    name?: string;
    type?: string;
    currency?: string;
    description?: string | null;
  };
  onPress?: () => void;
};

export default function GroupCard({ group, onPress }: Props) {
  const type = group?.type || 'Other';
  const accent = accentColors[type] || accentColors.Other;
  const icon = icons[type] || icons.Other;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      android_ripple={{ color: '#263247' }}
    >
      <View style={[styles.iconCircle, { backgroundColor: accent }]}>
        <Ionicons name={icon} size={23} color="#FFFFFF" />
      </View>

      <View style={styles.content}>
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1}>
            {group?.name || 'Untitled Group'}
          </Text>
          <View style={styles.currencyBadge}>
            <Text style={styles.currencyText}>{group?.currency || 'INR'}</Text>
          </View>
        </View>

        <Text style={styles.type}>{type}</Text>

        {!!group?.description?.trim() && (
          <Text style={styles.description} numberOfLines={1}>
            {group.description.trim()}
          </Text>
        )}
      </View>

      <Ionicons name="chevron-forward" size={18} color="#64748B" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: 92,
    backgroundColor: '#1A2436',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 11,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#263247',
  },
  pressed: {
    opacity: 0.82,
    transform: [{ scale: 0.995 }],
  },
  iconCircle: {
    width: 52,
    height: 52,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    minWidth: 0,
    marginLeft: 14,
    marginRight: 10,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 0,
  },
  name: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
  },
  currencyBadge: {
    marginLeft: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#334155',
  },
  currencyText: {
    color: '#94A3B8',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  type: {
    color: '#94A3B8',
    marginTop: 4,
    fontSize: 12,
    fontWeight: '700',
  },
  description: {
    color: '#64748B',
    marginTop: 4,
    fontSize: 11,
  },
});
