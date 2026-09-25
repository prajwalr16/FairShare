const configuredApiUrl = process.env.EXPO_PUBLIC_API_URL?.trim();

export const API_BASE_URL = configuredApiUrl
  ? configuredApiUrl.replace(/\/+$/, '')
  : '';

export function assertApiConfigured(): string {
  if (!API_BASE_URL) {
    throw new Error(
      'FairShare API is not configured. Set EXPO_PUBLIC_API_URL in mobile/.env.',
    );
  }
  return API_BASE_URL;
}
