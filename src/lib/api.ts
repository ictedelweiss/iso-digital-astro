/**
 * Standard client API fetch helper (M-07).
 *
 * Ensures all API calls use credentials: 'same-origin' to respect CSRF policy,
 * handles JSON encoding and decoding, and throws typed ApiError with status codes.
 */

export class ApiError extends Error {
  status: number;
  data: any;

  constructor(status: number, message: string, data?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

interface RequestOptions extends RequestInit {
  params?: Record<string, string | number | boolean | undefined | null>;
}

export async function apiFetch<T = any>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const { params, headers, body, ...customConfig } = options;

  let url = endpoint;
  if (params) {
    const searchParams = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== '') {
        searchParams.append(key, String(value));
      }
    }
    const queryString = searchParams.toString();
    if (queryString) {
      url += (url.includes('?') ? '&' : '?') + queryString;
    }
  }

  const isJsonBody = body && typeof body === 'object' && !(body instanceof FormData) && !(body instanceof Blob);

  const config: RequestInit = {
    method: options.method || 'GET',
    credentials: 'same-origin',
    headers: {
      ...(isJsonBody ? { 'Content-Type': 'application/json' } : {}),
      ...headers,
    },
    body: isJsonBody ? JSON.stringify(body) : (body as BodyInit),
    ...customConfig,
  };

  const response = await fetch(url, config);

  let responseData: any = null;
  const contentType = response.headers.get('Content-Type');
  if (contentType && contentType.includes('application/json')) {
    try {
      responseData = await response.json();
    } catch {
      responseData = null;
    }
  } else {
    try {
      responseData = await response.text();
    } catch {
      responseData = null;
    }
  }

  if (!response.ok) {
    const errorMessage =
      (responseData && typeof responseData === 'object' && responseData.error) ||
      (typeof responseData === 'string' && responseData) ||
      `Request failed with status ${response.status}`;
    throw new ApiError(response.status, errorMessage, responseData);
  }

  return responseData as T;
}
