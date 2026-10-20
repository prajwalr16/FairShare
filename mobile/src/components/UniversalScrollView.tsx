import React, { forwardRef, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Platform,
  RefreshControl,
  ScrollView,
  ScrollViewProps,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export interface UniversalScrollViewProps extends ScrollViewProps {
  onRefresh?: () => void | Promise<void>;
  refreshing?: boolean;
  refreshTintColor?: string;
  refreshTitle?: string;
}

export const UniversalScrollView = forwardRef<ScrollView, UniversalScrollViewProps>(
  (
    {
      children,
      onRefresh,
      refreshing = false,
      refreshTintColor = '#0EA5A4',
      refreshTitle,
      style,
      contentContainerStyle,
      ...restProps
    },
    ref,
  ) => {
    if (Platform.OS !== 'web') {
      return (
        <ScrollView
          ref={ref}
          style={style}
          contentContainerStyle={contentContainerStyle}
          refreshControl={
            onRefresh ? (
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={refreshTintColor}
                colors={[refreshTintColor]}
                title={refreshTitle}
              />
            ) : undefined
          }
          {...restProps}
        >
          {children}
        </ScrollView>
      );
    }

    // Web Implementation: Interactive Pull-to-Refresh
    const [pullDistance, setPullDistance] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const startYRef = useRef(0);
    const scrollOffsetRef = useRef(0);
    const containerRef = useRef<any>(null);

    const pullAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
      Animated.spring(pullAnim, {
        toValue: refreshing ? 52 : pullDistance,
        useNativeDriver: false,
        friction: 8,
      }).start();
    }, [pullDistance, refreshing, pullAnim]);

    const handleTouchStart = (e: any) => {
      if (refreshing || !onRefresh) return;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      startYRef.current = clientY;
      setIsDragging(true);
    };

    const handleTouchMove = (e: any) => {
      if (!isDragging || refreshing || !onRefresh) return;
      if (scrollOffsetRef.current > 2) return;

      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      const delta = clientY - startYRef.current;
      if (delta > 0) {
        // Apply resistance curve
        const pull = Math.min(delta * 0.45, 90);
        setPullDistance(pull);
      } else {
        setPullDistance(0);
      }
    };

    const handleTouchEnd = () => {
      if (!isDragging) return;
      setIsDragging(false);
      if (pullDistance >= 55 && !refreshing && onRefresh) {
        void onRefresh();
      }
      setPullDistance(0);
    };

    const handleScroll = (e: any) => {
      scrollOffsetRef.current = e.nativeEvent?.contentOffset?.y ?? 0;
      restProps.onScroll?.(e);
    };

    return (
      <View
        ref={containerRef}
        style={[styles.webContainer, style as any]}
        // Web-specific DOM touch and pointer listeners:
        {...({
          onTouchStart: handleTouchStart,
          onTouchMove: handleTouchMove,
          onTouchEnd: handleTouchEnd,
          onTouchCancel: handleTouchEnd,
          onMouseDown: handleTouchStart,
          onMouseMove: handleTouchMove,
          onMouseUp: handleTouchEnd,
          onMouseLeave: handleTouchEnd,
        } as any)}
      >
        <Animated.View
          style={[
            styles.indicatorContainer,
            {
              height: pullAnim,
              opacity: pullAnim.interpolate({
                inputRange: [0, 20, 52],
                outputRange: [0, 0.4, 1],
                extrapolate: 'clamp',
              }),
            },
          ]}
        >
          <View style={styles.indicatorBadge}>
            {refreshing ? (
              <ActivityIndicator size="small" color={refreshTintColor} />
            ) : (
              <Ionicons
                name={pullDistance >= 55 ? 'arrow-up' : 'arrow-down'}
                size={18}
                color={refreshTintColor}
              />
            )}
            <Text style={[styles.indicatorText, { color: refreshTintColor }]}>
              {refreshing
                ? 'Refreshing…'
                : pullDistance >= 55
                ? 'Release to refresh'
                : 'Pull down to refresh'}
            </Text>
          </View>
        </Animated.View>

        <ScrollView
          ref={ref}
          style={styles.innerScrollView}
          contentContainerStyle={contentContainerStyle}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          {...restProps}
        >
          {children}
        </ScrollView>
      </View>
    );
  },
);

UniversalScrollView.displayName = 'UniversalScrollView';

const styles = StyleSheet.create({
  webContainer: {
    flex: 1,
    overflow: 'hidden',
    position: 'relative',
    ...(Platform.OS === 'web' ? { overscrollBehaviorY: 'contain' } : {}),
  } as any,
  innerScrollView: {
    flex: 1,
  },
  indicatorContainer: {
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  indicatorBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
  },
  indicatorText: {
    fontSize: 13,
    fontWeight: '600',
  },
});

export default UniversalScrollView;

