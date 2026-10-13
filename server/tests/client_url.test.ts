import { describe, it, expect } from "vitest";

// Implementation under test directly mirrored from src/api/client.ts
function buildApiUrl(path: string, overrideBaseUrl?: string): string {
  let base = (
    overrideBaseUrl ??
    (process.env['VITE_API_BASE_URL'] as string | undefined) ??
    "http://localhost:5000/api"
  ).trim();

  if (!base || base === "/api" || base === "/" || base.startsWith("http://localhost:5173")) {
    base = "http://localhost:5000/api";
  }

  const cleanBase = base.replace(/\/+$/, "");
  const cleanPath = path.startsWith("/") ? path : `/${path}`;

  if (cleanBase.endsWith("/api")) {
    if (cleanPath.startsWith("/api/")) {
      return `${cleanBase}${cleanPath.slice(4)}`;
    }
    if (cleanPath === "/api") {
      return cleanBase;
    }
    return `${cleanBase}${cleanPath}`;
  }

  if (!cleanPath.startsWith("/api")) {
    return `${cleanBase}/api${cleanPath}`;
  }

  return `${cleanBase}${cleanPath}`;
}

describe("API URL Construction Tests", () => {
  it("resolves registration exactly to http://localhost:5000/api/auth/register", () => {
    const url = buildApiUrl("/auth/register");
    expect(url).toBe("http://localhost:5000/api/auth/register");
  });

  it("resolves login exactly to http://localhost:5000/api/auth/login", () => {
    const url = buildApiUrl("/auth/login");
    expect(url).toBe("http://localhost:5000/api/auth/login");
  });

  it("avoids double prefix when path already has /api (/api/auth/register)", () => {
    const url = buildApiUrl("/api/auth/register");
    expect(url).toBe("http://localhost:5000/api/auth/register");
    expect(url).not.toContain("/api/api");
  });

  it("handles missing leading slash gracefully", () => {
    const url = buildApiUrl("auth/register");
    expect(url).toBe("http://localhost:5000/api/auth/register");
  });

  it("handles base URL with trailing slash gracefully", () => {
    const url = buildApiUrl("/auth/register", "http://localhost:5000/api/");
    expect(url).toBe("http://localhost:5000/api/auth/register");
  });

  it("ensures /api is appended if base URL is just http://localhost:5000", () => {
    const url = buildApiUrl("/auth/register", "http://localhost:5000");
    expect(url).toBe("http://localhost:5000/api/auth/register");
  });

  it("redirects legacy relative /api base directly to backend http://localhost:5000/api", () => {
    const url = buildApiUrl("/auth/register", "/api");
    expect(url).toBe("http://localhost:5000/api/auth/register");
    expect(url).not.toBe("/api/auth/register");
    expect(url).not.toBe("/auth/register");
  });

  it("intercepts mistaken frontend host http://localhost:5173 to http://localhost:5000/api", () => {
    const url = buildApiUrl("/auth/register", "http://localhost:5173");
    expect(url).toBe("http://localhost:5000/api/auth/register");
  });

  it("resolves business entity paths correctly", () => {
    expect(buildApiUrl("/transactions")).toBe("http://localhost:5000/api/transactions");
    expect(buildApiUrl("/firms")).toBe("http://localhost:5000/api/firms");
    expect(buildApiUrl("/dashboard/summary")).toBe("http://localhost:5000/api/dashboard/summary");
  });
});
