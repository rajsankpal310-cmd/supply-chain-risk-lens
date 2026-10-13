// Centralized API client.
// Production/direct API calls hit the real REST backend (http://localhost:5000/api).
// When VITE_USE_MOCK_API=true, services resolve against the local mock layer.

/**
 * Normalizes and builds the target API URL.
 * Ensures production/direct API calls resolve exactly to http://localhost:5000/api/...
 * Guarantees proper /api prefix handling and prevents duplicate /api prefixes (/api/api/...).
 */
export function buildApiUrl(path: string, overrideBaseUrl?: string): string {
  const isDev = Boolean(import.meta.env?.DEV);
  const rawBase = (
    overrideBaseUrl ??
    (import.meta.env?.['VITE_API_BASE_URL'] as string | undefined)
  )?.trim();

  let base: string;

  if (rawBase !== undefined && rawBase !== "") {
    // If someone specifies port 5173 in dev, redirect to backend on 5000
    if (isDev && rawBase.startsWith("http://localhost:5173")) {
      base = "http://localhost:5000/api";
    } else if (rawBase === "/" || rawBase === "/api") {
      // In development without proxy, default to localhost:5000/api
      // In production or when deliberately using relative proxy, keep as /api
      base = isDev ? "http://localhost:5000/api" : "/api";
    } else {
      base = rawBase;
    }
  } else {
    // No base URL specified: in dev default to local backend, in prod default to same-origin /api
    base = isDev ? "http://localhost:5000/api" : "/api";
  }

  // Strip all trailing slashes from base
  const cleanBase = base.replace(/\/+$/, "");

  // Ensure path starts with a single forward slash
  const cleanPath = path.startsWith("/") ? path : `/${path}`;

  // If cleanBase already ends with /api:
  if (cleanBase.endsWith("/api")) {
    // If cleanPath starts with /api/, strip the leading /api to avoid /api/api/...
    if (cleanPath.startsWith("/api/")) {
      return `${cleanBase}${cleanPath.slice(4)}`;
    }
    // If cleanPath is just /api, return cleanBase
    if (cleanPath === "/api") {
      return cleanBase;
    }
    return `${cleanBase}${cleanPath}`;
  }

  // If cleanBase is empty or just "/"
  if (!cleanBase || cleanBase === "/") {
    return cleanPath.startsWith("/api") ? cleanPath : `/api${cleanPath}`;
  }

  // If cleanBase does not end with /api:
  // If cleanPath doesn't start with /api, insert /api prefix
  if (!cleanPath.startsWith("/api")) {
    return `${cleanBase}/api${cleanPath}`;
  }

  return `${cleanBase}${cleanPath}`;
}

const rawMockFlag = (import.meta.env?.['VITE_USE_MOCK_API'] as string | undefined)?.toLowerCase();
export const USE_MOCK_API = rawMockFlag === "true";

export class ApiError extends Error {
  constructor(
    message: string,
    public status = 500,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const token = typeof window !== "undefined" ? localStorage.getItem("nexus-cfr.token") : null;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const fullUrl = buildApiUrl(path);

  const res = await fetch(fullUrl, {
    method,
    headers,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });

  if (!res.ok) {
    let errorMessage = `Request failed: ${method} ${path} (${res.status})`;
    try {
      const errJson = await res.json();
      if (errJson && typeof errJson === "object") {
        if (errJson.error && typeof errJson.error === "object" && errJson.error.message) {
          errorMessage = String(errJson.error.message);
        } else if ("message" in errJson) {
          errorMessage = String(errJson.message);
        }
      }
    } catch {
      // ignore json parse error on non-json error responses
    }
    throw new ApiError(errorMessage, res.status);
  }

  const json = await res.json();
  if (json && typeof json === "object" && "success" in json && "data" in json) {
    return json.data as T;
  }
  return json as T;
}

export const apiClient = {
  get: <T>(path: string) => request<T>("GET", path),
  post: <T>(path: string, body?: unknown) => request<T>("POST", path, body),
  put: <T>(path: string, body?: unknown) => request<T>("PUT", path, body),
  delete: <T>(path: string) => request<T>("DELETE", path),
};

/** Simulated network latency so loading states are exercised in demo mode. */
export function mockDelay(ms = 320) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

/**
 * Resolve a call through the mock layer or the real endpoint.
 * Services stay identical when the backend arrives.
 */
export async function resolve<T>(endpoint: string, mock: () => T | Promise<T>, ms?: number): Promise<T> {
  if (!USE_MOCK_API) return apiClient.get<T>(endpoint);
  await mockDelay(ms);
  return mock();
}
