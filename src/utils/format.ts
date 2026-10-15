import type { RiskLevel } from "@/types";

export function formatINR(value: number, compact = true): string {
  if (!Number.isFinite(value)) return "—";
  if (!compact) return `₹${value.toLocaleString("en-IN")}`;
  const abs = Math.abs(value);
  if (abs >= 10000000) return `₹${(value / 10000000).toFixed(2)} Cr`;
  if (abs >= 100000) return `₹${(value / 100000).toFixed(2)} L`;
  if (abs >= 1000) return `₹${(value / 1000).toFixed(1)}K`;
  return `₹${value.toFixed(0)}`;
}

export function formatDate(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export function formatPercent(value: number, digits = 0): string {
  return `${value.toFixed(digits)}%`;
}

export function riskLevelFromScore(score: number): RiskLevel {
  if (score >= 80) return "CRITICAL";
  if (score >= 62) return "HIGH";
  if (score >= 40) return "MEDIUM";
  return "LOW";
}

export const RISK_ORDER: Record<RiskLevel, number> = { LOW: 0, MEDIUM: 1, HIGH: 2, CRITICAL: 3 };

export function downloadFile(filename: string, content: string, mime = "text/plain") {
  if (typeof document === "undefined") return;
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]!);
  const escape = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  return [headers.join(","), ...rows.map((r) => headers.map((h) => escape(r[h])).join(","))].join("\n");
}

/**
 * Safely formats and sanitizes a company / counterparty display name.
 * Prevents "undefined", "[object Object]", empty strings, and null
 * from displaying in cards, tables, tooltips, or network graphs.
 */
export function formatCompanyName(
  name?: unknown,
  fallbackName?: unknown,
  fallbackId?: unknown
): string {
  const sanitize = (val: unknown): string | null => {
    if (val === null || val === undefined) return null;
    if (typeof val === "object") {
      const obj = val as Record<string, unknown>;
      const candidate = obj["name"] ?? obj["companyName"] ?? obj["label"] ?? obj["id"];
      return sanitize(candidate);
    }
    const str = String(val).trim();
    if (
      !str ||
      str === "undefined" ||
      str === "null" ||
      str === "[object Object]" ||
      str === "NaN"
    ) {
      return null;
    }
    return str;
  };

  const cleanName = sanitize(name);
  const cleanFallbackName = sanitize(fallbackName);
  const cleanId = sanitize(fallbackId);

  // If only 2 arguments are provided and second argument looks like an ID, treat it as fallbackId
  let resolvedName = cleanName;
  let resolvedFallbackName = cleanFallbackName;
  let resolvedId = cleanId;

  if (cleanFallbackName && !cleanId) {
    if (/^(FIRM|BUYER|SUPPLIER|ORG|TXN|CUST|VEND)[-_]/i.test(cleanFallbackName) || /^FIRM-\d+/i.test(cleanFallbackName)) {
      resolvedId = cleanFallbackName;
      resolvedFallbackName = null;
    }
  }

  // If primary name is merely the raw ID and a fallback name exists, prefer the fallback name
  if (resolvedName && resolvedId && resolvedName.toLowerCase() === resolvedId.toLowerCase()) {
    resolvedName = resolvedFallbackName ?? null;
  }

  const clean = resolvedName ?? resolvedFallbackName;
  if (clean) return clean;

  if (resolvedId) {
    if (/^FIRM-\d+$/i.test(resolvedId)) {
      return `Firm ${resolvedId.toUpperCase()}`;
    }
    return `Counterparty (${resolvedId})`;
  }

  return "Unknown Counterparty";
}
