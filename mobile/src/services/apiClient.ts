import { supabase } from '../config/supabase';
import { API_BASE_URL, assertApiConfigured } from '../config/api';

export function warmUpBackend(): void {
  try {
    if (API_BASE_URL) {
      void fetch(`${API_BASE_URL}/health?db=1`, { method: 'GET' }).catch(() => {});
    }
  } catch {
    // Non-blocking warm-up
  }
}

// Trigger initial warm-up ping immediately when module is loaded
warmUpBackend();

export class ApiError extends Error {
  status: number;
  details?: unknown;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

let sessionLookup: Promise<string | null> | null = null;
let refreshPromise: Promise<string | null> | null = null;
let localSignOutPromise: Promise<void> | null = null;
let accessToken: string | null = null;
let accessTokenInitialized = false;

supabase.auth.onAuthStateChange((_event, session) => {
  accessToken = session?.access_token || null;
  accessTokenInitialized = true;
});

async function getAccessToken(): Promise<string> {
  if (accessTokenInitialized && accessToken) {
    return accessToken;
  }

  if (!sessionLookup) {
    sessionLookup = supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (error) {
          throw new ApiError(error.message, 401);
        }

        accessToken = data.session?.access_token || null;
        accessTokenInitialized = true;
        return accessToken;
      })
      .finally(() => {
        sessionLookup = null;
      });
  }

  const token = await sessionLookup;

  if (!token) {
    throw new ApiError('Please sign in to continue.', 401);
  }

  return token;
}

async function refreshAccessToken(): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const { data, error } = await supabase.auth.refreshSession();

        if (error) {
          return null;
        }

        accessToken = data.session?.access_token || null;
        accessTokenInitialized = true;
        return accessToken;
      } catch {
        return null;
      } finally {
        refreshPromise = null;
      }
    })();
  }

  return refreshPromise;
}

async function forceLocalSignOut(): Promise<void> {
  accessToken = null;
  accessTokenInitialized = true;

  if (!localSignOutPromise) {
    localSignOutPromise = supabase.auth
      .signOut({ scope: 'local' })
      .then(() => undefined)
      .catch(() => undefined)
      .finally(() => {
        localSignOutPromise = null;
      });
  }

  await localSignOutPromise;
}

async function performRequest(
  baseUrl: string,
  path: string,
  token: string,
  options: {
    method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    body?: unknown;
    signal?: AbortSignal;
  },
) {
  return fetch(`${baseUrl}${path}`, {
    method: options.method || 'GET',
    signal: options.signal,
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options.body !== undefined
        ? { 'Content-Type': 'application/json' }
        : {}),
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
}

function cleanApiErrorMessage(rawDetail: unknown, status: number, payload: any): string {
  // 1. Array of Pydantic validation errors (FastAPI 422)
  if (Array.isArray(rawDetail)) {
    const formatted = rawDetail
      .map((item: any) => {
        const loc = Array.isArray(item.loc)
          ? item.loc.filter((p: any) => p !== 'body' && p !== 'query' && p !== 'path').join(' ')
          : '';
        const field = loc ? loc.replace(/_/g, ' ') : '';
        const fieldCapitalized = field ? field.charAt(0).toUpperCase() + field.slice(1) : '';
        return fieldCapitalized ? `${fieldCapitalized}: ${item.msg}` : item.msg;
      })
      .filter(Boolean)
      .join('. ');
    if (formatted) return formatted;
  }

  let text = typeof rawDetail === 'string' ? rawDetail.trim() : '';

  if (!text && payload && typeof payload === 'object') {
    text = payload.detail || payload.message || payload.error || '';
  }

  // 2. Parse stringified JSON if detail is a raw JSON string
  if (text.startsWith('{') && text.endsWith('}')) {
    try {
      const parsed = JSON.parse(text);
      text = parsed.detail || parsed.message || parsed.msg || text;
    } catch {}
  }

  const lower = text.toLowerCase();

  // 3. Status Code specific translations
  if (status === 401) {
    return 'Your session has expired. Please sign in again to continue.';
  }

  if (status === 403) {
    if (!text || lower === 'forbidden') {
      return 'Access denied. You do not have permission to perform this action. Only group administrators can edit settings or remove members.';
    }
  }

  if (status === 404) {
    if (!text || lower === 'not found') {
      return 'The requested group, member, or expense could not be found. It may have already been deleted.';
    }
  }

  if (status === 409) {
    if (lower.includes('start') && lower.includes('stop')) {
      return 'A start stop already exists for this trip. Each journey can only have one starting location.';
    }
    if (lower.includes('destination') && lower.includes('stop')) {
      return 'A destination stop already exists for this trip. Each journey can only have one destination.';
    }
    if (lower.includes('balance') || lower.includes('settle')) {
      return 'This member cannot be removed because they still have an unsettled balance. Please record a settlement first.';
    }
    if (lower.includes('already a member') || lower.includes('already exists')) {
      return 'This person is already a member of this group.';
    }
  }

  if (status === 429) {
    if (lower.includes('email') || lower.includes('rate limit')) {
      return 'Hourly limit reached. Supabase has temporarily capped automated verification emails. If you are adding members, they can be added directly as placeholder members without waiting!';
    }
    return 'Too many requests. Please wait a moment before trying again.';
  }

  if (status >= 500) {
    return 'FairShare cloud servers are temporarily busy or warming up. Please wait 5 seconds and retry.';
  }

  if (text) {
    return text;
  }

  return `Request could not be completed (${status || 'network error'}). Please check your connection and try again.`;
}

export async function apiRequest<T>(
  path: string,
  options: {
    method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    body?: unknown;
    signal?: AbortSignal;
  } = {},
): Promise<T> {
  const baseUrl = assertApiConfigured();
  const started = globalThis.performance?.now?.() ?? Date.now();

  let token = await getAccessToken();
  let response: Response;

  try {
    response = await performRequest(baseUrl, path, token, options);
  } catch (error: any) {
    if (error?.name === 'AbortError') {
      throw error;
    }

    throw new ApiError(
      'Unable to connect to FairShare servers. Please check your internet connection or try again in a few moments.',
      0,
      error,
    );
  }

  if (response.status === 401) {
    const refreshedToken = await refreshAccessToken();

    if (!refreshedToken) {
      await forceLocalSignOut();
      throw new ApiError('Your session has expired. Please sign in again.', 401);
    }

    token = refreshedToken;

    try {
      response = await performRequest(baseUrl, path, token, options);
    } catch (error: any) {
      if (error?.name === 'AbortError') {
        throw error;
      }

      throw new ApiError(
        'Unable to connect to FairShare servers. Please check your internet connection or try again in a few moments.',
        0,
        error,
      );
    }

    if (response.status === 401) {
      await forceLocalSignOut();
    }
  }

  const raw = await response.text();
  let payload: any = null;

  if (raw) {
    try {
      payload = JSON.parse(raw);
    } catch {
      payload = raw;
    }
  }

  if (__DEV__) {
    const ended = globalThis.performance?.now?.() ?? Date.now();
    const serverMs = response.headers.get('x-response-time-ms');

    console.debug(
      `[FairShare] ${options.method || 'GET'} ${path} ${Math.round(
        ended - started,
      )}ms client / ${serverMs || '?'}ms server (${response.status})`,
    );
  }

  if (!response.ok) {
    const detail = cleanApiErrorMessage(payload?.detail, response.status, payload);
    throw new ApiError(detail, response.status, payload);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return payload as T;
}
