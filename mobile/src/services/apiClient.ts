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
let accessToken: string | null = null;
let accessTokenInitialized = false;

// Supabase keeps the session persisted locally. Keep the access token in memory
// so ordinary FairShare API requests do not hit storage for every request.
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
        if (error) throw new ApiError(error.message, 401);
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
    throw new ApiError('Your session has expired. Please sign in again.', 401);
  }
  return token;
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
  const token = await getAccessToken();
  const method = options.method || 'GET';
  const started = globalThis.performance?.now?.() ?? Date.now();

  let response: Response;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      method,
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
  } catch (error: any) {
    if (error?.name === 'AbortError') throw error;
    throw new ApiError(
      'Unable to reach the FairShare server. Check that the backend is running and the API URL is correct.',
      0,
      error,
    );
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
      `[FairShare] ${method} ${path} ${Math.round(ended - started)}ms client / ${serverMs || '?'}ms server (${response.status})`,
    );
  }

  if (!response.ok) {
    const detail =
      typeof payload === 'string'
        ? payload
        : payload?.detail || payload?.message || `Request failed (${response.status}).`;
    throw new ApiError(detail, response.status, payload);
  }

  if (response.status === 204) return undefined as T;
  return payload as T;
}
