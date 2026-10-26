export const TOKEN_KEY = 'medqr_token';

const normalizeApiBase = (rawUrl?: string): string => {
  const trimmed = (rawUrl || '').trim().replace(/\/+$/, '');
  if (!trimmed) {
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

const getDirectLocalFallbackUrls = (resolvedPath: string): string[] => {
  if (!resolvedPath.startsWith('/api/') || typeof window === 'undefined') {
    return [];
  }
  const { protocol, hostname } = window.location;
  const candidates: string[] = [];

  if (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname.startsWith('10.') ||
    hostname.startsWith('192.168.') ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname)
  ) {
    candidates.push(`${protocol === 'https:' ? 'http:' : protocol}//${hostname}:5000${resolvedPath}`);
  }

  if (!candidates.includes(`http://127.0.0.1:5000${resolvedPath}`)) {
    candidates.push(`http://127.0.0.1:5000${resolvedPath}`);
  }
  if (!candidates.includes(`http://localhost:5000${resolvedPath}`)) {
    candidates.push(`http://localhost:5000${resolvedPath}`);
  }

  return candidates;
};

/**
 * Shared fetch helper that resolves paths against `API_BASE`, attaches `Authorization: Bearer <token>`,
 * and automatically falls back to direct local backend URLs (`127.0.0.1:5000` / `localhost:5000`) if a
 * relative `/api/...` proxy call fails or hits a static host without a backend rewrite.
 */
export const apiFetch = async (input: string, init: RequestInit = {}): Promise<Response> => {
  const headers = getAuthHeaders(init.headers);
  const resolvedUrl = resolveApiUrl(input);
  const requestInit: RequestInit = {
    ...init,
    headers,
  };

  try {
    const res = await fetch(resolvedUrl, requestInit);
    const contentType = (res.headers.get('content-type') || '').toLowerCase();
    const isJson = contentType.includes('application/json');
    const isProxyOrStaticHostMiss =
      resolvedUrl.startsWith('/api/') &&
      !isJson &&
      (res.status === 404 ||
        res.status === 405 ||
        res.status === 502 ||
        res.status === 503 ||
        res.status === 504);

    if (!isProxyOrStaticHostMiss) {
      return res;
    }
  } catch (primaryErr) {
    const fallbacks = getDirectLocalFallbackUrls(resolvedUrl);
    if (fallbacks.length === 0) {
      throw primaryErr;
    }
    for (const fallbackUrl of fallbacks) {
      try {
        return await fetch(fallbackUrl, requestInit);
      } catch {
        // Try next candidate
      }
    }
    throw primaryErr;
  }

  const fallbacks = getDirectLocalFallbackUrls(resolvedUrl);
  for (const fallbackUrl of fallbacks) {
    try {
      return await fetch(fallbackUrl, requestInit);
    } catch {
      // Try next candidate
    }
  }

  return fetch(resolvedUrl, requestInit);
};
