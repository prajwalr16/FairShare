import { apiRequest } from './apiClient';

export type PlaceSearchResult = {
  place_id: string;
  name: string;
  display_name: string;
  address: string | null;
  latitude: number;
  longitude: number;
  category: string | null;
  type: string | null;
};

export async function searchPlaces(query: string) {
  try {
    const data = await apiRequest<{
      query: string;
      results: PlaceSearchResult[];
      attribution: string;
    }>(`/places/search?q=${encodeURIComponent(query.trim())}`);
    return { data, error: null };
  } catch (error: any) {
    return { data: null, error };
  }
}
