import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { API_BASE } from '@/lib/constants';
import type { User } from '@/types';

interface RetriableConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
}

/** What POST /auth/refresh returns: the user plus a fresh access token. */
export interface RefreshSessionPayload {
  user: User;
  accessToken: string;
}

/**
 * Central axios instance.
 * - `withCredentials` lets the httpOnly refresh cookie travel to the server.
 * - A response interceptor transparently refreshes the access token on 401
 *   (single-flight) and retries the original request.
 */
const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
  timeout: 15000,
});

let accessToken: string | null = null;
let refreshPromise: Promise<RefreshSessionPayload> | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

/** Emitted when a refresh fails and the session must be cleared. */
export function emitUnauthorized(): void {
  window.dispatchEvent(new CustomEvent('auth:unauthorized'));
}

api.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

/**
 * Single-flighted refresh shared by the boot restore (auth-context) and
 * the 401 interceptor below. The backend rotates refresh tokens, so two
 * uncoordinated refreshes with the same token race: the loser gets a 401
 * and looks like a dead session (StrictMode double-mounts the boot effect
 * in dev; two tabs can boot at once in production). Sharing one promise
 * makes every concurrent refresh a single server call.
 */
export async function refreshSession(): Promise<RefreshSessionPayload> {
  if (!refreshPromise) {
    refreshPromise = axios
      .post(`${API_BASE}/auth/refresh`, {}, { withCredentials: true })
      .then((res) => {
        const payload = res.data?.data as RefreshSessionPayload | undefined;
        if (!payload?.accessToken) throw new Error('No access token in refresh response');
        setAccessToken(payload.accessToken);
        return payload;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as RetriableConfig | undefined;
    const url = original?.url ?? '';
    const isAuthEndpoint = url.startsWith('/auth/');

    if (error.response?.status === 401 && original && !original._retry && !isAuthEndpoint) {
      original._retry = true;
      try {
        const { accessToken: token } = await refreshSession();
        original.headers.Authorization = `Bearer ${token}`;
        return api(original);
      } catch {
        setAccessToken(null);
        emitUnauthorized();
      }
    }
    return Promise.reject(error);
  }
);

export default api;
