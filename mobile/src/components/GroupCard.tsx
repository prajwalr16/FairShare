import React, { useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Theme } from '../theme/theme';
import { formatCurrency } from '../utils/currency';
import { GroupSummary } from '../services/groupService';

const categoryConfig: Record<string, { icon: keyof typeof Ionicons.glyphMap; color: string; bg: string }> = {
  Trip: { icon: 'airplane', color: '#00E5FF', bg: 'rgba(0, 229, 255, 0.15)' },
  Home: { icon: 'home', color: '#FFB800', bg: 'rgba(255, 184, 0, 0.15)' },
  Friends: { icon: 'people', color: '#A855F7', bg: 'rgba(168, 85, 247, 0.15)' },
  Office: { icon: 'briefcase', color: '#38BDF8', bg: 'rgba(56, 189, 248, 0.15)' },
  Other: { icon: 'grid', color: '#0EA5A4', bg: 'rgba(14, 165, 164, 0.15)' },
};

type Props = {
  group: GroupSummary;
  onPress?: () => void;
};

export default function GroupCard({ group, onPress }: Props) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const type = group?.type || 'Other';
  const config = categoryConfig[type] || categoryConfig.Other;
  const currency = group?.currency || 'INR';

  const netBalanceNum = Number(group?.user_net_balance ?? 0);
  const totalExpNum = Number(group?.total_expenses ?? 0);
  const memberCount = group?.member_count ?? 1;

  const isOwed = netBalanceNum > 0.005;
  const owes = netBalanceNum < -0.005;
  const isSettled = !isOwed && !owes;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.98,
      useNativeDriver: true,
      speed: 30,
      bounciness: 0,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      speed: 20,
      bounciness: 4,
    }).start();
  };

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={styles.card}
        android_ripple={{ color: 'rgba(255, 255, 255, 0.05)' }}
      >
        {/* Glow Accent Border Line on Top Edge */}
        <View
          style={[
            styles.accentGlowLine,
            {
              backgroundColor: isOwed
                ? Theme.colors.positive
                : owes
                ? Theme.colors.negative
                : config.color,
            },
          ]}
        />

        <View style={styles.mainRow}>
          {/* Glowing Squircle Category Icon */}
          <View style={[styles.iconContainer, { backgroundColor: config.bg, borderColor: config.color }]}>
            <Ionicons name={config.icon} size={22} color={config.color} />
          </View>

          {/* Group Details */}
          <View style={styles.infoCol}>
            <View style={styles.titleRow}>
              <Text style={styles.groupName} numberOfLines={1}>
                {group?.name || 'Untitled Group'}
              </Text>
            </View>

            <View style={styles.badgesRow}>
              <View style={styles.typeTag}>
                <Text style={styles.typeText}>{type}</Text>
              </View>

              <View style={styles.memberTag}>
                <Ionicons name="people-outline" size={10} color="#94A3B8" style={{ marginRight: 3 }} />
                <Text style={styles.memberText}>
                  {memberCount} {memberCount === 1 ? 'member' : 'members'}
                </Text>
              </View>
            </View>

            {totalExpNum > 0 && (
              <View style={styles.spendRow}>
                <Text style={styles.spendLabel}>
                  Total spend: <Text style={styles.spendValue}>{formatCurrency(totalExpNum, currency)}</Text>
                </Text>
              </View>
            )}
          </View>

          {/* Right Financial Status Capsule */}
          <View style={styles.statusCol}>
            {isOwed && (
              <View style={[styles.statusBadge, styles.statusOwed]}>
                <Text style={styles.statusOwedMicro}>YOU GET</Text>
                <Text style={styles.statusOwedAmount} numberOfLines={1}>
                  +{formatCurrency(netBalanceNum, currency)}
                </Text>
              </View>
            )}

            {owes && (
              <View style={[styles.statusBadge, styles.statusDebt]}>
                <Text style={styles.statusDebtMicro}>YOU OWE</Text>
                <Text style={styles.statusDebtAmount} numberOfLines={1}>
                  {formatCurrency(netBalanceNum, currency)}
                </Text>
              </View>
            )}

            {isSettled && (
              <View style={[styles.statusBadge, styles.statusSettled]}>
                <Text style={styles.statusSettledText}>SETTLED</Text>
              </View>
            )}

            <Ionicons
              name="chevron-forward"
              size={15}
              color="#475569"
              style={{ marginTop: 6, alignSelf: 'flex-end' }}
            />
          </View>
        </View>

        {group?.description?.trim() ? (
          <View style={styles.descriptionRow}>
            <Text style={styles.descriptionText} numberOfLines={1}>
              {group.description.trim()}
            </Text>
          </View>
        ) : null}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#0E1524',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    overflow: 'hidden',
    position: 'relative',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 4,
  },
  accentGlowLine: {
    position: 'absolute',
    top: 0,
    left: 20,
    right: 20,
    height: 1.5,
    opacity: 0.45,
  },
  mainRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  infoCol: {
    flex: 1,
    marginLeft: 14,
    marginRight: 10,
    justifyContent: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  groupName: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  badgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 6,
  },
  typeTag: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  typeText: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  memberTag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
  },
  memberText: {
    color: '#64748B',
    fontSize: 10,
    fontWeight: '600',
  },
  spendRow: {
    marginTop: 5,
  },
  spendLabel: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '500',
  },
  spendValue: {
    color: '#CBD5E1',
    fontWeight: '700',
  },
  statusCol: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    alignItems: 'flex-end',
    borderWidth: 1,
  },
  statusOwed: {
    backgroundColor: 'rgba(0, 245, 160, 0.10)',
    borderColor: 'rgba(0, 245, 160, 0.35)',
  },
  statusOwedMicro: {
    color: '#00F5A0',
    fontSize: 8.5,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  statusOwedAmount: {
    color: '#00F5A0',
    fontSize: 13,
    fontWeight: '900',
    marginTop: 1,
  },
  statusDebt: {
    backgroundColor: 'rgba(255, 75, 114, 0.10)',
    borderColor: 'rgba(255, 75, 114, 0.35)',
  },
  statusDebtMicro: {
    color: '#FF4B72',
    fontSize: 8.5,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  statusDebtAmount: {
    color: '#FF4B72',
    fontSize: 13,
    fontWeight: '900',
    marginTop: 1,
  },
  statusSettled: {
    backgroundColor: 'rgba(148, 163, 184, 0.08)',
    borderColor: 'rgba(148, 163, 184, 0.20)',
    paddingVertical: 6,
  },
  statusSettledText: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  descriptionRow: {
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
  },
  descriptionText: {
    color: '#64748B',
    fontSize: 11,
    lineHeight: 15,
  },
});
