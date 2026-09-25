import React, { useEffect, useMemo, useRef, useState } from 'react';
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
import { Ionicons } from '@expo/vector-icons';
import { WebView, WebViewMessageEvent } from 'react-native-webview';

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

const DEFAULT_CENTER = { latitude: 20.5937, longitude: 78.9629 };

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
<link rel="stylesheet" href="https://unpkg.com/maplibre-gl@6.10.0/dist/maplibre-gl.css">
<style>
html,body,#map{height:100%;width:100%;margin:0;background:#E8EEF4;}
.maplibregl-ctrl-group{border-radius:12px;overflow:hidden;}
.pick-marker{width:28px;height:28px;border-radius:14px;background:#0EA5A4;border:3px solid #fff;box-shadow:0 3px 10px rgba(15,23,42,.35);}
</style>
</head>
<body>
<div id="map"></div>
<script type="module">
import * as maplibregl from 'https://unpkg.com/maplibre-gl@6.10.0/dist/maplibre-gl.mjs';
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
    map.easeTo({center:[lng,lat],zoom:Math.max(map.getZoom(),14),duration:350});
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
  if (window.ReactNativeWebView) {
    window.ReactNativeWebView.postMessage(JSON.stringify({type:'mapPress',latitude,longitude}));
  }
});

