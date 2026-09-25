
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
  distance_meters: number;
};

export type RouteLeg = {
  from_stop_id: string;
  to_stop_id: string;
  distance_meters: number;
  duration_seconds: number;
  points: RouteGeometryPoint[];
  status: 'routed' | 'fallback' | 'unroutable';
  routed: boolean;
  fallback: boolean;
};

export type TripRoute = {
  day_number: number | null;
  distance_meters: number;
  duration_seconds: number;
  stops: RouteStop[];
  geometry: RouteGeometryPoint[];
  snapped_stops: RouteSnappedStop[];
  legs: RouteLeg[];
  has_fallback_legs: boolean;
  has_non_routed_legs: boolean;
  warning: string | null;
};

const ROUTE_CACHE_VERSION = 'v10-individual-legs';

const routeCache = new Map<string, TripRoute>();
const routeRequests = new Map<
  string,
  Promise<{ data: TripRoute | null; error: any }>
>();

function cacheKey(groupId: string, dayNumber?: number | null) {
  return `${ROUTE_CACHE_VERSION}:${groupId}:${dayNumber ?? 'all'}`;
}

export function getCachedTripRoute(
  groupId: string,
  dayNumber?: number | null,
) {
  return routeCache.get(cacheKey(groupId, dayNumber)) || null;
}

export function invalidateTripRoute(groupId: string) {
  for (const key of routeCache.keys()) {
    if (key.includes(`:${groupId}:`)) {
      routeCache.delete(key);
    }
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

  const suffix =
    dayNumber != null
      ? `?day=${encodeURIComponent(dayNumber)}`
      : '';

  const request = (async () => {
    try {
      const data = await apiRequest<TripRoute>(
        `/groups/${groupId}/trip/route${suffix}`,
        { signal },
      );
      routeCache.set(key, data);
      return { data, error: null };
    } catch (error: any) {
      return { data: null, error };
    }
  })();

  if (!force && !signal) {
    routeRequests.set(key, request);
  }

  try {
    return await request;
  } finally {
    if (routeRequests.get(key) === request) {
      routeRequests.delete(key);
    }
  }
}
