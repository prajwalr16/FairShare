import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

type Props = {
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
  showTagline?: boolean;
};

export default function BrandLogo({ size = 'md', showText = true, showTagline = false }: Props) {
  const isSm = size === 'sm';
  const isLg = size === 'lg';

  const badgeSize = isSm ? 34 : isLg ? 72 : 48;
  const fontSize = isSm ? 15 : isLg ? 32 : 21;
  const borderRadius = isSm ? 10 : isLg ? 22 : 15;

  return (
    <View style={styles.container}>
      {/* Enhanced FS Emblem Squircle */}
      <View
        style={[
          styles.badge,
          {
            width: badgeSize,
            height: badgeSize,
            borderRadius,
          },
        ]}
      >
        <Text style={[styles.fsText, { fontSize }]}>FS</Text>
      </View>

      {showText && (
        <View style={styles.textWrap}>
          <Text style={[styles.title, isLg && styles.titleLg, isSm && styles.titleSm]}>
            FairShare
          </Text>
          {showTagline && (
            <Text style={styles.tagline}>
              Split expenses. Share memories.
            </Text>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  badge: {
    backgroundColor: 'rgba(0, 229, 255, 0.12)',
    borderWidth: 1.5,
    borderColor: 'rgba(0, 229, 255, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#00E5FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  fsText: {
    color: '#00E5FF',
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  textWrap: {
    marginLeft: 10,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  titleSm: {
    fontSize: 14,
    fontWeight: '800',
  },
  titleLg: {
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: -0.5,
    marginTop: 12,
    textAlign: 'center',
  },
  tagline: {
    color: '#94A3B8',
    fontSize: 13,
    marginTop: 6,
    textAlign: 'center',
  },
});
