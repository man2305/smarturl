/** Base path of the backend API (Vite proxy handles /api in dev). */
export const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? '/api';

/** Storage key for the persisted theme. */
export const THEME_STORAGE_KEY = 'smarturl:theme';
