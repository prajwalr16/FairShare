import { apiRequest } from './apiClient';

export type RouteStop = {
  stop_id: string;
  sequence: number;
  day_number: number;
  latitude: number;
  longitude: number;
  name: string;
  stop_type: 'start' | 'stop' | 'destination';
};

export type RouteGeometryPoint = {
  latitude: number;
  longitude: number;
};

export type RouteSnappedStop = {
  stop_id: string;
  latitude: number;
  longitude: number;
};

export type TripRoute = {
  day_number: number | null;
  distance_meters: number;
  duration_seconds: number;
  stops: RouteStop[];
  geometry: RouteGeometryPoint[];
  snapped_stops: RouteSnappedStop[];
};

const routeCache = new Map<string, TripRoute>();
const routeRequests = new Map<string, Promise<{ data: TripRoute | null; error: any }>>();

function cacheKey(groupId: string, dayNumber?: number | null) {
  return `${groupId}:${dayNumber ?? 'all'}`;
}

export function getCachedTripRoute(groupId: string, dayNumber?: number | null) {
  return routeCache.get(cacheKey(groupId, dayNumber)) || null;
}

export function invalidateTripRoute(groupId: string) {
  for (const key of routeCache.keys()) {
    if (key.startsWith(`${groupId}:`)) routeCache.delete(key);
  }
}

export async function getTripRoute(
  groupId: string,
  dayNumber?: number | null,
  force = false,
  signal?: AbortSignal,
) {
  const key = cacheKey(groupId, dayNumber);

  if (!force && !signal) {
    const cached = routeCache.get(key);
    if (cached) return { data: cached, error: null };

    const inFlight = routeRequests.get(key);
    if (inFlight) return inFlight;
  }

  const suffix = dayNumber ? `?day=${encodeURIComponent(dayNumber)}` : '';
  const request = (async () => {
    try {
      const data = await apiRequest<TripRoute>(`/groups/${groupId}/trip/route${suffix}`, { signal });
      routeCache.set(key, data);
      return { data, error: null };
    } catch (error: any) {
      return { data: null, error };
    }
  })();

  if (!force && !signal) routeRequests.set(key, request);
  try {
    return await request;
  } finally {
    if (routeRequests.get(key) === request) routeRequests.delete(key);
  }
}
