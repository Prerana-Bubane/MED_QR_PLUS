export const TOKEN_KEY = 'medqr_token';

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
 * Shared fetch helper that automatically attaches `Authorization: Bearer <token>`
 * and JSON headers to every backend API request.
 */
export const apiFetch = (input: string, init: RequestInit = {}): Promise<Response> => {
  const headers = getAuthHeaders(init.headers);
  return fetch(input, {
    ...init,
    headers,
  });
};
