
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { WebView } from 'react-native-webview';

import { getCachedTrip, getTrip, Trip } from '../../services/tripService';
import {
  getCachedTripRoute,
  getTripRoute,
  TripRoute,
} from '../../services/routeService';

function parseDate(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

function getDayCount(trip: Trip | null) {
  if (!trip?.start_date || !trip?.end_date) return 1;
  return (
    Math.round(
      (parseDate(trip.end_date).getTime() -
        parseDate(trip.start_date).getTime()) /
        86400000,
    ) + 1
  );
}

function addDaysIso(value: string, days: number) {
  const date = parseDate(value);
  date.setDate(date.getDate() + days);
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

function formatDayDate(trip: Trip, dayNumber: number) {
  if (!trip.start_date) return `Day ${dayNumber}`;
  const iso = addDaysIso(trip.start_date, dayNumber - 1);
  const [year, month, day] = iso.split('-').map(Number);

  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
  }).format(new Date(year, month - 1, day));
}

function formatDistance(meters: number) {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

function formatDuration(seconds: number) {
  const totalMinutes = Math.max(0, Math.round(seconds / 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (!hours) return `${minutes} min`;
  return minutes ? `${hours} hr ${minutes} min` : `${hours} hr`;
}

function buildMapHtml(
  trip: Trip,
  dayNumber: number | null,
) {
  const sourceStops = trip.stops
    .filter(
      stop =>
        dayNumber == null || stop.day_number === dayNumber,
    )
    .filter(
      stop =>
        stop.latitude != null && stop.longitude != null,
    )
    .sort(
      (a, b) =>
        a.day_number - b.day_number ||
        a.sequence - b.sequence,
    )
    .map(stop => ({
      stop_id: stop.id,
      sequence: stop.sequence,
      day_number: stop.day_number,
      latitude: stop.latitude as number,
      longitude: stop.longitude as number,
      name: stop.name,
      stop_type: stop.stop_type,
    }));

  const stops = sourceStops.map((stop, index) => ({
    ...stop,
    display_sequence: index + 1,
  }));

  // Only the selected stop scope is part of the HTML. Route responses are
  // injected into this already-mounted MapLibre instance so the camera does
  // not jump when asynchronous routing completes.
  const payload = JSON.stringify({stops}).replace(/</g, '\u003c');

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<link rel="stylesheet" href="https://unpkg.com/maplibre-gl@6.10.0/dist/maplibre-gl.css">
<style>
html, body, #map {
  width:100%;
  height:100%;
  margin:0;
  overflow:hidden;
  background:#E8EEF4;
}
.stop-marker {
  width:32px;
  height:32px;
  border-radius:16px;
  display:flex;
  align-items:center;
  justify-content:center;
  color:#fff;
  font:900 12px system-ui,-apple-system,sans-serif;
  border:2px solid #fff;
  box-shadow:0 2px 8px rgba(15,23,42,.30);
}
.start { background:#0EA5A4; }
.stop { background:#2563EB; }
.destination { background:#F97316; }
</style>
</head>
<body>
<div id="map"></div>
<script type="module">
import * as maplibregl from 'https://unpkg.com/maplibre-gl@6.10.0/dist/maplibre-gl.mjs';

const payload = ${payload};
const points = payload.stops || [];
let mapReady = false;
let pendingRoute = null;

const map = new maplibregl.Map({
  container:'map',
  style:'https://tiles.openfreemap.org/styles/liberty',
  center:[78.9629, 20.5937],
  zoom:${dayNumber == null ? 4.5 : 8},
  attributionControl:false,
  cooperativeGestures:true,
});

map.addControl(
  new maplibregl.NavigationControl({showCompass:false}),
  'top-right'
);

map.addControl(
  new maplibregl.AttributionControl({compact:true}),
  'bottom-right'
);

function emptyCollection() {
  return { type:'FeatureCollection', features:[] };
}

function ensureRouteSources() {
  if (!map.getSource('road-legs')) {
    map.addSource('road-legs', { type:'geojson', data:emptyCollection() });
    map.addLayer({
      id:'road-legs-line',
      type:'line',
      source:'road-legs',
      layout:{'line-cap':'round','line-join':'round'},
      paint:{'line-color':'#0EA5A4','line-width':5,'line-opacity':0.92},
    });
  }

  if (!map.getSource('unrouted-legs')) {
    map.addSource('unrouted-legs', { type:'geojson', data:emptyCollection() });
    map.addLayer({
      id:'unrouted-legs-line',
      type:'line',
      source:'unrouted-legs',
      layout:{'line-cap':'round','line-join':'round'},
      paint:{
        'line-color':'#F59E0B',
        'line-width':3,
        'line-opacity':0.95,
        'line-dasharray':[2,2],
      },
    });
  }

}


function renderRoute(route) {
  if (!mapReady) {
    pendingRoute = route || null;
    return;
  }

  ensureRouteSources();

  const legs = route?.legs || [];
  const snappedStops = route?.snapped_stops || [];
  const roadFeatures = [];
  const unroutedFeatures = [];

  legs.forEach(leg => {
    const coordinates = (leg.points || [])
      .map(point => [Number(point.longitude), Number(point.latitude)])
      .filter(point => Number.isFinite(point[0]) && Number.isFinite(point[1]));

    if (coordinates.length < 2) return;

    const feature = {
      type:'Feature',
      geometry:{type:'LineString',coordinates},
      properties:{
        status:leg.status || (leg.routed ? 'routed' : 'unroutable'),
      },
    };

    if (leg.status === 'unroutable' || leg.routed === false) {
      unroutedFeatures.push(feature);
    } else {
      roadFeatures.push(feature);
    }
  });

  // Snapped stop coordinates remain part of the route response and are used
  // by the backend routing logic. They are intentionally not rendered on the
  // map: users should only see the numbered stop markers and the route line.
  void snappedStops;

  map.getSource('road-legs').setData({
    type:'FeatureCollection',features:roadFeatures,
  });
  map.getSource('unrouted-legs').setData({
    type:'FeatureCollection',features:unroutedFeatures,
  });

  // Never refit here. The stop scope determines the camera; the route is
  // an asynchronous visual overlay on top of that stable camera.
}

window.applyFairShareRoute = route => {
  pendingRoute = route || null;
  renderRoute(pendingRoute);
};

map.on('load', () => {
  const stopBounds = new maplibregl.LngLatBounds();
  let stopCount = 0;

  points.forEach(stop => {
    const longitude = Number(stop.longitude);
    const latitude = Number(stop.latitude);
    if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) return;

    const coordinate = [longitude, latitude];
    stopBounds.extend(coordinate);
    stopCount += 1;

    const el = document.createElement('div');
    el.className = 'stop-marker ' + (stop.stop_type || 'stop');
    el.textContent = String(stop.display_sequence);

    new maplibregl.Marker({element:el,anchor:'center'})
      .setLngLat(coordinate)
      .setPopup(
        new maplibregl.Popup({offset:16}).setHTML(
          '<strong>' +
          String(stop.display_sequence) +
          '. ' +
          String(stop.name).replaceAll('<','&lt;') +
          '</strong>'
        )
      )
      .addTo(map);
  });

  ensureRouteSources();
  mapReady = true;

  const fitStops = () => {
    map.resize();

    if (stopCount >= 2 && !stopBounds.isEmpty()) {
      map.fitBounds(stopBounds, {
        padding:{top:70,right:50,bottom:70,left:50},
        duration:0,
        maxZoom:${dayNumber == null ? 8.5 : 12},
      });
      return;
    }

    if (stopCount === 1) {
      const point = points[0];
      map.jumpTo({
        center:[Number(point.longitude), Number(point.latitude)],
        zoom:12,
      });
    }
  };

  requestAnimationFrame(() => {
    fitStops();
    setTimeout(fitStops, 120);
    setTimeout(fitStops, 350);
  });

  if (pendingRoute) renderRoute(pendingRoute);
});
</script>
</body>
</html>`;
}

export default function TripMapScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();

  const groupId =
    route.params?.groupId as string | undefined;
  const groupName =
    route.params?.groupName as string | undefined;
  const requestedDay =
    route.params?.dayNumber as number | undefined;

  const cachedTrip = getCachedTrip(groupId || '');
  const [trip, setTrip] = useState<Trip | null>(cachedTrip);
  const [loading, setLoading] = useState(!cachedTrip);
  const [selectedDay, setSelectedDay] =
    useState<number | null>(requestedDay ?? null);

  const [routeData, setRouteData] =
    useState<TripRoute | null>(
      getCachedTripRoute(
        groupId || '',
        requestedDay ?? null,
      ),
    );

  const [routing, setRouting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const mapWebViewRef = useRef<WebView>(null);

  const pushRouteDataToMap = useCallback(
    (data: TripRoute | null) => {
      if (!mapWebViewRef.current) return;

      const payload = JSON.stringify({
        legs: data?.legs || [],
        snapped_stops: data?.snapped_stops || [],
      })
        .replace(/</g, '\u003c')
        .replace(/\u2028/g, '\u2028')
        .replace(/\u2029/g, '\u2029');

      mapWebViewRef.current.injectJavaScript(
        `if (window.applyFairShareRoute) { window.applyFairShareRoute(${payload}); } true;`,
      );
    },
    [],
  );

  useEffect(() => {
    pushRouteDataToMap(routeData);
  }, [pushRouteDataToMap, routeData]);

  const dayCount = getDayCount(trip);

  const selectedStops = useMemo(() => {
    if (!trip) return [];

    return trip.stops
      .filter(
        stop =>
          selectedDay == null ||
          stop.day_number === selectedDay,
      )
      .sort(
        (a,b) =>
          a.day_number - b.day_number ||
          a.sequence - b.sequence,
      );
  }, [selectedDay, trip]);

  const coordinateStops = useMemo(
    () =>
      selectedStops.filter(
        stop =>
          stop.latitude != null &&
          stop.longitude != null,
      ),
    [selectedStops],
  );

  const loadTrip = useCallback(async () => {
    if (!groupId) return;

    const cached = getCachedTrip(groupId);

    if (cached) {
      setTrip(cached);
      setLoading(false);
    }

    const result = await getTrip(
      groupId,
      Boolean(cached),
    );

    if (result.error) {
      if (!cached) {
        Alert.alert(
          'Unable to load journey',
          result.error.message,
        );
      }
      return;
    }

    if (result.data) {
      setTrip(result.data);
      setLoading(false);
    }
  }, [groupId]);

  const calculateRoute = useCallback(
    async (
      force = false,
      signal?: AbortSignal,
    ) => {
      if (!groupId) return;

      if (
        selectedStops.length < 2 ||
        coordinateStops.length !==
          selectedStops.length
      ) {
        setRouting(false);
        setRouteData(null);
        setErrorMessage(
          selectedStops.length < 2
            ? 'Add at least two stops to this map scope.'
            : 'Add coordinates to every stop in this map scope.',
        );
        return;
      }

      setRouting(true);
      setErrorMessage('');

      const result = await getTripRoute(
        groupId,
        selectedDay,
        force,
        signal,
      );

      if (result.error?.name === 'AbortError') {
        return;
      }

      setRouting(false);

      if (result.error) {
        setRouteData(null);
        setErrorMessage(
          result.error.message ||
            'A route cannot be calculated yet.',
        );
        return;
      }

      setRouteData(result.data);
    },
    [
      coordinateStops.length,
      groupId,
      selectedDay,
      selectedStops.length,
    ],
  );

  useEffect(() => {
    void loadTrip();
  }, [loadTrip]);

  useEffect(() => {
    if (!trip || requestedDay == null) return;

    if (
      requestedDay >= 1 &&
      requestedDay <= dayCount
    ) {
      setSelectedDay(requestedDay);
    }
  }, [
    dayCount,
    requestedDay,
    trip,
  ]);

  useEffect(() => {
    const controller = new AbortController();

    setRouteData(
      groupId
        ? getCachedTripRoute(
            groupId,
            selectedDay,
          )
        : null,
    );

    void calculateRoute(
      Boolean(
        groupId &&
          getCachedTripRoute(
            groupId,
            selectedDay,
          ),
      ),
      controller.signal,
    );

    return () => controller.abort();
  }, [
    calculateRoute,
    groupId,
    selectedDay,
  ]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await loadTrip();
      await calculateRoute(true);
    } finally {
      setRefreshing(false);
    }
  };

  if (!groupId) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.center}>
          <Text style={styles.emptyTitle}>
            Map unavailable
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const mapHtml = trip
    ? buildMapHtml(
        trip,
        selectedDay,
      )
    : '<html><body style="background:#0F172A"></body></html>';

  const displayStops =
    routeData?.stops ||
    coordinateStops.map(stop => ({
      stop_id: stop.id,
      sequence: stop.sequence,
      day_number: stop.day_number,
      latitude: stop.latitude as number,
      longitude: stop.longitude as number,
      name: stop.name,
      stop_type: stop.stop_type,
    }));

  return (
    <SafeAreaView
      style={styles.safeArea}
      edges={['top','left','right']}
    >
      <StatusBar
        barStyle="light-content"
        backgroundColor="#0F172A"
      />

      <View style={styles.container}>
        <View style={styles.header}>
          <Pressable
            style={styles.headerButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons
              name="arrow-back"
              size={22}
              color="#FFFFFF"
            />
          </Pressable>

          <View style={styles.headerCenter}>
            <Text style={styles.headerEyebrow}>
              MAP & ROUTE
            </Text>
            <Text
              style={styles.headerTitle}
              numberOfLines={1}
            >
              {groupName || 'Trip map'}
            </Text>
            <Text style={styles.headerSubtitle}>
              {selectedDay == null
                ? 'Whole trip'
                : `Day ${selectedDay} • ${
                    trip
                      ? formatDayDate(
                          trip,
                          selectedDay,
                        )
                      : ''
                  }`}
            </Text>
          </View>

          <Pressable
            style={styles.headerButton}
            onPress={() => void handleRefresh()}
            disabled={refreshing}
          >
            {refreshing ? (
              <ActivityIndicator
                size="small"
                color="#CBD5E1"
              />
            ) : (
              <Ionicons
                name="refresh-outline"
                size={20}
                color="#FFFFFF"
              />
            )}
          </Pressable>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor="#0EA5A4"
            />
          }
        >
          {loading ? (
            <View style={styles.card}>
              <ActivityIndicator
                size="small"
                color="#0EA5A4"
              />
              <Text style={styles.mutedCenter}>
                Loading journey…
              </Text>
            </View>
          ) : !trip ? (
            <View style={styles.card}>
              <Text style={styles.title}>
                Create the Journey first
              </Text>
              <Text style={styles.muted}>
                Map planning is optional. Open Journey
                from the Trip group when you want to add
                dates and stops.
              </Text>
              <Pressable
                style={styles.primaryButton}
                onPress={() =>
                  navigation.navigate(
                    'TripDetails',
                    {groupId, groupName},
                  )
                }
              >
                <Text style={styles.primaryButtonText}>
                  Open Journey
                </Text>
              </Pressable>
            </View>
          ) : (
            <>
              <View style={styles.daySelectorCard}>
                <View style={styles.sectionHeader}>
                  <View style={styles.flexOne}>
                    <Text style={styles.titleSmall}>
                      Map scope
                    </Text>
                    <Text style={styles.muted}>
                      One finger scrolls the page. Two
                      fingers pan or zoom the map.
                    </Text>
                  </View>
                  <View style={styles.scopeBadge}>
                    <Ionicons
                      name="layers-outline"
                      size={14}
                      color="#0EA5A4"
                    />
                  </View>
                </View>

                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.dayChips}
                >
                  <Pressable
                    style={[
                      styles.dayChip,
                      selectedDay == null &&
                        styles.dayChipActive,
                    ]}
                    onPress={() => setSelectedDay(null)}
                  >
                    <Text
                      style={[
                        styles.dayChipTop,
                        selectedDay == null &&
                          styles.dayChipActiveText,
                      ]}
                    >
                      ALL
                    </Text>
                    <Text
                      style={[
                        styles.dayChipBottom,
                        selectedDay == null &&
                          styles.dayChipActiveText,
                      ]}
                    >
                      Trip
                    </Text>
                  </Pressable>

                  {Array.from(
                    {length:dayCount},
                    (_, index) => index + 1,
                  ).map(day => {
                    const active =
                      selectedDay === day;

                    const count =
                      trip.stops.filter(
                        stop =>
                          stop.day_number === day,
                      ).length;

                    return (
                      <Pressable
                        key={day}
                        style={[
                          styles.dayChip,
                          active &&
                            styles.dayChipActive,
                        ]}
                        onPress={() =>
                          setSelectedDay(day)
                        }
                      >
                        <Text
                          style={[
                            styles.dayChipTop,
                            active &&
                              styles.dayChipActiveText,
                          ]}
                        >
                          DAY {day}
                        </Text>
                        <Text
                          style={[
                            styles.dayChipBottom,
                            active &&
                              styles.dayChipActiveText,
                          ]}
                        >
                          {formatDayDate(trip, day)} · {count}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>

              <View style={styles.mapCard}>
                <WebView
                  ref={mapWebViewRef}
                  key={`${selectedDay ?? 'all'}`}
                  originWhitelist={['*']}
                  source={{
                    html: mapHtml,
                    baseUrl:'https://fairshare.local',
                  }}
                  javaScriptEnabled
                  domStorageEnabled
                  nestedScrollEnabled
                  startInLoadingState
                  renderLoading={() => (
                    <View style={styles.webLoading}>
                      <ActivityIndicator
                        size="small"
                        color="#0EA5A4"
                      />
                      <Text style={styles.muted}>
                        Loading map…
                      </Text>
                    </View>
                  )}
                  onLoadEnd={() => {
                    const latestCachedRoute = groupId
                      ? getCachedTripRoute(
                          groupId,
                          selectedDay,
                        )
                      : null;
                    pushRouteDataToMap(
                      latestCachedRoute,
                    );
                  }}
                  style={styles.map}
                />
              </View>

              <View style={styles.statsRow}>
                <View style={styles.statCard}>
                  <Text style={styles.statLabel}>
                    Stops
                  </Text>
                  <Text style={styles.statValue}>
                    {selectedStops.length}
                  </Text>
                </View>

                <View style={styles.statCard}>
                  <Text style={styles.statLabel}>
                    Mapped
                  </Text>
                  <Text style={styles.statValue}>
                    {coordinateStops.length}/
                    {selectedStops.length}
                  </Text>
                </View>

                <View style={styles.statCard}>
                  <Text style={styles.statLabel}>
                    Route
                  </Text>
                  <Text style={styles.statValue}>
                    {routeData
                      ? formatDistance(
                          routeData.distance_meters,
                        )
                      : '—'}
                  </Text>
                </View>
              </View>

              <View style={styles.card}>
                <View style={styles.sectionHeader}>
                  <View style={styles.flexOne}>
                    <Text style={styles.titleSmall}>
                      {selectedDay == null
                        ? 'Whole-trip route'
                        : `Day ${selectedDay} route`}
                    </Text>
                    <Text style={styles.muted}>
                      Each consecutive pair is routed independently.
                    </Text>
                  </View>

                  <Pressable
                    style={styles.secondaryButton}
                    onPress={() =>
                      void calculateRoute(true)
                    }
                    disabled={routing}
                  >
                    {routing ? (
                      <ActivityIndicator
                        size="small"
                        color="#CBD5E1"
                      />
                    ) : (
                      <Ionicons
                        name="navigate-outline"
                        size={15}
                        color="#CBD5E1"
                      />
                    )}
                    <Text
                      style={
                        styles.secondaryButtonText
                      }
                    >
                      {routing
                        ? 'Calculating'
                        : 'Recalculate'}
                    </Text>
                  </Pressable>
                </View>

                {routeData ? (
                  <>
                    <View style={styles.routeSummaryRow}>
                      <View style={styles.routeSummaryItem}>
                        <Text style={styles.metaLabel}>
                          Distance
                        </Text>
                        <Text style={styles.metaValue}>
                          {formatDistance(
                            routeData.distance_meters,
                          )}
                        </Text>
                      </View>

                      <View style={styles.routeSummaryItem}>
                        <Text style={styles.metaLabel}>
                          Estimated drive
                        </Text>
                        <Text style={styles.metaValue}>
                          {formatDuration(
                            routeData.duration_seconds,
                          )}
                        </Text>
                      </View>
                    </View>

                    {routeData.warning ? (
                      <View style={styles.warningBox}>
                        <Ionicons
                          name="information-circle-outline"
                          size={20}
                          color="#F59E0B"
                        />
                        <Text style={styles.warningText}>
                          {routeData.warning}
                        </Text>
                      </View>
                    ) : null}
                  </>
                ) : (
                  <View style={styles.infoBox}>
                    <Ionicons
                      name="information-circle-outline"
                      size={21}
                      color="#F59E0B"
                    />
                    <View style={styles.flexOne}>
                      <Text style={styles.infoTitle}>
                        {errorMessage ||
                          'A route cannot be calculated yet.'}
                      </Text>
                    </View>
                  </View>
                )}
              </View>

              <View style={styles.card}>
                <View style={styles.sectionHeader}>
                  <View style={styles.flexOne}>
                    <Text style={styles.titleSmall}>
                      Stops on this map
                    </Text>
                    <Text style={styles.muted}>
                      Edit names, days and coordinates in Journey.
                    </Text>
                  </View>

                  <Pressable
                    style={styles.secondaryButton}
                    onPress={() =>
                      navigation.navigate(
                        'TripDetails',
                        {groupId, groupName},
                      )
                    }
                  >
                    <Ionicons
                      name="create-outline"
                      size={15}
                      color="#CBD5E1"
                    />
                    <Text
                      style={
                        styles.secondaryButtonText
                      }
                    >
                      Edit
                    </Text>
                  </Pressable>
                </View>

                {displayStops.map((stop, index) => {
                  const showDayDivider =
                    selectedDay == null &&
                    (index === 0 ||
                      displayStops[index - 1].day_number !==
                        stop.day_number);

                  return (
                    <React.Fragment key={stop.stop_id}>
                      {showDayDivider ? (
                        <View style={styles.dayDivider}>
                          <View style={styles.dayDividerLine} />
                          <View style={styles.dayDividerCenter}>
                            <Text style={styles.dayDividerText}>
                              DAY {stop.day_number}
                            </Text>
                            <Text style={styles.dayDividerDate}>
                              {formatDayDate(trip, stop.day_number)}
                            </Text>
                          </View>
                          <View style={styles.dayDividerLine} />
                        </View>
                      ) : null}

                      <View style={styles.stopRow}>
                        <View style={styles.stopNumber}>
                          <Text style={styles.stopNumberText}>
                            {index + 1}
                          </Text>
                        </View>

                        <View style={styles.flexOne}>
                          <Text
                            style={styles.stopName}
                            numberOfLines={1}
                          >
                            {stop.name}
                          </Text>
                          <Text style={styles.stopMeta}>
                            {stop.stop_type.toUpperCase()}
                          </Text>
                        </View>
                      </View>
                    </React.Fragment>
                  );
                })}
              </View>

              <View style={styles.noteCard}>
                <Ionicons
                  name="information-circle-outline"
                  size={16}
                  color="#64748B"
                />
                <Text style={styles.noteText}>
                  Road distance and drive time are planning
                  estimates based on OpenStreetMap road data.
                </Text>
              </View>
            </>
          )}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea:{flex:1,backgroundColor:'#0F172A'},
  container:{flex:1,backgroundColor:'#0F172A'},
  header:{minHeight:76,paddingHorizontal:16,flexDirection:'row',alignItems:'center',borderBottomWidth:1,borderBottomColor:'#1E293B'},
  headerButton:{width:42,height:42,borderRadius:13,backgroundColor:'#1E293B',borderWidth:1,borderColor:'#263247',alignItems:'center',justifyContent:'center'},
  headerCenter:{flex:1,minWidth:0,paddingHorizontal:12},
  headerEyebrow:{color:'#0EA5A4',fontSize:9,fontWeight:'900',letterSpacing:1.1},
  headerTitle:{color:'#FFFFFF',fontSize:19,fontWeight:'900',marginTop:2},
  headerSubtitle:{color:'#64748B',fontSize:11,marginTop:3},
  scroll:{flex:1},
  content:{padding:16,paddingBottom:50},
  flexOne:{flex:1,minWidth:0},
  card:{backgroundColor:'#1E293B',borderRadius:20,padding:18,marginBottom:14},
  daySelectorCard:{backgroundColor:'#1E293B',borderRadius:20,padding:16,marginBottom:14},
  mapCard:{height:405,backgroundColor:'#1E293B',borderRadius:20,overflow:'hidden',marginBottom:14,borderWidth:1,borderColor:'#263247'},
  map:{flex:1,backgroundColor:'#E8EEF4'},
  webLoading:{flex:1,alignItems:'center',justifyContent:'center',backgroundColor:'#0F172A'},
  sectionHeader:{flexDirection:'row',alignItems:'center',marginBottom:12},
  title:{color:'#FFFFFF',fontSize:21,fontWeight:'900',marginTop:10},
  titleSmall:{color:'#FFFFFF',fontSize:16,fontWeight:'900'},
  muted:{color:'#94A3B8',fontSize:11,lineHeight:17,marginTop:4},
  mutedCenter:{color:'#94A3B8',fontSize:11,textAlign:'center',lineHeight:17,marginTop:8},
  scopeBadge:{width:34,height:34,borderRadius:11,backgroundColor:'#0F172A',borderWidth:1,borderColor:'#2A3A50',alignItems:'center',justifyContent:'center'},
  dayChips:{paddingRight:8},
  dayChip:{minWidth:86,paddingHorizontal:10,paddingVertical:9,borderRadius:13,backgroundColor:'#0F172A',borderWidth:1,borderColor:'#2A3A50',marginRight:8},
  dayChipActive:{backgroundColor:'#0EA5A4',borderColor:'#0EA5A4'},
  dayChipTop:{color:'#94A3B8',fontSize:9,fontWeight:'900',letterSpacing:.5},
  dayChipBottom:{color:'#CBD5E1',fontSize:10,fontWeight:'800',marginTop:3},
  dayChipActiveText:{color:'#FFFFFF'},
  statsRow:{flexDirection:'row',gap:10,marginBottom:14},
  statCard:{flex:1,backgroundColor:'#1E293B',borderRadius:16,padding:14},
  statLabel:{color:'#64748B',fontSize:9,fontWeight:'800'},
  statValue:{color:'#FFFFFF',fontSize:16,fontWeight:'900',marginTop:6},
  secondaryButton:{backgroundColor:'#0F172A',borderRadius:12,paddingHorizontal:10,paddingVertical:8,borderWidth:1,borderColor:'#243147',flexDirection:'row',alignItems:'center',gap:5},
  secondaryButtonText:{color:'#CBD5E1',fontSize:10,fontWeight:'900'},
  routeSummaryRow:{flexDirection:'row',gap:10},
  routeSummaryItem:{flex:1,backgroundColor:'#0F172A',borderRadius:14,padding:13},
  metaLabel:{color:'#64748B',fontSize:9,fontWeight:'800'},
  metaValue:{color:'#FFFFFF',fontSize:16,fontWeight:'900',marginTop:5},
  warningBox:{marginTop:12,backgroundColor:'#241E10',borderRadius:14,padding:12,flexDirection:'row',gap:9},
  warningText:{flex:1,color:'#FCD34D',fontSize:10,lineHeight:15,fontWeight:'700'},
  infoBox:{backgroundColor:'#0F172A',borderRadius:14,padding:14,flexDirection:'row',gap:10},
  infoTitle:{color:'#F8FAFC',fontSize:12,fontWeight:'800',lineHeight:18},
  dayDivider:{flexDirection:'row',alignItems:'center',paddingTop:16,paddingBottom:4,gap:10},
  dayDividerLine:{flex:1,height:1,backgroundColor:'#334155'},
  dayDividerCenter:{alignItems:'center',minWidth:82},
  dayDividerText:{color:'#0EA5A4',fontSize:10,fontWeight:'900',letterSpacing:.8},
  dayDividerDate:{color:'#64748B',fontSize:9,fontWeight:'800',marginTop:2},
  stopRow:{flexDirection:'row',alignItems:'center',paddingVertical:10,borderTopWidth:1,borderTopColor:'#243147'},
  stopNumber:{width:30,height:30,borderRadius:10,backgroundColor:'#0EA5A4',alignItems:'center',justifyContent:'center',marginRight:11},
  stopNumberText:{color:'#FFFFFF',fontSize:11,fontWeight:'900'},
  stopName:{color:'#FFFFFF',fontSize:13,fontWeight:'800'},
  stopMeta:{color:'#64748B',fontSize:9,marginTop:3},
  noteCard:{flexDirection:'row',alignItems:'flex-start',gap:8,paddingHorizontal:3,paddingBottom:5},
  noteText:{flex:1,color:'#64748B',fontSize:9,lineHeight:14},
  primaryButton:{backgroundColor:'#0EA5A4',borderRadius:14,paddingVertical:14,alignItems:'center',marginTop:15},
  primaryButtonText:{color:'#FFFFFF',fontWeight:'900',fontSize:13},
  center:{flex:1,alignItems:'center',justifyContent:'center'},
  emptyTitle:{color:'#FFFFFF',fontSize:20,fontWeight:'900'},
});
