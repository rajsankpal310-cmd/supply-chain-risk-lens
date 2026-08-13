// Centralized API client.
// Today every service resolves against the mock layer (VITE_USE_MOCK_API=true).
// Flip the flag and the exact same service contracts hit the real REST backend.

const BASE_URL = (import.meta.env['VITE_API_BASE_URL'] as string | undefined) ?? "/api";
export const USE_MOCK_API = (import.meta.env['VITE_USE_MOCK_API'] as string | undefined) !== "false";

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
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  if (!res.ok) throw new ApiError(`Request failed: ${method} ${path}`, res.status);
  return (await res.json()) as T;
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
