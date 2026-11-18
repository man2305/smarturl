/** Base path of the backend API (Vite proxy handles /api in dev). */
export const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? '/api';

// In a production build served from a different origin than the API, the
// '/api' fallback silently hits the frontend host — which rewrites every
// path to index.html — so each API call returns HTML and fails with a
// confusing error. Fail loudly at boot instead.
if (import.meta.env.PROD && !import.meta.env.VITE_API_URL) {
  console.error(
    '[smarturl] VITE_API_URL is not set: API calls will target this origin and fail. ' +
      'Set VITE_API_URL to the backend URL and rebuild.'
  );
}

export const THEME_STORAGE_KEY = 'smarturl:theme';
