import { supabase } from '../config/supabase';
import { assertApiConfigured } from '../config/api';

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
      'Unable to reach the FairShare server. Check that the backend is running and the API URL is correct.',
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
        'Unable to reach the FairShare server. Check that the backend is running and the API URL is correct.',
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
    const detail =
      typeof payload === 'string'
        ? payload
        : payload?.detail ||
          payload?.message ||
          `Request failed (${response.status}).`;

    throw new ApiError(detail, response.status, payload);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return payload as T;
}