window.addEventListener('message', (event) => {
  try {
    const message = JSON.parse(event.data || '{}');
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
  const webViewRef = useRef<WebView>(null);
  const [latitude, setLatitude] = useState<number | null>(initialLatitude);
  const [longitude, setLongitude] = useState<number | null>(initialLongitude);
  const [selectionName, setSelectionName] = useState(initialName);
  const [selectionAddress, setSelectionAddress] = useState<string | null>(initialAddress);
  const [selectionSource, setSelectionSource] = useState<'search' | 'map'>('map');
  const [placeId, setPlaceId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PlaceSearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setLatitude(initialLatitude ?? null);
    setLongitude(initialLongitude ?? null);
    setSelectionName(initialName || '');
    setSelectionAddress(initialAddress || null);
    setSelectionSource(initialLatitude != null && initialLongitude != null ? 'map' : 'map');
    setPlaceId(null);
    setQuery('');
    setResults([]);
  }, [initialAddress, initialLatitude, initialLongitude, initialName, visible]);

  const mapHtml = useMemo(
    () => buildPickerMapHtml(initialLatitude ?? null, initialLongitude ?? null),
    [initialLatitude, initialLongitude, visible],
  );

  const syncMap = (nextLatitude: number, nextLongitude: number) => {
    const message = JSON.stringify({
      type: 'setLocation',
      latitude: nextLatitude,
      longitude: nextLongitude,
    });
    webViewRef.current?.postMessage(message);
  };

  const chooseMapPoint = (nextLatitude: number, nextLongitude: number) => {
    setLatitude(nextLatitude);
    setLongitude(nextLongitude);
    setSelectionSource('map');
    setPlaceId(null);
    syncMap(nextLatitude, nextLongitude);
  };

  const runSearch = async () => {
    const normalized = query.trim();
    if (normalized.length < 2) return;

    setSearching(true);
    const result = await searchPlaces(normalized);
    setSearching(false);

    if (result.error) {
      setResults([]);
      return;
    }

    setResults(result.data?.results || []);
  };

  const selectPlace = (place: PlaceSearchResult) => {
    const nextLatitude = place.latitude;
    const nextLongitude = place.longitude;
    setLatitude(nextLatitude);
    setLongitude(nextLongitude);
    setSelectionName(place.name || place.display_name);
    setSelectionAddress(place.address || place.display_name);
    setSelectionSource('search');
    setPlaceId(place.place_id);
    setQuery(place.display_name);
    setResults([]);
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
      // Ignore malformed WebView messages.
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
            <View style={styles.header}>
              <View style={styles.headerText}>
                <Text style={styles.title}>{title}</Text>
                <Text style={styles.subtitle}>
                  Search for a place or tap anywhere on the map to set the exact point.
                </Text>
              </View>
              <Pressable style={styles.closeButton} onPress={onClose}>
                <Ionicons name="close" size={21} color="#CBD5E1" />
              </Pressable>
            </View>

            <View style={styles.searchRow}>
              <View style={styles.searchFieldWrap}>
                <Ionicons name="search-outline" size={18} color="#64748B" />
                <TextInput
                  value={query}
                  onChangeText={(value) => {
                    setQuery(value);
                    if (!value.trim()) setResults([]);
                  }}
                  placeholder="Search Pangong Lake, Manali..."
                  placeholderTextColor="#64748B"
                  style={styles.searchInput}
                  returnKeyType="search"
                  onSubmitEditing={() => void runSearch()}
                />
              </View>
              <Pressable
                style={[styles.searchButton, searching && styles.disabled]}
                onPress={() => void runSearch()}
                disabled={searching}
              >
                {searching ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
                )}
              </Pressable>
            </View>

            {!!results.length && (
              <View style={styles.resultsCard}>
                {results.map((place) => (
                  <Pressable
                    key={place.place_id}
                    style={styles.resultRow}
                    onPress={() => selectPlace(place)}
                  >
                    <View style={styles.resultIcon}>
                      <Ionicons name="location-outline" size={17} color="#0EA5A4" />
                    </View>
                    <View style={styles.resultText}>
                      <Text style={styles.resultName} numberOfLines={1}>
                        {place.name}
                      </Text>
                      <Text style={styles.resultAddress} numberOfLines={2}>
                        {place.display_name}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color="#475569" />
                  </Pressable>
                ))}
                <Text style={styles.attribution}>Search data © OpenStreetMap contributors</Text>
              </View>
            )}

            <View style={styles.mapCard}>
              <WebView
                ref={webViewRef}
                source={{ html: mapHtml }}
                originWhitelist={['*']}
                javaScriptEnabled
                domStorageEnabled
                onMessage={handleMapMessage}
                style={styles.map}
              />
              <View style={styles.mapHint} pointerEvents="none">
                <Ionicons name="hand-left-outline" size={14} color="#FFFFFF" />
                <Text style={styles.mapHintText}>Tap map to move pin</Text>
              </View>
            </View>

            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.body}
            >
              <View style={styles.selectionCard}>
                <View style={styles.selectionHeader}>
                  <View style={styles.selectionIcon}>
                    <Ionicons name="location" size={18} color="#FFFFFF" />
                  </View>
                  <View style={styles.selectionHeaderText}>
                    <Text style={styles.selectionTitle} numberOfLines={1}>
                      {selectionName.trim() || 'Selected location'}
                    </Text>
                    <Text style={styles.selectionMeta} numberOfLines={2}>
                      {selectionAddress || (selectionSource === 'search' ? 'Search result selected' : 'Map point selected')}
                    </Text>
                  </View>
                  {hasSelection && (
                    <View style={styles.sourceBadge}>
                      <Text style={styles.sourceBadgeText}>{selectionSource === 'search' ? 'SEARCH' : 'MAP'}</Text>
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

              <Text style={styles.footerNote}>
                You can edit the stop name and address after choosing the location. Coordinates are filled automatically.
              </Text>

              <View style={styles.actions}>
                <Pressable style={styles.cancelButton} onPress={onClose}>
                  <Text style={styles.cancelText}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={[styles.confirmButton, !hasSelection && styles.disabled]}
                  onPress={handleConfirm}
                  disabled={!hasSelection}
                >
                  <Ionicons name="checkmark-circle-outline" size={18} color="#FFFFFF" />
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
    backgroundColor: 'rgba(2, 6, 23, 0.82)',
    justifyContent: 'flex-end',
  },
  keyboard: { width: '100%', maxHeight: '96%' },
  card: {
    width: '100%',
    maxHeight: '96%',
    backgroundColor: '#1E293B',
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingTop: 18,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 18,
    paddingBottom: 13,
  },
  headerText: { flex: 1, paddingRight: 12 },
  title: { color: '#FFFFFF', fontSize: 20, fontWeight: '900' },
  subtitle: { color: '#94A3B8', fontSize: 11, lineHeight: 17, marginTop: 5 },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 13,
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#263247',
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 18,
    paddingBottom: 10,
  },
  searchFieldWrap: {
    flex: 1,
    minHeight: 48,
    paddingHorizontal: 13,
    borderRadius: 14,
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#2A3A50',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchInput: { flex: 1, color: '#FFFFFF', fontSize: 13, paddingVertical: 0 },
  searchButton: {
    width: 50,
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: '#0EA5A4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultsCard: {
    marginHorizontal: 18,
    marginBottom: 10,
    backgroundColor: '#0F172A',
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#263247',
    overflow: 'hidden',
  },
  resultRow: {
    minHeight: 58,
    paddingHorizontal: 11,
    paddingVertical: 9,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
    gap: 9,
  },
  resultIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#13283A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultText: { flex: 1, minWidth: 0 },
  resultName: { color: '#FFFFFF', fontSize: 12, fontWeight: '900' },
  resultAddress: { color: '#94A3B8', fontSize: 9, lineHeight: 13, marginTop: 2 },
  attribution: { color: '#475569', fontSize: 8, paddingHorizontal: 11, paddingVertical: 8 },
  mapCard: {
    height: 285,
    marginHorizontal: 18,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#2A3A50',
    position: 'relative',
    backgroundColor: '#E8EEF4',
  },
  map: { flex: 1, backgroundColor: '#E8EEF4' },
  mapHint: {
    position: 'absolute',
    left: 10,
    bottom: 10,
    backgroundColor: 'rgba(15,23,42,.88)',
    borderRadius: 11,
    paddingHorizontal: 9,
    paddingVertical: 7,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  mapHintText: { color: '#FFFFFF', fontSize: 9, fontWeight: '800' },
  body: { padding: 18, paddingBottom: 26 },
  selectionCard: {
    backgroundColor: '#0F172A',
    borderRadius: 17,
    padding: 13,
    borderWidth: 1,
    borderColor: '#263247',
  },
  selectionHeader: { flexDirection: 'row', alignItems: 'center' },
  selectionIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#0EA5A4',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  selectionHeaderText: { flex: 1, minWidth: 0 },
  selectionTitle: { color: '#FFFFFF', fontSize: 13, fontWeight: '900' },
  selectionMeta: { color: '#94A3B8', fontSize: 9, lineHeight: 14, marginTop: 3 },
  sourceBadge: {
    backgroundColor: '#13283A',
    borderRadius: 9,
    paddingHorizontal: 7,
    paddingVertical: 5,
    marginLeft: 8,
  },
  sourceBadgeText: { color: '#5EEAD4', fontSize: 7, fontWeight: '900', letterSpacing: 0.6 },
  coordinateRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  coordinateBox: {
    flex: 1,
    backgroundColor: '#1E293B',
    borderRadius: 11,
    padding: 10,
  },
  coordinateLabel: { color: '#64748B', fontSize: 7, fontWeight: '900', letterSpacing: 0.6 },
  coordinateValue: { color: '#E2E8F0', fontSize: 12, fontWeight: '800', marginTop: 4 },
  footerNote: { color: '#64748B', fontSize: 9, lineHeight: 14, marginTop: 10 },
  actions: { flexDirection: 'row', gap: 9, marginTop: 14 },
  cancelButton: {
    flex: 0.85,
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: { color: '#CBD5E1', fontSize: 13, fontWeight: '800' },
  confirmButton: {
    flex: 1.5,
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: '#0EA5A4',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  confirmText: { color: '#FFFFFF', fontSize: 13, fontWeight: '900' },
  disabled: { opacity: 0.55 },
});
