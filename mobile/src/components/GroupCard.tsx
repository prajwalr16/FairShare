import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
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

export default function GroupCard({ group }: { group: any }) {
  const type = group?.type || 'Other';
  const accent = accentColors[type] || accentColors.Other;
  const icon = icons[type] || icons.Other;

  return (
    <View style={styles.card}>
      <View style={[styles.iconCircle, { backgroundColor: accent }]}>
        <Ionicons name={icon} size={24} color="#FFF" />
      </View>

      <View style={styles.content}>
        <Text style={styles.name} numberOfLines={1}>
          {group?.name || 'Untitled Group'}
        </Text>

        <Text style={styles.type}>{type}</Text>
      </View>

      <Ionicons
        name="chevron-forward"
        size={18}
        color="#64748B"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#1A2436',
    borderRadius: 22,
    padding: 18,
    marginBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#263247',
  },

  iconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
  },

  content: {
    flex: 1,
    marginLeft: 16,
  },

  name: {
    color: '#FFFFFF',
    fontSize: 19,
    fontWeight: '700',
  },

  type: {
    color: '#94A3B8',
    marginTop: 5,
    fontSize: 14,
    fontWeight: '500',
  },
});