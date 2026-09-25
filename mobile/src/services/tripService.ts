import { apiRequest } from './apiClient';

export type TripStopType = 'start' | 'stop' | 'destination';

export type TripStop = {
  id: string;
  trip_id: string;
  sequence: number;
  day_number: number;
  stop_type: TripStopType;
  name: string;
  label: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  note: string | null;
  created_at: string;
  updated_at: string;
};

export type Trip = {
  id: string;
  group_id: string;
  start_date: string | null;
  end_date: string | null;
  timezone: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  stops: TripStop[];
};

export type TripPayload = {
  start_date?: string | null;
  end_date?: string | null;
  timezone?: string | null;
  notes?: string | null;
};

export type TripStopPayload = {
  stop_type: TripStopType;
  day_number?: number;
  name: string;
  label?: string | null;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  note?: string | null;
};

const tripCache = new Map<string, Trip>();
const tripRequests = new Map<string, Promise<{ data: Trip | null; error: any }>>();

export function getCachedTrip(groupId: string) {
  return tripCache.get(groupId) || null;
}

export function invalidateTrip(groupId: string) {
  tripCache.delete(groupId);
}

export async function getTrip(groupId: string, force = false, signal?: AbortSignal) {
  if (!force && !signal) {
    const cached = tripCache.get(groupId);
    if (cached) return { data: cached, error: null };

    const inFlight = tripRequests.get(groupId);
    if (inFlight) return inFlight;
  }

  const request = (async () => {
    try {
      const data = await apiRequest<Trip>(`/groups/${groupId}/trip`, { signal });
      tripCache.set(groupId, data);
      return { data, error: null };
    } catch (error: any) {
      return { data: null, error };
    }
  })();

  if (!force && !signal) tripRequests.set(groupId, request);
  try {
    return await request;
  } finally {
    if (tripRequests.get(groupId) === request) tripRequests.delete(groupId);
  }
}

export async function createTrip(groupId: string, payload: TripPayload = {}) {
  try {
    const data = await apiRequest<Trip>(`/groups/${groupId}/trip`, {
      method: 'POST',
      body: payload,
    });
    tripCache.set(groupId, data);
    return { data, error: null };
  } catch (error: any) {
    return { data: null, error };
  }
}

export async function updateTrip(groupId: string, payload: TripPayload) {
  try {
    const data = await apiRequest<Trip>(`/groups/${groupId}/trip`, {
      method: 'PATCH',
      body: payload,
    });
    tripCache.set(groupId, data);
    return { data, error: null };
  } catch (error: any) {
    return { data: null, error };
  }
}

export async function deleteTrip(groupId: string) {
  try {
    await apiRequest<void>(`/groups/${groupId}/trip`, { method: 'DELETE' });
    invalidateTrip(groupId);
    return { error: null };
  } catch (error: any) {
    return { error };
  }
}

export async function addTripStop(groupId: string, payload: TripStopPayload) {
  try {
    const data = await apiRequest<TripStop>(`/groups/${groupId}/trip/stops`, {
      method: 'POST',
      body: { ...payload, day_number: payload.day_number || 1 },
    });
    invalidateTrip(groupId);
    return { data, error: null };
  } catch (error: any) {
    return { data: null, error };
  }
}

export async function updateTripStop(
  groupId: string,
  stopId: string,
  payload: TripStopPayload,
) {
  try {
    const data = await apiRequest<TripStop>(`/groups/${groupId}/trip/stops/${stopId}`, {
      method: 'PATCH',
      body: { ...payload, day_number: payload.day_number || 1 },
    });
    invalidateTrip(groupId);
    return { data, error: null };
  } catch (error: any) {
    return { data: null, error };
  }
}

export async function deleteTripStop(groupId: string, stopId: string) {
  try {
    await apiRequest<void>(`/groups/${groupId}/trip/stops/${stopId}`, { method: 'DELETE' });
    invalidateTrip(groupId);
    return { error: null };
  } catch (error: any) {
    return { error };
  }
}

export async function reorderTripStops(groupId: string, stopIds: string[]) {
  try {
    const data = await apiRequest<TripStop[]>(`/groups/${groupId}/trip/stops/reorder`, {
      method: 'PUT',
      body: { stop_ids: stopIds },
    });
    invalidateTrip(groupId);
    return { data, error: null };
  } catch (error: any) {
    return { data: null, error };
  }
}
