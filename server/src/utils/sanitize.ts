/**
 * Enterprise sanitization utilities for company names and counterparty identities.
 * Guarantees that no "[object Object]", "undefined", "null", or empty strings
 * ever persist into the database or leak through API responses.
 */
export function sanitizeCompanyName(val: unknown, fallbackId?: string): string {
  if (val === null || val === undefined) {
    if (fallbackId && fallbackId.trim()) {
      const cleanId = fallbackId.trim();
      return cleanId.startsWith("FIRM-") ? `Firm ${cleanId}` : `Counterparty (${cleanId})`;
    }
    return "Unknown Enterprise";
  }

  if (typeof val === "object") {
    const obj = val as Record<string, unknown>;
    const candidate = obj.name ?? obj.companyName ?? obj.label ?? obj.id;
    return sanitizeCompanyName(candidate, fallbackId);
  }

  const str = String(val).trim();
  if (
    !str ||
    str === "undefined" ||
    str === "null" ||
    str === "[object Object]" ||
    str === "NaN"
  ) {
    if (fallbackId && fallbackId.trim()) {
      const cleanId = fallbackId.trim();
      return cleanId.startsWith("FIRM-") ? `Firm ${cleanId}` : `Counterparty (${cleanId})`;
    }
    return "Unknown Enterprise";
  }

  return str;
}
