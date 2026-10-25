export const TOKEN_KEY = 'medqr_token';

const normalizeApiBase = (rawUrl?: string): string => {
  const trimmed = (rawUrl || '').trim().replace(/\/+$/, '');
  if (!trimmed) {
    if (
      import.meta.env.PROD &&
      typeof window !== 'undefined' &&
      window.location.hostname !== 'localhost' &&
      window.location.hostname !== '127.0.0.1'
    ) {
      console.error(
        '[MedQR+] VITE_API_URL is not set in production. Set VITE_API_URL to your hosted backend URL (e.g. https://medqr-backend.onrender.com/api).'
      );
    }
    return '/api';
  }
  if ((trimmed.startsWith('http://') || trimmed.startsWith('https://')) && !trimmed.endsWith('/api')) {
    return `${trimmed}/api`;
  }
  return trimmed;
};

export const API_BASE = normalizeApiBase(import.meta.env.VITE_API_URL);

/**
 * Builds request headers with `Authorization: Bearer <token>` when a JWT is present in localStorage,
 * plus any custom headers passed by the caller.
 */
export const getAuthHeaders = (extraHeaders?: HeadersInit): Record<string, string> => {
  const token = localStorage.getItem(TOKEN_KEY);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  if (extraHeaders) {
    if (extraHeaders instanceof Headers) {
      extraHeaders.forEach((value, key) => {
        headers[key] = value;
      });
    } else if (Array.isArray(extraHeaders)) {
      for (const [key, value] of extraHeaders) {
        headers[key] = value;
      }
    } else {
      Object.assign(headers, extraHeaders);
    }
  }

  return headers;
};

/**
 * Resolves an API endpoint path against the shared `API_BASE` (`VITE_API_URL || '/api'`).
 */
export const resolveApiUrl = (pathOrUrl: string): string => {
  if (pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://')) {
    return pathOrUrl;
  }
  if (pathOrUrl.startsWith(API_BASE)) {
    return pathOrUrl;
  }
  if (pathOrUrl.startsWith('/api/')) {
    return `${API_BASE}${pathOrUrl.slice(4)}`;
  }
  return `${API_BASE}${pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`}`;
};

/**
 * Shared fetch helper that resolves paths against `API_BASE` and automatically attaches
 * `Authorization: Bearer <token>` and JSON headers to every backend API request.
 */
export const apiFetch = (input: string, init: RequestInit = {}): Promise<Response> => {
  const headers = getAuthHeaders(init.headers);
  return fetch(resolveApiUrl(input), {
    ...init,
    headers,
  });
};
