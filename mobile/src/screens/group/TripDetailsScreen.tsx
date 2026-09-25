import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';

import {
  addTripStop,
  createTrip,
  deleteTripStop,
  getCachedTrip,
  getTrip,
  reorderTripStops,
  Trip,
  TripStop,
  TripStopPayload,
  TripStopType,
  updateTrip,
  updateTripStop,
} from '../../services/tripService';
import { invalidateTripRoute } from '../../services/routeService';
import { PlaceSearchResult, searchPlaces } from '../../services/placeService';

const STOP_TYPES: Array<{
  value: TripStopType;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}> = [
  { value: 'start', label: 'Start', icon: 'flag-outline' },
  { value: 'stop', label: 'Stop', icon: 'location-outline' },
  { value: 'destination', label: 'Destination', icon: 'navigate-outline' },
];

function isAbortError(error: any) {
  return error?.name === 'AbortError';
}

function isTripNotConfiguredError(error: any) {
  return (
    error?.status === 404
    && error?.message === 'Trip is not configured for this group.'
  );
}

function parseDate(value: string | null | undefined) {
  if (!value) return new Date();
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return new Date();
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

function toIsoDate(value: Date) {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
}

function formatDate(value: string | null | undefined) {
  if (!value) return 'Not set';
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return value;
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(year, month - 1, day));
}

function formatShortDate(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return value;
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
  }).format(new Date(year, month - 1, day));
}

function getDayCount(startDate: string | null, endDate: string | null) {
  if (!startDate || !endDate) return 1;
  const start = parseDate(startDate).getTime();
  const end = parseDate(endDate).getTime();
  return Math.max(1, Math.round((end - start) / 86400000) + 1);
}

function addDaysIso(value: string, days: number) {
  const date = parseDate(value);
  date.setDate(date.getDate() + days);
  return toIsoDate(date);
}

function sortStops(stops: TripStop[]) {
  return [...stops].sort((a, b) => a.day_number - b.day_number || a.sequence - b.sequence);
}

function stopTypeLabel(type: TripStopType) {
  if (type === 'start') return 'START';
  if (type === 'destination') return 'DESTINATION';
  return 'STOP';
}

function defaultTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata';
  } catch {
    return 'Asia/Kolkata';
  }
}

