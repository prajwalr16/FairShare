import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import UniversalWebView, { UniversalWebViewRef, WebViewMessageEvent } from './UniversalWebView';

import { PlaceSearchResult, searchPlaces } from '../services/placeService';

export type TripLocationSelection = {
  latitude: number;
  longitude: number;
  name: string;
  address: string | null;
  placeId: string | null;
  source: 'search' | 'map';
};

type TripLocationPickerModalProps = {
  visible: boolean;
  title?: string;
  initialLatitude?: number | null;
  initialLongitude?: number | null;
  initialName?: string;
  initialAddress?: string | null;
  onClose: () => void;
  onConfirm: (selection: TripLocationSelection) => void;
};

type MapMessage = {
  type?: string;
  latitude?: number;
  longitude?: number;
};

type CategoryFilter = 'all' | 'attraction' | 'lodging' | 'food' | 'transit';

const RECENT_PLACES_STORAGE_KEY = '@fairshare_recent_places_v2';
const DEFAULT_CENTER = { latitude: 20.5937, longitude: 78.9629 };

const CATEGORY_CHIPS: Array<{ id: CategoryFilter; label: string; icon: keyof typeof Ionicons.glyphMap }> = [
  { id: 'all', label: 'All', icon: 'sparkles-outline' },
  { id: 'attraction', label: 'Attractions', icon: 'compass-outline' },
  { id: 'lodging', label: 'Stays', icon: 'bed-outline' },
  { id: 'food', label: 'Food', icon: 'restaurant-outline' },
  { id: 'transit', label: 'Transit', icon: 'airplane-outline' },
];

const POPULAR_DESTINATIONS = [
  'Goa',
  'Manali',
  'Ladakh',
  'Ooty',
  'Bengaluru',
  'Rameshwaram',
  'Jaipur',
  'Kodaikanal',
  'Munnar',
];

