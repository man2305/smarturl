import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { API_BASE } from '@/lib/constants';

interface RetriableConfig extends InternalAxiosRequestConfig {
  _retry?: boolean;
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
let refreshPromise: Promise<string> | null = null;

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

async function refreshAccessToken(): Promise<string> {
  if (!refreshPromise) {
    refreshPromise = axios
      .post(`${API_BASE}/auth/refresh`, {}, { withCredentials: true })
      .then((res) => {
        const token = res.data?.data?.accessToken as string | undefined;
        if (!token) throw new Error('No access token in refresh response');
        setAccessToken(token);
        return token;
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
        const token = await refreshAccessToken();
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