function buildPickerMapHtml(
  latitude: number | null,
  longitude: number | null,
  label: string,
) {
  const safeLabel = JSON.stringify(label).replace(/</g, '\\u003c');
  const initial = JSON.stringify({ latitude, longitude, label }).replace(/</g, '\\u003c');

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<link rel="stylesheet" href="https://unpkg.com/maplibre-gl@6.10.0/dist/maplibre-gl.css">
<style>
html,body,#map{height:100%;width:100%;margin:0;background:#dfe8f1;overflow:hidden;touch-action:none}
.marker{width:38px;height:38px;border-radius:19px;background:#0EA5A4;border:3px solid #fff;box-shadow:0 3px 10px rgba(15,23,42,.35);display:flex;align-items:center;justify-content:center;color:#fff;font:900 13px system-ui,-apple-system,sans-serif}
.maplibregl-ctrl-group{border-radius:13px;overflow:hidden}
</style>
</head>
<body><div id="map"></div>
<script type="module">
import * as maplibregl from 'https://unpkg.com/maplibre-gl@6.10.0/dist/maplibre-gl.mjs';
const initial=${initial};
const fallback=[78.9629,20.5937];
let currentMarker=null;
let selected={lat:initial.latitude,lon:initial.longitude,label:initial.label||'Selected location'};
const map=new maplibregl.Map({
 container:'map',
 style:'https://tiles.openfreemap.org/styles/liberty',
 center:initial.longitude!=null&&initial.latitude!=null?[initial.longitude,initial.latitude]:fallback,
 zoom:initial.longitude!=null&&initial.latitude!=null?13:4.4,
 attributionControl:false,
 cooperativeGestures:false,
 touchZoomRotate:true,
 dragPan:true,
 doubleClickZoom:true,
 scrollZoom:true
});
map.addControl(new maplibregl.NavigationControl({showCompass:false}), 'top-right');
map.addControl(new maplibregl.AttributionControl({compact:true}), 'bottom-right');
function drawMarker(){
 if(currentMarker){currentMarker.remove();}
 if(selected.lat==null||selected.lon==null)return;
 const el=document.createElement('div');el.className='marker';el.textContent='•';
 currentMarker=new maplibregl.Marker({element:el,anchor:'center'}).setLngLat([selected.lon,selected.lat]).addTo(map);
}
window.setSelectedLocation=function(latitude,longitude,label){
 if(!Number.isFinite(latitude)||!Number.isFinite(longitude)) return;
 selected={lat:latitude,lon:longitude,label:label||'Selected location'};
 drawMarker();
 map.resize();
 map.flyTo({center:[longitude,latitude],zoom:14.2,duration:500,essential:true});
};
map.on('load',()=>{
 drawMarker();
 if(initial.longitude!=null&&initial.latitude!=null){map.flyTo({center:[initial.longitude,initial.latitude],zoom:14,duration:350,essential:true});}
});
map.on('click',(event)=>{
 selected={lat:event.lngLat.lat,lon:event.lngLat.lng,label:'Selected location'};
 drawMarker();
 window.ReactNativeWebView.postMessage(JSON.stringify({type:'map-tap',latitude:selected.lat,longitude:selected.lon}));
});
document.addEventListener('touchstart',()=>post('map-touch-start',{}),{capture:true,passive:true});
document.addEventListener('touchend',()=>post('map-touch-end',{}),{capture:true,passive:true});
document.addEventListener('touchcancel',()=>post('map-touch-end',{}),{capture:true,passive:true});
</script>
</body></html>`;
}

export default function TripDetailsScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const groupId = route.params?.groupId as string | undefined;
  const groupName = route.params?.groupName as string | undefined;

  const cachedTrip = getCachedTrip(groupId || '');
  const [trip, setTrip] = useState<Trip | null>(cachedTrip);
  const [loading, setLoading] = useState(!cachedTrip);
  const [saving, setSaving] = useState(false);
  const [startDate, setStartDate] = useState(cachedTrip?.start_date || '');
  const [endDate, setEndDate] = useState(cachedTrip?.end_date || '');
  const [timezone, setTimezone] = useState(cachedTrip?.timezone || defaultTimezone());
  const [notes, setNotes] = useState(cachedTrip?.notes || '');
  const [selectedDay, setSelectedDay] = useState(1);
  const [showDetails, setShowDetails] = useState(false);

  const [datePicker, setDatePicker] = useState<'start' | 'end' | null>(null);
  const [iosDraftDate, setIosDraftDate] = useState(new Date());

  const [showStopForm, setShowStopForm] = useState(false);
  const [editingStop, setEditingStop] = useState<TripStop | null>(null);
  const [stopType, setStopType] = useState<TripStopType>('stop');
  const [stopDay, setStopDay] = useState(1);
  const [stopName, setStopName] = useState('');
  const [stopLabel, setStopLabel] = useState('');
  const [stopAddress, setStopAddress] = useState('');
  const [stopLatitude, setStopLatitude] = useState('');
  const [stopLongitude, setStopLongitude] = useState('');
  const [stopNote, setStopNote] = useState('');
  const [savingStop, setSavingStop] = useState(false);

  const [placeSearch, setPlaceSearch] = useState('');
  const [placeResults, setPlaceResults] = useState<PlaceSearchResult[]>([]);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [pickerLatitude, setPickerLatitude] = useState<number | null>(null);
  const [pickerLongitude, setPickerLongitude] = useState<number | null>(null);
  const [pickerLabel, setPickerLabel] = useState('Selected location');
  const [pickerAddress, setPickerAddress] = useState<string | null>(null);
  const [pickerLoadingSearch, setPickerLoadingSearch] = useState(false);
  const [pickerMapTouching, setPickerMapTouching] = useState(false);
  const [pickerSession, setPickerSession] = useState(0);
  const pickerWebViewRef = useRef<WebView>(null);
  const pickerInitialRef = useRef<{ latitude: number | null; longitude: number | null; label: string }>({ latitude: null, longitude: null, label: 'Selected location' });
  const pendingPickerFocusRef = useRef<{ latitude: number; longitude: number; label: string } | null>(null);

  const reorderSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingOrder = useRef<string[] | null>(null);
  const [reorderPending, setReorderPending] = useState(false);

  const dayCount = useMemo(() => getDayCount(startDate || null, endDate || null), [startDate, endDate]);
  const orderedStops = useMemo(() => sortStops(trip?.stops || []), [trip?.stops]);
  const dayStops = useMemo(() => orderedStops.filter((stop) => stop.day_number === selectedDay), [orderedStops, selectedDay]);
  const mappedCount = useMemo(() => trip?.stops.filter((stop) => stop.latitude != null && stop.longitude != null).length || 0, [trip?.stops]);

  const dateRangeLabel = useMemo(() => {
    if (startDate && endDate) return `${formatDate(startDate)} → ${formatDate(endDate)}`;
    if (startDate) return `Starts ${formatDate(startDate)}`;
    return 'Choose the travel window';
  }, [endDate, startDate]);

  const load = useCallback(async () => {
    if (!groupId) return;
    const cached = getCachedTrip(groupId);
    if (cached) {
      setTrip(cached);
      setStartDate(cached.start_date || '');
      setEndDate(cached.end_date || '');
      setTimezone(cached.timezone || defaultTimezone());
      setNotes(cached.notes || '');
      setLoading(false);
    }
    const result = await getTrip(groupId, Boolean(cached));
    if (isAbortError(result.error)) return;

    // A missing Trip row is a normal state for a Trip group that has not
    // configured Journey yet. Keep the setup form available instead of
    // showing an error alert. Other API errors remain visible to the user.
    if (result.error) {
      // A 404 with this exact API message means the Trip row does not exist
      // yet. That is the expected first-run Journey setup state, not a
      // failed request. Only this known state is converted into the setup
      // form; every other API error remains visible to the user.
      if (isTripNotConfiguredError(result.error)) {
        setTrip(null);
        setStartDate('');
        setEndDate('');
        setTimezone(defaultTimezone());
        setNotes('');
        setLoading(false);
        return;
      }

      setLoading(false);
      if (!cached) {
        Alert.alert('Unable to load journey', result.error.message);
      }
      return;
    }
    if (result.data) {
      setTrip(result.data);
      setStartDate(result.data.start_date || '');
      setEndDate(result.data.end_date || '');
      setTimezone(result.data.timezone || defaultTimezone());
      setNotes(result.data.notes || '');
      setLoading(false);
    }
  }, [groupId]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { setSelectedDay((current) => Math.min(Math.max(current, 1), dayCount)); }, [dayCount]);
  useEffect(() => { setStopDay((current) => Math.min(Math.max(current, 1), dayCount)); }, [dayCount]);

  useEffect(() => {
    return () => {
      if (reorderSaveTimer.current) clearTimeout(reorderSaveTimer.current);
    };
  }, []);

  const openDatePicker = (kind: 'start' | 'end') => {
    const existing = kind === 'start' ? startDate : endDate;
    const fallback = kind === 'end' && !existing && startDate ? startDate : existing;
    setIosDraftDate(parseDate(fallback));
    setDatePicker(kind);
  };

  const applyDate = (date: Date, kind: 'start' | 'end') => {
    const iso = toIsoDate(date);
    if (kind === 'start') {
      setStartDate(iso);
      if (!endDate || parseDate(endDate) < date) setEndDate(iso);
      return;
    }
    if (startDate && date < parseDate(startDate)) {
      Alert.alert('Invalid end date', 'End date cannot be before the start date.');
      return;
    }
    setEndDate(iso);
  };

  const handleDatePickerChange = (event: DateTimePickerEvent, value?: Date) => {
    if (Platform.OS === 'android') {
      const current = datePicker;
      setDatePicker(null);
      if (event.type === 'set' && value && current) applyDate(value, current);
      return;
    }
    if (event.type === 'set' && value) setIosDraftDate(value);
  };

  const saveTrip = async () => {
    if (!groupId) return;
    if (startDate && endDate && parseDate(endDate) < parseDate(startDate)) {
      Alert.alert('Invalid dates', 'End date cannot be before the start date.');
      return;
    }
    setSaving(true);
    const payload = {
      start_date: startDate || null,
      end_date: endDate || null,
      timezone: timezone.trim() || null,
      notes: notes.trim() || null,
    };
    const result = trip ? await updateTrip(groupId, payload) : await createTrip(groupId, payload);
    setSaving(false);
    if (result.error) {
      Alert.alert('Unable to save journey', result.error.message);
      return;
    }
    if (result.data) {
      setTrip(result.data);
      setStartDate(result.data.start_date || '');
      setEndDate(result.data.end_date || '');
      setTimezone(result.data.timezone || defaultTimezone());
      setNotes(result.data.notes || '');
      setSelectedDay(1);
    }
  };

  const openAddStop = () => {
    setEditingStop(null);
    setStopType(dayStops.length === 0 ? 'start' : 'stop');
    setStopDay(selectedDay);
    setStopName('');
    setStopLabel('');
    setStopAddress('');
    setStopLatitude('');
    setStopLongitude('');
    setStopNote('');
    setPlaceSearch('');
    setPlaceResults([]);
    setShowStopForm(true);
  };

  const openEditStop = (stop: TripStop) => {
    setEditingStop(stop);
    setStopType(stop.stop_type);
    setStopDay(stop.day_number);
    setStopName(stop.name);
    setStopLabel(stop.label || '');
    setStopAddress(stop.address || '');
    setStopLatitude(stop.latitude == null ? '' : String(stop.latitude));
    setStopLongitude(stop.longitude == null ? '' : String(stop.longitude));
    setStopNote(stop.note || '');
    setPlaceSearch('');
    setPlaceResults([]);
    setShowStopForm(true);
  };

  const closeStopForm = () => {
    setShowStopForm(false);
    setEditingStop(null);
    setPlaceSearch('');
    setPlaceResults([]);
  };

  const openLocationPicker = () => {
    const latitude = stopLatitude.trim() ? Number(stopLatitude.trim()) : null;
    const longitude = stopLongitude.trim() ? Number(stopLongitude.trim()) : null;
    const hasValidCoords =
      latitude != null && longitude != null && Number.isFinite(latitude) && Number.isFinite(longitude) &&
      latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180;

    const initialLatitude = hasValidCoords ? latitude : null;
    const initialLongitude = hasValidCoords ? longitude : null;
    const initialLabel = stopName.trim() || 'Selected location';
    pickerInitialRef.current = { latitude: initialLatitude, longitude: initialLongitude, label: initialLabel };
    pendingPickerFocusRef.current = null;
    setPickerLatitude(initialLatitude);
    setPickerLongitude(initialLongitude);
    setPickerLabel(initialLabel);
    setPickerAddress(stopAddress.trim() || null);
    setPickerSession((value) => value + 1);
    setShowLocationPicker(true);
  };

  const focusPickerLocation = (latitude: number, longitude: number, label: string) => {
    const payload = { latitude, longitude, label };
    pendingPickerFocusRef.current = payload;
    const script = `window.setSelectedLocation && window.setSelectedLocation(${JSON.stringify(latitude)},${JSON.stringify(longitude)},${JSON.stringify(label)}); true;`;
    pickerWebViewRef.current?.injectJavaScript(script);
  };

  const searchInsidePicker = async () => {
    const query = placeSearch.trim();
    if (query.length < 2) {
      Alert.alert('Search place', 'Enter at least 2 characters.');
      return;
    }
    setPickerLoadingSearch(true);
    const result = await searchPlaces(query);
    setPickerLoadingSearch(false);
    if (result.error) {
      Alert.alert('Place search failed', result.error.message);
      return;
    }
    const results = result.data?.results || [];
    setPlaceResults(results.slice(0, 5));
    if (!results.length) {
      Alert.alert('No places found', 'Try a more specific place or address.');
      return;
    }
    const place = results[0];
    setPickerLatitude(place.latitude);
    setPickerLongitude(place.longitude);
    setPickerLabel(place.name || place.display_name);
    setPickerAddress(place.address || place.display_name);
    focusPickerLocation(place.latitude, place.longitude, place.name || place.display_name);
  };

  const choosePickerResult = (place: PlaceSearchResult) => {
    setPickerLatitude(place.latitude);
    setPickerLongitude(place.longitude);
    setPickerLabel(place.name || place.display_name);
    setPickerAddress(place.address || place.display_name);
    setPlaceResults([]);
    focusPickerLocation(place.latitude, place.longitude, place.name || place.display_name);
  };

  const onPickerMapMessage = (event: WebViewMessageEvent) => {
    try {
      const message = JSON.parse(event.nativeEvent.data || '{}');
      if (message.type === 'map-touch-start') setPickerMapTouching(true);
      if (message.type === 'map-touch-end') setPickerMapTouching(false);
      if (message.type === 'map-tap') {
        const latitude = Number(message.latitude);
        const longitude = Number(message.longitude);
        if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
          setPickerLatitude(latitude);
          setPickerLongitude(longitude);
          setPickerLabel('Selected location');
          setPickerAddress(null);
          setPlaceResults([]);
        }
      }
    } catch {
      // Ignore malformed WebView messages.
    }
  };

  const usePickerLocation = () => {
    if (pickerLatitude == null || pickerLongitude == null) {
      Alert.alert('Choose a location', 'Search for a place or tap the map first.');
      return;
    }
    setStopLatitude(pickerLatitude.toFixed(6));
    setStopLongitude(pickerLongitude.toFixed(6));
    if (!stopName.trim() || pickerLabel !== 'Selected location') setStopName(pickerLabel);
    if (pickerAddress) setStopAddress(pickerAddress);
    setShowLocationPicker(false);
  };

  const saveStop = async () => {
    if (!groupId || !trip) return;
    if (!stopName.trim()) {
      Alert.alert('Stop name required', 'Enter a name for this stop.');
      return;
    }

    const latitude = stopLatitude.trim() ? Number(stopLatitude.trim()) : null;
    const longitude = stopLongitude.trim() ? Number(stopLongitude.trim()) : null;
    if (
      (latitude == null) !== (longitude == null) ||
      (latitude != null && (!Number.isFinite(latitude) || latitude < -90 || latitude > 90)) ||
      (longitude != null && (!Number.isFinite(longitude) || longitude < -180 || longitude > 180))
    ) {
      Alert.alert('Invalid coordinates', 'Choose a location on the map or leave the location unset.');
      return;
    }

    setSavingStop(true);
    const payload: TripStopPayload = {
      stop_type: stopType,
      day_number: stopDay,
      name: stopName.trim(),
      label: stopLabel.trim() || null,
      address: stopAddress.trim() || null,
      latitude,
      longitude,
      note: stopNote.trim() || null,
    };
    const result = editingStop
      ? await updateTripStop(groupId, editingStop.id, payload)
      : await addTripStop(groupId, payload);
    setSavingStop(false);

    if (result.error) {
      Alert.alert('Unable to save stop', result.error.message);
      return;
    }
    invalidateTripRoute(groupId);
    closeStopForm();
    setSelectedDay(stopDay);
    await load();
  };

  const persistPendingReorder = useCallback(async () => {
    if (!groupId || !pendingOrder.current) return;
    const ids = pendingOrder.current;
    pendingOrder.current = null;
    setReorderPending(true);
    const result = await reorderTripStops(groupId, ids);
    setReorderPending(false);
    if (result.error) {
      Alert.alert('Unable to save stop order', result.error.message);
      await load();
      return;
    }
    invalidateTripRoute(groupId);
    if (result.data) {
      setTrip((current) => current ? { ...current, stops: current.stops.map((stop) => result.data!.find((row) => row.id === stop.id) || stop) } : current);
    }
  }, [groupId, load]);

  const scheduleReorderPersist = useCallback(() => {
    if (reorderSaveTimer.current) clearTimeout(reorderSaveTimer.current);
    reorderSaveTimer.current = setTimeout(() => { void persistPendingReorder(); }, 300);
  }, [persistPendingReorder]);

  const moveStop = (index: number, direction: -1 | 1) => {
    if (!trip) return;
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= dayStops.length) return;

    const nextDayStops = [...dayStops];
    [nextDayStops[index], nextDayStops[nextIndex]] = [nextDayStops[nextIndex], nextDayStops[index]];

    const grouped: TripStop[] = [];
    const dayMap = new Map<number, TripStop[]>();
    for (const stop of orderedStops) {
      const list = dayMap.get(stop.day_number) || [];
      list.push(stop);
      dayMap.set(stop.day_number, list);
    }
    dayMap.set(selectedDay, nextDayStops);
    for (let day = 1; day <= dayCount; day += 1) grouped.push(...(dayMap.get(day) || []));

    const withSequence = grouped.map((stop, sequence) => ({ ...stop, sequence }));
    setTrip((current) => current ? { ...current, stops: current.stops.map((stop) => withSequence.find((row) => row.id === stop.id) || stop) } : current);
    pendingOrder.current = withSequence.map((stop) => stop.id);
    setReorderPending(true);
    invalidateTripRoute(groupId || '');
    scheduleReorderPersist();
  };

  const removeStop = (stop: TripStop) => {
    if (!groupId) return;
    Alert.alert('Remove stop?', `Remove ${stop.name} from Day ${stop.day_number}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          const result = await deleteTripStop(groupId, stop.id);
          if (result.error) {
            Alert.alert('Unable to remove stop', result.error.message);
            return;
          }
          invalidateTripRoute(groupId);
          await load();
        },
      },
    ]);
  };

  const goToExpenses = () => navigation.navigate('GroupDetails', { groupId, groupName, initialTab: 'Expenses' });
  const mapCurrentDay = () => navigation.navigate('TripMap', { groupId, groupName, dayNumber: selectedDay });

  const dayLabels = useMemo(
    () => Array.from({ length: dayCount }, (_, index) => ({
      number: index + 1,
      label: startDate ? formatShortDate(addDaysIso(startDate, index)) : `Day ${index + 1}`,
    })),
    [dayCount, startDate],
  );

  const pickerHtml = useMemo(() => buildPickerMapHtml(pickerInitialRef.current.latitude, pickerInitialRef.current.longitude, pickerInitialRef.current.label), [pickerSession]);
  const pickerResults = placeResults.slice(0, 5);

  if (!groupId) {
    return <SafeAreaView style={styles.safeArea}><View style={styles.center}><Text style={styles.emptyTitle}>Journey unavailable</Text></View></SafeAreaView>;
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="light-content" backgroundColor="#0F172A" />
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <Pressable style={styles.headerButton} onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={23} color="#FFFFFF" />
          </Pressable>
          <View style={styles.headerCenter}>
            <Text style={styles.headerEyebrow}>TRIP PLANNING</Text>
            <Text style={styles.headerTitle} numberOfLines={1}>{groupName || 'Journey'}</Text>
            <Text style={styles.headerSubtitle} numberOfLines={1}>{dateRangeLabel}</Text>
          </View>
          <Pressable style={styles.headerButton} onPress={goToExpenses}>
            <Ionicons name="receipt-outline" size={21} color="#FFFFFF" />
          </Pressable>
        </View>

        <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.heroCard}>
            <View style={styles.heroIcon}><Ionicons name="map-outline" size={24} color="#FFFFFF" /></View>
            <Text style={styles.heroEyebrow}>OPTIONAL JOURNEY</Text>
            <Text style={styles.heroTitle}>Plan your route, not your accounting.</Text>
            <Text style={styles.heroText}>Build days, stops and routes here. Expenses remain a normal group feature and never require a journey.</Text>
          </View>

          {loading ? (
            <View style={styles.card}><ActivityIndicator size="small" color="#0EA5A4" /><Text style={styles.mutedCenter}>Loading journey…</Text></View>
          ) : (
            <>
              <View style={styles.card}>
                <View style={styles.sectionHeader}>
                  <View style={styles.flexOne}>
                    <Text style={styles.sectionTitle}>Trip dates</Text>
                    <Text style={styles.sectionSubtitle}>{startDate && endDate ? `${dayCount} ${dayCount === 1 ? 'day' : 'days'}` : 'Choose the travel window'}</Text>
                  </View>
                  <View style={styles.dateBadge}><Ionicons name="calendar-outline" size={15} color="#0EA5A4" /><Text style={styles.dateBadgeText}>{dayCount}D</Text></View>
                </View>
                <View style={styles.dateRow}>
                  <Pressable style={styles.dateField} onPress={() => openDatePicker('start')}>
                    <Text style={styles.fieldCaption}>START DATE</Text>
                    <View style={styles.fieldValueRow}><Ionicons name="calendar-clear-outline" size={17} color="#94A3B8" /><Text style={styles.dateValue}>{startDate ? formatDate(startDate) : 'Select start'}</Text></View>
                  </Pressable>
                  <View style={styles.dateArrow}><Ionicons name="arrow-forward" size={15} color="#475569" /></View>
                  <Pressable style={styles.dateField} onPress={() => openDatePicker('end')}>
                    <Text style={styles.fieldCaption}>END DATE</Text>
                    <View style={styles.fieldValueRow}><Ionicons name="calendar-clear-outline" size={17} color="#94A3B8" /><Text style={styles.dateValue}>{endDate ? formatDate(endDate) : 'Select end'}</Text></View>
                  </Pressable>
                </View>
              </View>

              <View style={styles.cardCompact}>
                <Pressable style={styles.detailsToggle} onPress={() => setShowDetails((value) => !value)}>
                  <View style={styles.detailsToggleIcon}><Ionicons name="options-outline" size={17} color="#CBD5E1" /></View>
                  <View style={styles.flexOne}><Text style={styles.detailsToggleTitle}>Trip details</Text><Text style={styles.detailsToggleSubtitle}>Timezone and notes are optional.</Text></View>
                  <Ionicons name={showDetails ? 'chevron-up' : 'chevron-down'} size={18} color="#64748B" />
                </Pressable>
                {showDetails && (
                  <View style={styles.detailsBody}>
                    <Text style={styles.inputLabel}>Timezone</Text>
                    <TextInput value={timezone} onChangeText={setTimezone} placeholder="Asia/Kolkata" placeholderTextColor="#64748B" style={styles.input} />
                    <Text style={styles.inputLabel}>Notes</Text>
                    <TextInput value={notes} onChangeText={setNotes} placeholder="High-level plan, reminders, packing notes…" placeholderTextColor="#64748B" style={[styles.input, styles.textArea]} multiline textAlignVertical="top" />
                  </View>
                )}
              </View>

              <Pressable style={[styles.saveJourneyButton, saving && styles.disabled]} onPress={() => void saveTrip()} disabled={saving}>
                {saving ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Ionicons name="checkmark-circle-outline" size={18} color="#FFFFFF" />}
                <Text style={styles.saveJourneyButtonText}>{trip ? 'Save journey changes' : 'Create journey'}</Text>
              </Pressable>

              {!trip ? (
                <View style={styles.card}><Text style={styles.title}>Create the journey to start planning.</Text><Text style={styles.muted}>You can add expenses at any time without creating a journey.</Text></View>
              ) : (
                <>
                  <View style={styles.card}>
                    <View style={styles.sectionHeader}>
                      <View style={styles.flexOne}><Text style={styles.sectionTitle}>Journey days</Text><Text style={styles.sectionSubtitle}>Plan a separate itinerary for every day.</Text></View>
                      <View style={styles.miniStat}><Text style={styles.miniStatValue}>{trip.stops.length}</Text><Text style={styles.miniStatLabel}>stops</Text></View>
                    </View>

                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dayChips}>
                      {dayLabels.map((day) => {
                        const active = selectedDay === day.number;
                        const count = orderedStops.filter((stop) => stop.day_number === day.number).length;
                        return (
                          <Pressable key={day.number} style={[styles.dayChip, active && styles.dayChipActive]} onPress={() => setSelectedDay(day.number)}>
                            <Text style={[styles.dayChipNumber, active && styles.dayChipTextActive]}>DAY {day.number}</Text>
                            <Text style={[styles.dayChipDate, active && styles.dayChipTextActive]}>{day.label}</Text>
                            <View style={[styles.dayChipCount, active && styles.dayChipCountActive]}><Text style={[styles.dayChipCountText, active && styles.dayChipCountTextActive]}>{count}</Text></View>
                          </Pressable>
                        );
                      })}
                    </ScrollView>

                    <View style={styles.dayHeaderRow}>
                      <View style={styles.flexOne}><Text style={styles.dayTitle}>Day {selectedDay}</Text><Text style={styles.dayDate}>{startDate ? formatDate(addDaysIso(startDate, selectedDay - 1)) : `Day ${selectedDay}`}</Text></View>
                      <Pressable style={styles.mapButton} onPress={mapCurrentDay}><Ionicons name="map-outline" size={16} color="#CBD5E1" /><Text style={styles.mapButtonText}>Map</Text></Pressable>
                    </View>

                    {dayStops.length === 0 ? (
                      <View style={styles.dayEmpty}>
                        <View style={styles.dayEmptyIcon}><Ionicons name="location-outline" size={24} color="#0EA5A4" /></View>
                        <Text style={styles.dayEmptyTitle}>Nothing planned yet</Text>
                        <Text style={styles.dayEmptyText}>Add a start, stop or destination for Day {selectedDay}.</Text>
                      </View>
                    ) : (
                      dayStops.map((stop, index) => (
                        <View key={stop.id} style={styles.stopCard}>
                          <View style={styles.stopTimeline}>
                            <View style={[styles.stopNumber, stop.stop_type === 'destination' && styles.stopNumberDestination]}><Text style={styles.stopNumberText}>{index + 1}</Text></View>
                            {index < dayStops.length - 1 && <View style={styles.timelineLine} />}
                          </View>
                          <View style={styles.stopContent}>
                            <Text style={styles.stopType}>{stopTypeLabel(stop.stop_type)}</Text>
                            <Text style={styles.stopName} numberOfLines={1}>{stop.name}</Text>
                            {!!stop.label && <Text style={styles.stopLabel}>{stop.label}</Text>}
                            {!!stop.address && <Text style={styles.stopMeta} numberOfLines={2}>{stop.address}</Text>}
                            {stop.latitude == null || stop.longitude == null ? (
                              <View style={styles.missingCoordsBadge}><Ionicons name="warning-outline" size={12} color="#FBBF24" /><Text style={styles.missingCoordsText}>Location not selected</Text></View>
                            ) : <Text style={styles.coordText}>{stop.latitude.toFixed(4)}, {stop.longitude.toFixed(4)}</Text>}
                            <View style={styles.stopActions}>
                              <Pressable style={styles.iconAction} disabled={index === 0 || reorderPending} onPress={() => moveStop(index, -1)}><Ionicons name="chevron-up" size={17} color={index === 0 ? '#334155' : '#CBD5E1'} /></Pressable>
                              <Pressable style={styles.iconAction} disabled={index === dayStops.length - 1 || reorderPending} onPress={() => moveStop(index, 1)}><Ionicons name="chevron-down" size={17} color={index === dayStops.length - 1 ? '#334155' : '#CBD5E1'} /></Pressable>
                              <Pressable style={styles.iconAction} onPress={() => openEditStop(stop)}><Ionicons name="create-outline" size={16} color="#CBD5E1" /></Pressable>
                              <Pressable style={[styles.iconAction, styles.deleteAction]} onPress={() => removeStop(stop)}><Ionicons name="trash-outline" size={16} color="#FB7185" /></Pressable>
                            </View>
                          </View>
                        </View>
                      ))
                    )}

                    <Pressable style={styles.outlineAddButton} onPress={openAddStop}><Ionicons name="add-circle-outline" size={17} color="#5EEAD4" /><Text style={styles.outlineAddText}>Add another stop to Day {selectedDay}</Text></Pressable>
                  </View>

                  <View style={styles.statsGrid}>
                    <View style={styles.statCard}><Text style={styles.statValue}>{dayCount}</Text><Text style={styles.statLabel}>days</Text></View>
                    <View style={styles.statCard}><Text style={styles.statValue}>{trip.stops.length}</Text><Text style={styles.statLabel}>stops</Text></View>
                    <View style={styles.statCard}><Text style={styles.statValue}>{mappedCount}</Text><Text style={styles.statLabel}>mapped</Text></View>
                  </View>

                  <View style={styles.expensesCard}>
                    <View style={styles.expensesIcon}><Ionicons name="receipt-outline" size={20} color="#5EEAD4" /></View>
                    <View style={styles.flexOne}><Text style={styles.expensesTitle}>Expenses stay with the group</Text><Text style={styles.expensesText}>Track hotels, fuel, food and other shared costs from the normal Expenses tab — with or without a Journey.</Text></View>
                    <Pressable style={styles.expensesAction} onPress={goToExpenses}><Ionicons name="arrow-forward" size={18} color="#FFFFFF" /></Pressable>
                  </View>
                </>
              )}
            </>
          )}
        </ScrollView>

        {datePicker && Platform.OS === 'ios' ? (
          <Modal transparent animationType="fade" visible>
            <View style={styles.modalOverlay}>
              <View style={styles.datePickerCard}>
                <View style={styles.modalHeader}><View style={styles.flexOne}><Text style={styles.modalTitle}>{datePicker === 'start' ? 'Start date' : 'End date'}</Text><Text style={styles.modalSubtitle}>Choose a travel date.</Text></View><Pressable style={styles.modalClose} onPress={() => setDatePicker(null)}><Ionicons name="close" size={20} color="#FFFFFF" /></Pressable></View>
                <DateTimePicker value={iosDraftDate} mode="date" display="spinner" onChange={handleDatePickerChange} themeVariant="dark" />
                <View style={styles.modalActions}><Pressable style={styles.modalCancel} onPress={() => setDatePicker(null)}><Text style={styles.modalCancelText}>Cancel</Text></Pressable><Pressable style={styles.modalConfirm} onPress={() => { if (datePicker) applyDate(iosDraftDate, datePicker); setDatePicker(null); }}><Text style={styles.modalConfirmText}>Use date</Text></Pressable></View>
              </View>
            </View>
          </Modal>
        ) : null}

        {datePicker && Platform.OS === 'android' ? <DateTimePicker value={iosDraftDate} mode="date" display="calendar" onChange={handleDatePickerChange} /> : null}

        <Modal visible={showStopForm} transparent animationType="slide" onRequestClose={closeStopForm}>
          <View style={styles.modalOverlay}>
            <KeyboardAvoidingView style={styles.modalKeyboard} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
              <View style={styles.stopModalCard}>
                <View style={styles.modalHeader}>
                  <View style={styles.flexOne}><Text style={styles.modalTitle}>{editingStop ? 'Edit stop' : 'Add stop'}</Text><Text style={styles.modalSubtitle}>Add where you will start, stay, visit or finish.</Text></View>
                  <Pressable style={styles.modalClose} onPress={closeStopForm}><Ionicons name="close" size={20} color="#FFFFFF" /></Pressable>
                </View>
                <ScrollView style={styles.stopFormScroll} contentContainerStyle={styles.stopFormContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                  <Text style={styles.inputLabel}>Day</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.modalDayRow}>
                    {dayLabels.map((day) => <Pressable key={day.number} style={[styles.modalDayChip, stopDay === day.number && styles.modalDayChipActive]} onPress={() => setStopDay(day.number)}><Text style={[styles.modalDayChipText, stopDay === day.number && styles.modalDayChipTextActive]}>Day {day.number}</Text><Text style={[styles.modalDayChipDate, stopDay === day.number && styles.modalDayChipDateActive]}>{day.label}</Text></Pressable>)}
                  </ScrollView>

                  <Text style={styles.inputLabel}>Stop type</Text>
                  <View style={styles.stopTypeRow}>{STOP_TYPES.map((item) => <Pressable key={item.value} style={[styles.stopTypeChip, stopType === item.value && styles.stopTypeChipActive]} onPress={() => setStopType(item.value)}><Ionicons name={item.icon} size={16} color={stopType === item.value ? '#FFFFFF' : '#94A3B8'} /><Text style={[styles.stopTypeChipText, stopType === item.value && styles.stopTypeChipTextActive]}>{item.label}</Text></Pressable>)}</View>

                  <Text style={styles.inputLabel}>Name</Text>
                  <TextInput value={stopName} onChangeText={setStopName} placeholder="e.g. Pangong Lake" placeholderTextColor="#64748B" style={styles.input} />

                  <Text style={styles.inputLabel}>Label <Text style={styles.optionalLabel}>(optional)</Text></Text>
                  <TextInput value={stopLabel} onChangeText={setStopLabel} placeholder="Stay / Viewpoint / Fuel" placeholderTextColor="#64748B" style={styles.input} />

                  <Text style={styles.inputLabel}>Location</Text>
                  <Pressable style={styles.locationPickerButton} onPress={openLocationPicker}>
                    <View style={styles.locationPickerIcon}><Ionicons name="map-outline" size={19} color="#5EEAD4" /></View>
                    <View style={styles.flexOne}><Text style={styles.locationPickerTitle}>{stopLatitude && stopLongitude ? 'Location selected' : 'Choose location on map'}</Text><Text style={styles.locationPickerSubtitle}>{stopLatitude && stopLongitude ? `${stopLatitude}, ${stopLongitude}` : 'Search a place or tap the map to set the point'}</Text></View>
                    <Ionicons name="chevron-forward" size={18} color="#64748B" />
                  </Pressable>

                  {!!stopAddress && <><Text style={styles.inputLabel}>Address <Text style={styles.optionalLabel}>(optional)</Text></Text><TextInput value={stopAddress} onChangeText={setStopAddress} placeholder="Place or address" placeholderTextColor="#64748B" style={styles.input} /></>}

                  <Text style={styles.inputLabel}>Note <Text style={styles.optionalLabel}>(optional)</Text></Text>
                  <TextInput value={stopNote} onChangeText={setStopNote} placeholder="Any reminder for this stop" placeholderTextColor="#64748B" style={[styles.input, styles.textArea]} multiline textAlignVertical="top" />

                  <Pressable style={[styles.primaryButton, savingStop && styles.disabled]} onPress={() => void saveStop()} disabled={savingStop}>{savingStop ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Ionicons name="checkmark-circle-outline" size={18} color="#FFFFFF" />}<Text style={styles.primaryButtonText}>{editingStop ? 'Save stop' : 'Add stop'}</Text></Pressable>
                </ScrollView>
              </View>
            </KeyboardAvoidingView>
          </View>
        </Modal>

        <Modal visible={showLocationPicker} transparent animationType="slide" onRequestClose={() => setShowLocationPicker(false)}>
          <View style={styles.locationModalOverlay}>
            <View style={styles.locationModalCard}>
              <View style={styles.modalHeader}>
                <View style={styles.flexOne}><Text style={styles.modalTitle}>Choose stop location</Text><Text style={styles.modalSubtitle}>Search a place or tap the map. Roads and place names stay visible while you adjust the point.</Text></View>
                <Pressable style={styles.modalClose} onPress={() => { setPlaceResults([]); setShowLocationPicker(false); }}><Ionicons name="close" size={20} color="#FFFFFF" /></Pressable>
              </View>

              <View style={styles.locationSearchRow}>
                <TextInput value={placeSearch} onChangeText={setPlaceSearch} placeholder="Search a place or address" placeholderTextColor="#64748B" style={styles.locationSearchInput} returnKeyType="search" onSubmitEditing={() => void searchInsidePicker()} />
                <Pressable style={[styles.locationSearchButton, pickerLoadingSearch && styles.disabled]} onPress={() => void searchInsidePicker()} disabled={pickerLoadingSearch}>{pickerLoadingSearch ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Ionicons name="search" size={18} color="#FFFFFF" />}</Pressable>
              </View>

              {!!pickerResults.length && (
                <View style={styles.pickerResultsOverlay}>
                  {pickerResults.map((place) => <Pressable key={place.place_id} style={styles.pickerResultRow} onPress={() => choosePickerResult(place)}><View style={styles.searchResultIcon}><Ionicons name="location-outline" size={16} color="#0EA5A4" /></View><View style={styles.flexOne}><Text style={styles.searchResultName} numberOfLines={1}>{place.name}</Text><Text style={styles.searchResultAddress} numberOfLines={2}>{place.display_name}</Text></View></Pressable>)}
                  <Text style={styles.searchAttribution}>Search data © OpenStreetMap contributors</Text>
                </View>
              )}

              <View style={styles.locationMapWrap}>
                <WebView
                  ref={pickerWebViewRef}
                  source={{ html: pickerHtml, baseUrl: 'https://fairshare.local/' }}
                  style={styles.locationWebView}
                  javaScriptEnabled
                  domStorageEnabled
                  originWhitelist={['*']}
                  setSupportMultipleWindows={false}
                  scrollEnabled={false}
                  onLoadEnd={() => {
                    const pending = pendingPickerFocusRef.current;
                    if (pending) {
                      const script = `window.setSelectedLocation && window.setSelectedLocation(${JSON.stringify(pending.latitude)},${JSON.stringify(pending.longitude)},${JSON.stringify(pending.label)}); true;`;
                      pickerWebViewRef.current?.injectJavaScript(script);
                    }
                  }}
                  onMessage={onPickerMapMessage}
                />
                <View pointerEvents="none" style={styles.mapHintBadge}><Ionicons name="hand-left-outline" size={13} color="#FFFFFF" /><Text style={styles.mapHintText}>{pickerMapTouching ? 'Map controls active' : 'Drag • pinch • tap'}</Text></View>
              </View>

              <View style={styles.selectedLocationCard}>
                <View style={styles.selectedLocationIcon}><Ionicons name="location" size={20} color="#FFFFFF" /></View>
                <View style={styles.flexOne}><Text style={styles.selectedLocationTitle} numberOfLines={1}>{pickerLabel}</Text><Text style={styles.selectedLocationAddress} numberOfLines={2}>{pickerAddress || (pickerLatitude != null && pickerLongitude != null ? 'Exact point selected on map' : 'No location selected yet')}</Text></View>
              </View>

              <View style={styles.locationModalActions}>
                <Pressable style={styles.modalCancel} onPress={() => { setPlaceResults([]); setShowLocationPicker(false); }}><Text style={styles.modalCancelText}>Cancel</Text></Pressable>
                <Pressable style={[styles.modalConfirm, pickerLatitude == null || pickerLongitude == null ? styles.disabled : null]} disabled={pickerLatitude == null || pickerLongitude == null} onPress={usePickerLocation}><Ionicons name="checkmark-circle-outline" size={18} color="#FFFFFF" /><Text style={styles.modalConfirmText}>Use this location</Text></Pressable>
              </View>
            </View>
          </View>
        </Modal>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#0F172A' },
  container: { flex: 1, backgroundColor: '#0F172A' },
  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 55 },
  header: { minHeight: 76, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#1E293B' },
  headerButton: { width: 42, height: 42, borderRadius: 13, backgroundColor: '#1E293B', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#263247' },
  headerCenter: { flex: 1, minWidth: 0, paddingHorizontal: 12 },
  headerEyebrow: { color: '#0EA5A4', fontSize: 9, fontWeight: '900', letterSpacing: 1.1 },
  headerTitle: { color: '#FFFFFF', fontSize: 20, fontWeight: '900', marginTop: 2 },
  headerSubtitle: { color: '#64748B', fontSize: 11, marginTop: 3 },
  flexOne: { flex: 1, minWidth: 0 },
  heroCard: { backgroundColor: '#13283A', borderRadius: 24, padding: 20, marginBottom: 14, borderWidth: 1, borderColor: '#234255' },
  heroIcon: { width: 46, height: 46, borderRadius: 16, backgroundColor: '#0EA5A4', alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  heroEyebrow: { color: '#5EEAD4', fontSize: 10, fontWeight: '900', letterSpacing: 1.1 },
  heroTitle: { color: '#FFFFFF', fontSize: 23, fontWeight: '900', lineHeight: 29, marginTop: 7 },
  heroText: { color: '#9FB3C8', fontSize: 12, lineHeight: 19, marginTop: 8 },
  card: { backgroundColor: '#1E293B', borderRadius: 22, padding: 18, marginBottom: 14 },
  cardCompact: { backgroundColor: '#1E293B', borderRadius: 22, padding: 16, marginBottom: 14 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  sectionTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '900' },
  sectionSubtitle: { color: '#64748B', fontSize: 11, marginTop: 4, lineHeight: 16 },
  dateBadge: { backgroundColor: '#0F172A', borderWidth: 1, borderColor: '#2A3A50', borderRadius: 12, paddingHorizontal: 9, paddingVertical: 7, flexDirection: 'row', alignItems: 'center', gap: 5 },
  dateBadgeText: { color: '#CBD5E1', fontSize: 10, fontWeight: '900' },
  dateRow: { flexDirection: 'row', alignItems: 'center' },
  dateField: { flex: 1, backgroundColor: '#0F172A', borderWidth: 1, borderColor: '#2A3A50', borderRadius: 16, padding: 13, minHeight: 76 },
  dateArrow: { width: 32, alignItems: 'center' },
  fieldCaption: { color: '#64748B', fontSize: 9, fontWeight: '900', letterSpacing: 0.8 },
  fieldValueRow: { flexDirection: 'row', alignItems: 'center', marginTop: 9, gap: 7 },
  dateValue: { color: '#F8FAFC', fontSize: 12, fontWeight: '700', flexShrink: 1 },
  saveJourneyButton: { minHeight: 52, borderRadius: 15, backgroundColor: '#0EA5A4', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 7, marginBottom: 14 },
  saveJourneyButtonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '900' },
  detailsToggle: { flexDirection: 'row', alignItems: 'center' },
  detailsToggleIcon: { width: 36, height: 36, borderRadius: 11, backgroundColor: '#0F172A', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  detailsToggleTitle: { color: '#F8FAFC', fontSize: 14, fontWeight: '800' },
  detailsToggleSubtitle: { color: '#64748B', fontSize: 10, marginTop: 2 },
  detailsBody: { marginTop: 15, paddingTop: 15, borderTopWidth: 1, borderTopColor: '#263247' },
  inputLabel: { color: '#CBD5E1', fontSize: 11, fontWeight: '800', marginTop: 10, marginBottom: 7 },
  optionalLabel: { color: '#64748B', fontWeight: '600' },
  input: { backgroundColor: '#0F172A', borderWidth: 1, borderColor: '#2A3A50', borderRadius: 14, color: '#FFFFFF', minHeight: 48, paddingHorizontal: 13, fontSize: 14 },
  textArea: { minHeight: 86, paddingTop: 12 },
  muted: { color: '#94A3B8', fontSize: 11, lineHeight: 17, marginTop: 4 },
  mutedCenter: { color: '#94A3B8', fontSize: 12, textAlign: 'center', lineHeight: 17, marginTop: 8 },
  title: { color: '#FFFFFF', fontSize: 18, fontWeight: '900' },
  miniStat: { alignItems: 'flex-end' },
  miniStatValue: { color: '#FFFFFF', fontSize: 16, fontWeight: '900' },
  miniStatLabel: { color: '#64748B', fontSize: 9, fontWeight: '800', marginTop: 1 },
  dayChips: { paddingBottom: 4, paddingRight: 8 },
  dayChip: { minWidth: 96, paddingHorizontal: 11, paddingVertical: 10, borderRadius: 14, backgroundColor: '#0F172A', borderWidth: 1, borderColor: '#2A3A50', marginRight: 8, position: 'relative' },
  dayChipActive: { backgroundColor: '#0EA5A4', borderColor: '#0EA5A4' },
  dayChipNumber: { color: '#94A3B8', fontSize: 9, fontWeight: '900', letterSpacing: 0.4 },
  dayChipDate: { color: '#E2E8F0', fontSize: 11, fontWeight: '800', marginTop: 3 },
  dayChipTextActive: { color: '#FFFFFF' },
  dayChipCount: { position: 'absolute', top: 6, right: 6, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: '#1E293B', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  dayChipCountActive: { backgroundColor: 'rgba(255,255,255,0.16)' },
  dayChipCountText: { color: '#64748B', fontSize: 9, fontWeight: '900' },
  dayChipCountTextActive: { color: '#FFFFFF' },
  dayHeaderRow: { flexDirection: 'row', alignItems: 'center', marginTop: 16, marginBottom: 12 },
  dayTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '900' },
  dayDate: { color: '#64748B', fontSize: 11, marginTop: 3 },
  mapButton: { minHeight: 38, borderRadius: 12, backgroundColor: '#0F172A', borderWidth: 1, borderColor: '#334155', paddingHorizontal: 11, flexDirection: 'row', alignItems: 'center', gap: 5 },
  mapButtonText: { color: '#CBD5E1', fontSize: 11, fontWeight: '900' },
  dayEmpty: { backgroundColor: '#0F172A', borderRadius: 18, padding: 22, alignItems: 'center', borderWidth: 1, borderColor: '#243147' },
  dayEmptyIcon: { width: 52, height: 52, borderRadius: 16, backgroundColor: '#13283A', alignItems: 'center', justifyContent: 'center' },
  dayEmptyTitle: { color: '#FFFFFF', fontSize: 15, fontWeight: '900', marginTop: 12 },
  dayEmptyText: { color: '#64748B', fontSize: 11, textAlign: 'center', lineHeight: 17, marginTop: 6 },
  stopCard: { flexDirection: 'row', paddingVertical: 5 },
  stopTimeline: { width: 36, alignItems: 'center' },
  stopNumber: { width: 30, height: 30, borderRadius: 10, backgroundColor: '#0EA5A4', alignItems: 'center', justifyContent: 'center' },
  stopNumberDestination: { backgroundColor: '#F97316' },
  stopNumberText: { color: '#FFFFFF', fontSize: 11, fontWeight: '900' },
  timelineLine: { width: 2, flex: 1, backgroundColor: '#2A3A50', marginTop: 3, minHeight: 16 },
  stopContent: { flex: 1, paddingBottom: 12, paddingLeft: 10 },
  stopType: { color: '#0EA5A4', fontSize: 9, fontWeight: '900', letterSpacing: 0.8 },
  stopName: { color: '#FFFFFF', fontSize: 15, fontWeight: '900', marginTop: 3 },
  stopLabel: { color: '#94A3B8', fontSize: 10, fontWeight: '700', marginTop: 3 },
  stopMeta: { color: '#64748B', fontSize: 10, lineHeight: 15, marginTop: 4 },
  missingCoordsBadge: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#3A2D13', borderRadius: 8, paddingHorizontal: 7, paddingVertical: 5, marginTop: 7 },
  missingCoordsText: { color: '#FBBF24', fontSize: 9, fontWeight: '800' },
  coordText: { color: '#475569', fontSize: 9, marginTop: 6 },
  stopActions: { flexDirection: 'row', alignItems: 'center', marginTop: 9, gap: 6 },
  iconAction: { width: 32, height: 32, borderRadius: 10, backgroundColor: '#0F172A', borderWidth: 1, borderColor: '#243147', alignItems: 'center', justifyContent: 'center' },
  deleteAction: { borderColor: '#522132' },
  outlineAddButton: { minHeight: 46, borderRadius: 13, borderWidth: 1, borderStyle: 'dashed', borderColor: '#315B60', backgroundColor: '#102629', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 7 },
  outlineAddText: { color: '#5EEAD4', fontSize: 11, fontWeight: '900' },
  statsGrid: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  statCard: { flex: 1, backgroundColor: '#1E293B', borderRadius: 17, padding: 14 },
  statValue: { color: '#FFFFFF', fontSize: 18, fontWeight: '900' },
  statLabel: { color: '#64748B', fontSize: 10, fontWeight: '800', marginTop: 3 },
  expensesCard: { backgroundColor: '#13283A', borderRadius: 20, padding: 16, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#234255', marginBottom: 14 },
  expensesIcon: { width: 42, height: 42, borderRadius: 13, backgroundColor: '#0F172A', alignItems: 'center', justifyContent: 'center', marginRight: 11 },
  expensesTitle: { color: '#FFFFFF', fontSize: 13, fontWeight: '900' },
  expensesText: { color: '#7F95A9', fontSize: 10, lineHeight: 15, marginTop: 4 },
  expensesAction: { width: 38, height: 38, borderRadius: 12, backgroundColor: '#0EA5A4', alignItems: 'center', justifyContent: 'center', marginLeft: 8 },
  locationPickerButton: { minHeight: 68, borderRadius: 16, backgroundColor: '#0F172A', borderWidth: 1, borderColor: '#2A3A50', paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  locationPickerIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#13283A', alignItems: 'center', justifyContent: 'center' },
  locationPickerTitle: { color: '#F8FAFC', fontSize: 12, fontWeight: '900' },
  locationPickerSubtitle: { color: '#64748B', fontSize: 9, lineHeight: 14, marginTop: 3 },
  searchResultsCard: { backgroundColor: '#0F172A', borderRadius: 14, borderWidth: 1, borderColor: '#263247', marginTop: 8, overflow: 'hidden' },
  searchResultRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: '#1E293B', gap: 10 },
  searchResultIcon: { width: 34, height: 34, borderRadius: 11, backgroundColor: '#13283A', alignItems: 'center', justifyContent: 'center' },
  searchResultName: { color: '#FFFFFF', fontSize: 12, fontWeight: '900' },
  searchResultAddress: { color: '#94A3B8', fontSize: 9, lineHeight: 14, marginTop: 3 },
  searchAttribution: { color: '#475569', fontSize: 8, lineHeight: 12, paddingHorizontal: 12, paddingVertical: 8 },
  stopFormScroll: { maxHeight: 560 },
  stopFormContent: { paddingBottom: 12 },
  stopTypeRow: { flexDirection: 'row', gap: 7 },
  stopTypeChip: { flex: 1, minHeight: 44, borderRadius: 12, backgroundColor: '#0F172A', borderWidth: 1, borderColor: '#2A3A50', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 5 },
  stopTypeChipActive: { backgroundColor: '#0EA5A4', borderColor: '#0EA5A4' },
  stopTypeChipText: { color: '#94A3B8', fontSize: 10, fontWeight: '800' },
  stopTypeChipTextActive: { color: '#FFFFFF' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(2,6,23,.82)', justifyContent: 'flex-end' },
  modalKeyboard: { width: '100%' },
  datePickerCard: { backgroundColor: '#1E293B', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 18, paddingBottom: 28 },
  stopModalCard: { backgroundColor: '#1E293B', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 18, maxHeight: '92%' },
  modalHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },
  modalTitle: { color: '#FFFFFF', fontSize: 20, fontWeight: '900' },
  modalSubtitle: { color: '#64748B', fontSize: 11, lineHeight: 16, marginTop: 4 },
  modalClose: { width: 36, height: 36, borderRadius: 11, backgroundColor: '#0F172A', alignItems: 'center', justifyContent: 'center' },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  modalCancel: { flex: 1, minHeight: 48, borderRadius: 13, backgroundColor: '#0F172A', borderWidth: 1, borderColor: '#334155', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 },
  modalConfirm: { flex: 1.35, minHeight: 48, borderRadius: 13, backgroundColor: '#0EA5A4', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 7 },
  modalCancelText: { color: '#CBD5E1', fontSize: 13, fontWeight: '800' },
  modalConfirmText: { color: '#FFFFFF', fontSize: 13, fontWeight: '900' },
  modalDayRow: { paddingBottom: 4, paddingRight: 8 },
  modalDayChip: { minWidth: 84, paddingHorizontal: 9, paddingVertical: 9, borderRadius: 12, backgroundColor: '#0F172A', borderWidth: 1, borderColor: '#2A3A50', marginRight: 8 },
  modalDayChipActive: { backgroundColor: '#0EA5A4', borderColor: '#0EA5A4' },
  modalDayChipText: { color: '#CBD5E1', fontSize: 10, fontWeight: '900' },
  modalDayChipTextActive: { color: '#FFFFFF' },
  modalDayChipDate: { color: '#64748B', fontSize: 9, marginTop: 3 },
  modalDayChipDateActive: { color: '#E6FFFB' },
  primaryButton: { minHeight: 50, borderRadius: 15, backgroundColor: '#0EA5A4', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 7, marginTop: 14 },
  primaryButtonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '900' },
  disabled: { opacity: 0.55 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { color: '#FFFFFF', fontSize: 19, fontWeight: '900' },
  locationModalOverlay: { flex: 1, backgroundColor: 'rgba(2,6,23,.84)', justifyContent: 'flex-end' },
  locationModalCard: { backgroundColor: '#1E293B', borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 16, paddingBottom: Platform.OS === 'ios' ? 26 : 18, maxHeight: '94%' },
  locationSearchRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  locationSearchInput: { flex: 1, minHeight: 50, borderRadius: 15, backgroundColor: '#0F172A', borderWidth: 1, borderColor: '#2A3A50', color: '#FFFFFF', paddingHorizontal: 14, fontSize: 14 },
  locationSearchButton: { width: 52, minHeight: 50, borderRadius: 15, backgroundColor: '#0EA5A4', alignItems: 'center', justifyContent: 'center' },
  pickerResultsOverlay: { backgroundColor: '#0F172A', borderRadius: 14, borderWidth: 1, borderColor: '#263247', overflow: 'hidden', marginBottom: 10 },
  pickerResultRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 11, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#1E293B' },
  locationMapWrap: { height: 355, borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: '#2A3A50', backgroundColor: '#0F172A', position: 'relative' },
  locationWebView: { flex: 1, backgroundColor: '#DDE7F0' },
  mapHintBadge: { position: 'absolute', left: 10, bottom: 10, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(15,23,42,.90)', borderRadius: 12, paddingHorizontal: 11, paddingVertical: 8 },
  mapHintText: { color: '#FFFFFF', fontSize: 9, fontWeight: '900' },
  selectedLocationCard: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#0F172A', borderRadius: 15, padding: 12, marginTop: 10, borderWidth: 1, borderColor: '#2A3A50' },
  selectedLocationIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#0EA5A4', alignItems: 'center', justifyContent: 'center' },
  selectedLocationTitle: { color: '#FFFFFF', fontSize: 13, fontWeight: '900' },
  selectedLocationAddress: { color: '#94A3B8', fontSize: 9, lineHeight: 14, marginTop: 3 },
  locationModalActions: { flexDirection: 'row', gap: 9, marginTop: 10 },
});
