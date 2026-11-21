import { apiRequest } from './apiClient';

export type PlaceSearchResult = {
  place_id: string;
  name: string;
  display_name: string;
  subtitle?: string | null;
  address: string | null;
  latitude: number;
  longitude: number;
  category: string | null;
  type: string | null;
  icon_type?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  match_type?: string | null;
};

export type PlaceSearchResponse = {
  query: string;
  did_you_mean?: string | null;
  results: PlaceSearchResult[];
  attribution: string;
};

export async function searchPlaces(query: string) {
  try {
    const data = await apiRequest<PlaceSearchResponse>(
      `/places/search?q=${encodeURIComponent(query.trim())}`
    );
    return { data, error: null };
  } catch (error: any) {
    return { data: null, error };
  }
}