function escapeForScript(value: unknown) {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

function buildPickerMapHtml(
  initialLatitude: number | null,
  initialLongitude: number | null,
) {
  const hasInitial =
    Number.isFinite(initialLatitude) && Number.isFinite(initialLongitude);
  const center = hasInitial
    ? [initialLongitude, initialLatitude]
    : [DEFAULT_CENTER.longitude, DEFAULT_CENTER.latitude];
  const initial = escapeForScript({
    latitude: hasInitial ? initialLatitude : null,
    longitude: hasInitial ? initialLongitude : null,
  });

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<link rel="preconnect" href="https://cdn.jsdelivr.net" crossorigin>
<link rel="preconnect" href="https://tiles.openfreemap.org" crossorigin>
<link rel="dns-prefetch" href="https://tiles.openfreemap.org">
<link rel="dns-prefetch" href="https://cdn.jsdelivr.net">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/maplibre-gl@6.10.0/dist/maplibre-gl.css">
<style>
html,body,#map{height:100%;width:100%;margin:0;background:#090E17;}
.maplibregl-ctrl-group{border-radius:12px;overflow:hidden;background:#0F172A!important;border:1px solid #263247!important;}
.maplibregl-ctrl button{background-color:#0F172A!important;color:#FFFFFF!important;}
.pick-marker{
  width:22px;
  height:22px;
  border-radius:50%;
  background:#00E5FF;
  border:3px solid #FFFFFF;
  box-shadow:0 0 0 6px rgba(0,229,255,0.3), 0 4px 12px rgba(0,0,0,0.5);
  animation:radarPulse 2s infinite ease-out;
  cursor:pointer;
}
@keyframes radarPulse {
  0% { box-shadow: 0 0 0 0 rgba(0,229,255,0.65), 0 4px 12px rgba(0,0,0,0.5); }
  70% { box-shadow: 0 0 0 16px rgba(0,229,255,0), 0 4px 12px rgba(0,0,0,0.5); }
  100% { box-shadow: 0 0 0 0 rgba(0,229,255,0), 0 4px 12px rgba(0,0,0,0.5); }
}
</style>
</head>
<body>
<div id="map"></div>
<script type="module">
import * as maplibregl from 'https://cdn.jsdelivr.net/npm/maplibre-gl@6.10.0/dist/maplibre-gl.mjs';
const initial = ${initial};
const map = new maplibregl.Map({
  container:'map',
  style:'https://tiles.openfreemap.org/styles/liberty',
  center:${JSON.stringify(center)},
  zoom:${hasInitial ? 14 : 4.5},
  attributionControl:false,
});
map.addControl(new maplibregl.NavigationControl({showCompass:false}), 'top-right');
map.addControl(new maplibregl.AttributionControl({compact:true}), 'bottom-right');

let marker = null;
function setMarker(lng, lat, moveCamera) {
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return;
  if (!marker) {
    const element = document.createElement('div');
    element.className = 'pick-marker';
    marker = new maplibregl.Marker({element, anchor:'center'}).setLngLat([lng,lat]).addTo(map);
  } else {
    marker.setLngLat([lng,lat]);
  }
  if (moveCamera) {
    map.easeTo({center:[lng,lat],zoom:Math.max(map.getZoom(),14),duration:400});
  }
}

map.on('load', () => {
  if (initial.latitude != null && initial.longitude != null) {
    setMarker(initial.longitude, initial.latitude, false);
  }
});

map.on('click', (event) => {
  const latitude = Number(event.lngLat.lat.toFixed(6));
  const longitude = Number(event.lngLat.lng.toFixed(6));
  setMarker(longitude, latitude, false);
  const msg = JSON.stringify({type:'mapPress',latitude,longitude});
  if (window.ReactNativeWebView) {
    window.ReactNativeWebView.postMessage(msg);
  } else if (window.parent) {
    window.parent.postMessage(msg, '*');
  }
});

window.addEventListener('message', (event) => {
  try {
    const message = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
    if (message.type === 'setLocation') {
      const latitude = Number(message.latitude);
      const longitude = Number(message.longitude);
      setMarker(longitude, latitude, true);
    }
  } catch (_) {}
});

document.addEventListener('message', (event) => {
  try {
    const message = JSON.parse(event.data || '{}');
    if (message.type === 'setLocation') {
      const latitude = Number(message.latitude);
      const longitude = Number(message.longitude);
      setMarker(longitude, latitude, true);
    }
  } catch (_) {}
});
</script>
</body>
</html>`;
}

function formatCoordinate(value: number | null) {
  return value == null ? '—' : value.toFixed(6);
}

function getCategoryIcon(iconType?: string | null): { name: keyof typeof Ionicons.glyphMap; color: string; bg: string } {
  switch (iconType) {
    case 'lodging':
      return { name: 'bed-outline', color: '#A5B4FC', bg: '#1E1B4B' };
    case 'food':
      return { name: 'restaurant-outline', color: '#FCD34D', bg: '#451A03' };
    case 'transit':
      return { name: 'airplane-outline', color: '#00E5FF', bg: '#083344' };
    case 'attraction':
      return { name: 'compass-outline', color: '#34D399', bg: '#064E3B' };
    case 'city':
      return { name: 'business-outline', color: '#38BDF8', bg: '#082F49' };
    default:
      return { name: 'location-outline', color: '#00E5FF', bg: '#0F273D' };
  }
}

export default function TripLocationPickerModal({
  visible,
  title = 'Choose location',
  initialLatitude = null,
  initialLongitude = null,
  initialName = '',
  initialAddress = null,
  onClose,
  onConfirm,
}: TripLocationPickerModalProps) {
  const webViewRef = useRef<UniversalWebViewRef>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [latitude, setLatitude] = useState<number | null>(initialLatitude);
  const [longitude, setLongitude] = useState<number | null>(initialLongitude);
  const [selectionName, setSelectionName] = useState(initialName);
  const [selectionAddress, setSelectionAddress] = useState<string | null>(initialAddress);
  const [selectionSource, setSelectionSource] = useState<'search' | 'map'>('map');
  const [placeId, setPlaceId] = useState<string | null>(null);

  const [query, setQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<CategoryFilter>('all');
  const [results, setResults] = useState<PlaceSearchResult[]>([]);
  const [didYouMean, setDidYouMean] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [recentPlaces, setRecentPlaces] = useState<PlaceSearchResult[]>([]);

  // Load recent places on mount/open
  useEffect(() => {
    if (!visible) return;
    setLatitude(initialLatitude ?? null);
    setLongitude(initialLongitude ?? null);
    setSelectionName(initialName || '');
    setSelectionAddress(initialAddress || null);
    setSelectionSource('map');
    setPlaceId(null);
    setQuery('');
    setResults([]);
    setDidYouMean(null);
    setSelectedCategory('all');

    void AsyncStorage.getItem(RECENT_PLACES_STORAGE_KEY)
      .then((data) => {
        if (data) {
          const parsed = JSON.parse(data) as PlaceSearchResult[];
          if (Array.isArray(parsed)) {
            setRecentPlaces(parsed.slice(0, 5));
          }
        }
      })
      .catch(() => {});
  }, [initialAddress, initialLatitude, initialLongitude, initialName, visible]);

  const mapHtml = useMemo(
    () => buildPickerMapHtml(initialLatitude ?? null, initialLongitude ?? null),
    [initialLatitude, initialLongitude],
  );

  const syncMap = useCallback((nextLatitude: number, nextLongitude: number) => {
    const message = JSON.stringify({
      type: 'setLocation',
      latitude: nextLatitude,
      longitude: nextLongitude,
    });
    webViewRef.current?.postMessage(message);
  }, []);

  const saveToRecent = useCallback(async (place: PlaceSearchResult) => {
    try {
      const updated = [
        place,
        ...recentPlaces.filter((item) => item.place_id !== place.place_id),
      ].slice(0, 5);
      setRecentPlaces(updated);
      await AsyncStorage.setItem(RECENT_PLACES_STORAGE_KEY, JSON.stringify(updated));
    } catch {
      // Best-effort storage
    }
  }, [recentPlaces]);

  const clearRecent = async () => {
    try {
      setRecentPlaces([]);
      await AsyncStorage.removeItem(RECENT_PLACES_STORAGE_KEY);
    } catch {
      // Best-effort storage
    }
  };

  const executeSearch = useCallback(async (textToSearch: string) => {
    const normalized = textToSearch.trim();
    if (normalized.length < 2) {
      setResults([]);
      setDidYouMean(null);
      setSearching(false);
      return;
    }

    setSearching(true);
    const result = await searchPlaces(normalized);
    setSearching(false);

    if (result.error || !result.data) {
      setResults([]);
      setDidYouMean(null);
      return;
    }

    setResults(result.data.results || []);
    setDidYouMean(result.data.did_you_mean || null);
  }, []);

  // Debounced live search
  const handleQueryChange = (text: string) => {
    setQuery(text);
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    if (!text.trim()) {
      setResults([]);
      setDidYouMean(null);
      return;
    }
    debounceTimerRef.current = setTimeout(() => {
      void executeSearch(text);
    }, 320);
  };

  const handleClearQuery = () => {
    setQuery('');
    setResults([]);
    setDidYouMean(null);
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
  };

  const chooseMapPoint = (nextLatitude: number, nextLongitude: number) => {
    setLatitude(nextLatitude);
    setLongitude(nextLongitude);
    setSelectionSource('map');
    setPlaceId(null);
    syncMap(nextLatitude, nextLongitude);
  };

  const selectPlace = (place: PlaceSearchResult) => {
    const nextLatitude = place.latitude;
    const nextLongitude = place.longitude;
    setLatitude(nextLatitude);
    setLongitude(nextLongitude);
    setSelectionName(place.name || place.display_name);
    setSelectionAddress(place.subtitle || place.address || place.display_name);
    setSelectionSource('search');
    setPlaceId(place.place_id);
    setResults([]);
    setDidYouMean(null);
    void saveToRecent(place);
    syncMap(nextLatitude, nextLongitude);
  };

  const handleMapMessage = (event: WebViewMessageEvent) => {
    try {
      const message = JSON.parse(event.nativeEvent.data) as MapMessage;
      if (
        message.type === 'mapPress' &&
        Number.isFinite(message.latitude) &&
        Number.isFinite(message.longitude)
      ) {
        chooseMapPoint(Number(message.latitude), Number(message.longitude));
      }
    } catch {
      // Ignore malformed messages
    }
  };

  const handleConfirm = () => {
    if (latitude == null || longitude == null) return;
    onConfirm({
      latitude,
      longitude,
      name: selectionName.trim() || 'Selected location',
      address: selectionAddress?.trim() || null,
      placeId,
      source: selectionSource,
    });
  };

  // Filter results by category if selected
  const filteredResults = useMemo(() => {
    if (selectedCategory === 'all') return results;
    return results.filter((p) => p.icon_type === selectedCategory);
  }, [results, selectedCategory]);

  const hasSelection = latitude != null && longitude != null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <KeyboardAvoidingView
          style={styles.keyboard}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.card}>
            {/* Modal Header */}
            <View style={styles.header}>
              <View style={styles.headerText}>
                <View style={styles.headerEyebrowRow}>
                  <Ionicons name="location" size={13} color="#00E5FF" />
                  <Text style={styles.headerEyebrow}>INTERACTIVE MAP EXPLORER</Text>
                </View>
                <Text style={styles.title}>{title}</Text>
                <Text style={styles.subtitle}>
                  Fuzzy & semantic live search with auto-suggest, or tap anywhere on the map to set the exact point.
                </Text>
              </View>
              <Pressable style={styles.closeButton} onPress={onClose} hitSlop={8}>
                <Ionicons name="close" size={21} color="#CBD5E1" />
              </Pressable>
            </View>

            {/* Live Search Bar */}
            <View style={styles.searchRow}>
              <View style={styles.searchFieldWrap}>
                <Ionicons name="search-outline" size={18} color="#00E5FF" />
                <TextInput
                  value={query}
                  onChangeText={handleQueryChange}
                  placeholder="Search Pangong, Manali, Bengaluru, Hotel..."
                  placeholderTextColor="#64748B"
                  style={styles.searchInput}
                  returnKeyType="search"
                  onSubmitEditing={() => void executeSearch(query)}
                  autoCorrect={false}
                />
                {searching ? (
                  <ActivityIndicator size="small" color="#00E5FF" style={styles.inputSpinner} />
                ) : query ? (
                  <Pressable style={styles.clearIcon} onPress={handleClearQuery} hitSlop={6}>
                    <Ionicons name="close-circle" size={18} color="#94A3B8" />
                  </Pressable>
                ) : null}
              </View>
            </View>

            {/* Category Filter Chips */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.categoryChipsScroll}
            >
              {CATEGORY_CHIPS.map((chip) => {
                const active = selectedCategory === chip.id;
                return (
                  <Pressable
                    key={chip.id}
                    style={[styles.categoryChip, active && styles.categoryChipActive]}
                    onPress={() => setSelectedCategory(chip.id)}
                  >
                    <Ionicons
                      name={chip.icon}
                      size={13}
                      color={active ? '#06090F' : '#94A3B8'}
                    />
                    <Text style={[styles.categoryChipText, active && styles.categoryChipTextActive]}>
                      {chip.label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            {/* "Did you mean" Spelling / Fuzzy Suggestion Banner */}
            {!!didYouMean && (
              <Pressable
                style={styles.didYouMeanBanner}
                onPress={() => {
                  setQuery(didYouMean);
                  void executeSearch(didYouMean);
                }}
              >
                <Ionicons name="sparkles" size={15} color="#00E5FF" />
                <Text style={styles.didYouMeanText}>
                  Showing results for{' '}
                  <Text style={styles.didYouMeanHighlight}>{didYouMean}</Text>
                  {' '}(Typo corrected)
                </Text>
              </Pressable>
            )}

            {/* Live Search Results Overlay */}
            {!!filteredResults.length && (
              <View style={styles.resultsCard}>
                <ScrollView
                  style={styles.resultsScroll}
                  keyboardShouldPersistTaps="handled"
                  nestedScrollEnabled
                >
                  {filteredResults.map((place) => {
                    const iconConfig = getCategoryIcon(place.icon_type);
                    return (
                      <Pressable
                        key={place.place_id}
                        style={styles.resultRow}
                        onPress={() => selectPlace(place)}
                      >
                        <View style={[styles.resultIcon, { backgroundColor: iconConfig.bg }]}>
                          <Ionicons name={iconConfig.name} size={17} color={iconConfig.color} />
                        </View>
                        <View style={styles.resultText}>
                          <View style={styles.resultTitleRow}>
                            <Text style={styles.resultName} numberOfLines={1}>
                              {place.name}
                            </Text>
                            {place.match_type === 'fuzzy_corrected' ? (
                              <View style={styles.fuzzyBadge}>
                                <Text style={styles.fuzzyBadgeText}>TYPO MATCH</Text>
                              </View>
                            ) : null}
                          </View>
                          <Text style={styles.resultAddress} numberOfLines={1}>
                            {place.subtitle || place.display_name}
                          </Text>
                        </View>
                        <Ionicons name="chevron-forward" size={16} color="#475569" />
                      </Pressable>
                    );
                  })}
                  <Text style={styles.attribution}>Search data © OpenStreetMap contributors</Text>
                </ScrollView>
              </View>
            )}

            {/* Popular & Recent Suggestions when Query is Empty */}
            {!query && !results.length && (
              <View style={styles.suggestionsContainer}>
                {recentPlaces.length > 0 ? (
                  <View style={styles.recentSection}>
                    <View style={styles.recentSectionHeader}>
                      <View style={styles.recentTitleRow}>
                        <Ionicons name="time-outline" size={13} color="#94A3B8" />
                        <Text style={styles.recentSectionTitle}>RECENT PLACES</Text>
                      </View>
                      <Pressable onPress={clearRecent} hitSlop={6}>
                        <Text style={styles.recentClearText}>Clear</Text>
                      </Pressable>
                    </View>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.recentChipsScroll}>
                      {recentPlaces.map((recent) => (
                        <Pressable
                          key={recent.place_id}
                          style={styles.recentChip}
                          onPress={() => selectPlace(recent)}
                        >
                          <Ionicons name="location-outline" size={13} color="#00E5FF" />
                          <Text style={styles.recentChipText} numberOfLines={1}>
                            {recent.name}
                          </Text>
                        </Pressable>
                      ))}
                    </ScrollView>
                  </View>
                ) : (
                  <View style={styles.popularSection}>
                    <Text style={styles.popularSectionTitle}>POPULAR DESTINATIONS</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.popularChipsScroll}>
                      {POPULAR_DESTINATIONS.map((dest) => (
                        <Pressable
                          key={dest}
                          style={styles.popularChip}
                          onPress={() => {
                            setQuery(dest);
                            void executeSearch(dest);
                          }}
                        >
                          <Text style={styles.popularChipText}>{dest}</Text>
                        </Pressable>
                      ))}
                    </ScrollView>
                  </View>
                )}
              </View>
            )}

            {/* Interactive Vector Map Card */}
            <View style={styles.mapCard}>
              <UniversalWebView
                ref={webViewRef}
                source={{ html: mapHtml }}
                originWhitelist={['*']}
                javaScriptEnabled
                domStorageEnabled
                cacheEnabled
                onMessage={handleMapMessage}
                style={styles.map}
              />
              <View style={styles.mapHint} pointerEvents="none">
                <Ionicons name="finger-print-outline" size={14} color="#00E5FF" />
                <Text style={styles.mapHintText}>Tap map to move pin</Text>
              </View>
            </View>

            {/* Floating Selection & Action Deck */}
            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.body}
            >
              <View style={styles.selectionCard}>
                <View style={styles.selectionHeader}>
                  <View style={styles.selectionIcon}>
                    <Ionicons name="location" size={18} color="#06090F" />
                  </View>
                  <View style={styles.selectionHeaderText}>
                    <Text style={styles.selectionTitle} numberOfLines={1}>
                      {selectionName.trim() || 'Tap map or search to choose'}
                    </Text>
                    <Text style={styles.selectionMeta} numberOfLines={1}>
                      {selectionAddress || (selectionSource === 'search' ? 'Search result selected' : 'Exact point pinned on map')}
                    </Text>
                  </View>
                  {hasSelection && (
                    <View style={styles.sourceBadge}>
                      <Text style={styles.sourceBadgeText}>{selectionSource === 'search' ? 'SEARCH' : 'PINNED'}</Text>
                    </View>
                  )}
                </View>

                <View style={styles.coordinateRow}>
                  <View style={styles.coordinateBox}>
                    <Text style={styles.coordinateLabel}>LATITUDE</Text>
                    <Text style={styles.coordinateValue}>{formatCoordinate(latitude)}</Text>
                  </View>
                  <View style={styles.coordinateBox}>
                    <Text style={styles.coordinateLabel}>LONGITUDE</Text>
                    <Text style={styles.coordinateValue}>{formatCoordinate(longitude)}</Text>
                  </View>
                </View>
              </View>

              <View style={styles.actions}>
                <Pressable style={styles.cancelButton} onPress={onClose}>
                  <Text style={styles.cancelText}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={[styles.confirmButton, !hasSelection && styles.disabled]}
                  onPress={handleConfirm}
                  disabled={!hasSelection}
                >
                  <Ionicons name="checkmark-circle-outline" size={18} color="#06090F" />
                  <Text style={styles.confirmText}>Use this location</Text>
                </Pressable>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 23, 0.88)',
    justifyContent: 'flex-end',
  },
  keyboard: { width: '100%', maxHeight: '96%' },
  card: {
    width: '100%',
    maxHeight: '96%',
    backgroundColor: '#0E1524',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 1,
    borderColor: '#1E293B',
    paddingTop: 18,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 18,
    paddingBottom: 12,
  },
  headerText: { flex: 1, paddingRight: 12 },
  headerEyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 4,
  },
  headerEyebrow: {
    color: '#00E5FF',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1.1,
  },
  title: { color: '#FFFFFF', fontSize: 20, fontWeight: '900' },
  subtitle: { color: '#94A3B8', fontSize: 11, lineHeight: 16, marginTop: 4 },
  closeButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#131C2E',
    borderWidth: 1,
    borderColor: '#263247',
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchRow: {
    flexDirection: 'row',
    paddingHorizontal: 18,
    paddingBottom: 8,
  },
  searchFieldWrap: {
    flex: 1,
    minHeight: 46,
    paddingHorizontal: 13,
    borderRadius: 14,
    backgroundColor: '#131C2E',
    borderWidth: 1,
    borderColor: '#2A3A50',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchInput: { flex: 1, color: '#FFFFFF', fontSize: 13, paddingVertical: 0 },
  inputSpinner: { marginRight: 4 },
  clearIcon: { padding: 4 },
  categoryChipsScroll: {
    paddingHorizontal: 18,
    gap: 7,
    paddingBottom: 8,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#131C2E',
    borderWidth: 1,
    borderColor: '#263247',
  },
  categoryChipActive: {
    backgroundColor: '#00E5FF',
    borderColor: '#00E5FF',
  },
  categoryChipText: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '700',
  },
  categoryChipTextActive: {
    color: '#06090F',
    fontWeight: '900',
  },
  didYouMeanBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginHorizontal: 18,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 11,
    backgroundColor: 'rgba(0, 229, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(0, 229, 255, 0.28)',
  },
  didYouMeanText: {
    color: '#94A3B8',
    fontSize: 11,
  },
  didYouMeanHighlight: {
    color: '#00E5FF',
    fontWeight: '900',
  },
  resultsCard: {
    marginHorizontal: 18,
    marginBottom: 8,
    maxHeight: 180,
    backgroundColor: '#131C2E',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#263247',
    overflow: 'hidden',
  },
  resultsScroll: {
    maxHeight: 180,
  },
  resultRow: {
    minHeight: 52,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
    gap: 9,
  },
  resultIcon: {
    width: 32,
    height: 32,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultText: { flex: 1, minWidth: 0 },
  resultTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  resultName: { color: '#FFFFFF', fontSize: 13, fontWeight: '800', flexShrink: 1 },
  fuzzyBadge: {
    backgroundColor: 'rgba(0, 229, 255, 0.15)',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  fuzzyBadgeText: {
    color: '#00E5FF',
    fontSize: 7,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  resultAddress: { color: '#94A3B8', fontSize: 10, marginTop: 2 },
  attribution: { color: '#475569', fontSize: 8, paddingHorizontal: 12, paddingVertical: 6, textAlign: 'center' },
  suggestionsContainer: {
    paddingHorizontal: 18,
    marginBottom: 6,
  },
  recentSection: {
    marginBottom: 4,
  },
  recentSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  recentTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  recentSectionTitle: {
    color: '#64748B',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  recentClearText: {
    color: '#64748B',
    fontSize: 10,
    fontWeight: '700',
  },
  recentChipsScroll: {
    gap: 6,
    paddingBottom: 2,
  },
  recentChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: '#131C2E',
    borderWidth: 1,
    borderColor: '#263247',
  },
  recentChipText: {
    color: '#CBD5E1',
    fontSize: 11,
    fontWeight: '600',
    maxWidth: 120,
  },
  popularSection: {
    marginBottom: 4,
  },
  popularSectionTitle: {
    color: '#64748B',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  popularChipsScroll: {
    gap: 6,
    paddingBottom: 2,
  },
  popularChip: {
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 14,
    backgroundColor: '#131C2E',
    borderWidth: 1,
    borderColor: '#263247',
  },
  popularChipText: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '700',
  },
  mapCard: {
    height: 250,
    marginHorizontal: 18,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#2A3A50',
    position: 'relative',
    backgroundColor: '#090E17',
  },
  map: { flex: 1, backgroundColor: '#090E17' },
  mapHint: {
    position: 'absolute',
    left: 10,
    bottom: 10,
    backgroundColor: 'rgba(14,21,36,0.92)',
    borderRadius: 10,
    paddingHorizontal: 9,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderColor: '#263247',
  },
  mapHintText: { color: '#E2E8F0', fontSize: 10, fontWeight: '800' },
  body: { padding: 18, paddingBottom: 26 },
  selectionCard: {
    backgroundColor: '#131C2E',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#263247',
  },
  selectionHeader: { flexDirection: 'row', alignItems: 'center' },
  selectionIcon: {
    width: 38,
    height: 38,
    borderRadius: 11,
    backgroundColor: '#00E5FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  selectionHeaderText: { flex: 1, minWidth: 0 },
  selectionTitle: { color: '#FFFFFF', fontSize: 13, fontWeight: '900' },
  selectionMeta: { color: '#94A3B8', fontSize: 10, lineHeight: 14, marginTop: 2 },
  sourceBadge: {
    backgroundColor: '#0F273D',
    borderRadius: 7,
    paddingHorizontal: 6,
    paddingVertical: 4,
    marginLeft: 8,
    borderWidth: 1,
    borderColor: '#00E5FF33',
  },
  sourceBadgeText: { color: '#00E5FF', fontSize: 8, fontWeight: '900', letterSpacing: 0.6 },
  coordinateRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  coordinateBox: {
    flex: 1,
    backgroundColor: '#0E1524',
    borderRadius: 10,
    padding: 8,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  coordinateLabel: { color: '#64748B', fontSize: 7, fontWeight: '900', letterSpacing: 0.6 },
  coordinateValue: { color: '#00E5FF', fontSize: 12, fontWeight: '800', marginTop: 3 },
  actions: { flexDirection: 'row', gap: 9, marginTop: 14 },
  cancelButton: {
    flex: 0.85,
    minHeight: 46,
    borderRadius: 14,
    backgroundColor: '#131C2E',
    borderWidth: 1,
    borderColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: { color: '#CBD5E1', fontSize: 13, fontWeight: '800' },
  confirmButton: {
    flex: 1.5,
    minHeight: 46,
    borderRadius: 14,
    backgroundColor: '#00E5FF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  confirmText: { color: '#06090F', fontSize: 13, fontWeight: '900' },
  disabled: { opacity: 0.45 },
});
