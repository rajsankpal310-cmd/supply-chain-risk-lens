/**
 * NEXUS-CFR Dataset Representativeness & Concentration Auditor
 * Phase 5: Real Authorized Data Acquisition & First Evidence Run
 *
 * Evaluates population diversity, buyer concentration (HHI index and top-buyer share),
 * supplier concentration, and temporal continuity. Flags datasets where extreme concentration
 * or sparse distributions could produce false model confidence.
 */

import { CanonicalInvoiceContract } from "../../pipeline/canonicalContract";

export interface RepresentativenessAuditReport {
  totalInvoices: number;
  uniqueSmeSuppliers: number;
  uniqueBuyers: number;
  buyerConcentration: {
    topBuyerId: string;
    topBuyerInvoiceCount: number;
    topBuyerSharePercent: number; // e.g. 90%
    herfindahlIndex: number; // HHI between 0 and 1.0
    status: "WELL_DIVERSIFIED" | "MODERATE_CONCENTRATION" | "HIGHLY_CONCENTRATED_BLOCKED";
  };
  supplierConcentration: {
    topSupplierId: string;
    topSupplierSharePercent: number;
  };
  temporalDistribution: {
    monthsCoverage: number;
    avgVouchersPerMonth: number;
    minVouchersInAnyMonth: number;
    hasGapsGreaterThan60Days: boolean;
  };
  isRepresentativenessAcceptable: boolean;
  blockers: string[];
  warnings: string[];
}

export class RepresentativenessAuditor {
  /**
   * Audits population diversity and concentration metrics.
   */
  public static auditRepresentativeness(
    invoices: CanonicalInvoiceContract[]
  ): RepresentativenessAuditReport {
    const blockers: string[] = [];
    const warnings: string[] = [];

    const total = invoices.length;
    if (total === 0) {
      return {
        totalInvoices: 0,
        uniqueSmeSuppliers: 0,
        uniqueBuyers: 0,
        buyerConcentration: {
          topBuyerId: "NONE",
          topBuyerInvoiceCount: 0,
          topBuyerSharePercent: 0,
          herfindahlIndex: 0,
          status: "HIGHLY_CONCENTRATED_BLOCKED",
        },
        supplierConcentration: { topSupplierId: "NONE", topSupplierSharePercent: 0 },
        temporalDistribution: { monthsCoverage: 0, avgVouchersPerMonth: 0, minVouchersInAnyMonth: 0, hasGapsGreaterThan60Days: true },
        isRepresentativenessAcceptable: false,
        blockers: ["Dataset is empty."],
        warnings: [],
      };
    }

    // Buyer distribution
    const buyerCounts = new Map<string, number>();
    const supplierCounts = new Map<string, number>();
    const monthCounts = new Map<string, number>();

    for (const inv of invoices) {
      buyerCounts.set(inv.buyer_id, (buyerCounts.get(inv.buyer_id) || 0) + 1);
      supplierCounts.set(inv.sme_id, (supplierCounts.get(inv.sme_id) || 0) + 1);

      const d = new Date(inv.invoice_date);
      const mKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      monthCounts.set(mKey, (monthCounts.get(mKey) || 0) + 1);
    }

    const uniqueBuyers = buyerCounts.size;
    const uniqueSuppliers = supplierCounts.size;

    // Buyer concentration math
    let topBuyerId = "NONE";
    let topBuyerCount = 0;
    let sumSquaredShares = 0;

    for (const [bId, count] of buyerCounts.entries()) {
      if (count > topBuyerCount) {
        topBuyerCount = count;
        topBuyerId = bId;
      }
      const share = count / total;
      sumSquaredShares += share * share;
    }

    const topBuyerSharePercent = Number(((topBuyerCount / total) * 100).toFixed(1));
    const herfindahlIndex = Number(sumSquaredShares.toFixed(3));

    let buyerStatus: RepresentativenessAuditReport["buyerConcentration"]["status"] = "WELL_DIVERSIFIED";
    if (topBuyerSharePercent >= 75.0 || herfindahlIndex > 0.5) {
      buyerStatus = "HIGHLY_CONCENTRATED_BLOCKED";
      blockers.push(
        `Fatal Buyer Concentration: Top buyer '${topBuyerId}' accounts for ${topBuyerSharePercent}% of invoices (HHI: ${herfindahlIndex}). Model would learn single-buyer bias.`
      );
    } else if (topBuyerSharePercent >= 40.0 || herfindahlIndex > 0.25) {
      buyerStatus = "MODERATE_CONCENTRATION";
      warnings.push(
        `Moderate Buyer Concentration: Top buyer accounts for ${topBuyerSharePercent}% of dataset (HHI: ${herfindahlIndex}).`
      );
    }

    // Supplier concentration
    let topSupplierId = "NONE";
    let topSupplierCount = 0;
    for (const [sId, count] of supplierCounts.entries()) {
      if (count > topSupplierCount) {
        topSupplierCount = count;
        topSupplierId = sId;
      }
    }
    const topSupplierSharePercent = Number(((topSupplierCount / total) * 100).toFixed(1));

    // Minimum counts checks
    if (uniqueBuyers < 10) {
      blockers.push(`Insufficient buyer diversity: ${uniqueBuyers} unique buyers observed (minimum 10 required for training, 50 for production unlock).`);
    }
    if (uniqueSuppliers < 5) {
      blockers.push(`Insufficient supplier diversity: ${uniqueSuppliers} unique suppliers observed (minimum 5 required for training).`);
    }

    // Temporal coverage
    const monthsCoverage = monthCounts.size;
    const monthlyCountsArr = Array.from(monthCounts.values());
    const minMonthlyVouchers = monthlyCountsArr.length > 0 ? Math.min(...monthlyCountsArr) : 0;
    const avgMonthlyVouchers = monthsCoverage > 0 ? Math.round(total / monthsCoverage) : 0;

    // Check temporal continuity
    const sortedDates = invoices.map((i) => new Date(i.invoice_date).getTime()).sort((a, b) => a - b);
    let hasGapsGreaterThan60Days = false;
    for (let i = 1; i < sortedDates.length; i++) {
      if (sortedDates[i] - sortedDates[i - 1] > 60 * 86400000) {
        hasGapsGreaterThan60Days = true;
        break;
      }
    }

    if (hasGapsGreaterThan60Days) {
      warnings.push("Temporal discontinuity: Detected time gaps exceeding 60 consecutive days between commercial invoice batches.");
    }
    if (monthsCoverage < 6) {
      blockers.push(`Insufficient temporal span: Observed only ${monthsCoverage} calendar months of data (minimum 12 months required for production ML).`);
    }

    const isRepresentativenessAcceptable = blockers.length === 0;

    return {
      totalInvoices: total,
      uniqueSmeSuppliers: uniqueSuppliers,
      uniqueBuyers,
      buyerConcentration: {
        topBuyerId,
        topBuyerInvoiceCount: topBuyerCount,
        topBuyerSharePercent,
        herfindahlIndex,
        status: buyerStatus,
      },
      supplierConcentration: {
        topSupplierId,
        topSupplierSharePercent,
      },
      temporalDistribution: {
        monthsCoverage,
        avgVouchersPerMonth: avgMonthlyVouchers,
        minVouchersInAnyMonth: minMonthlyVouchers,
        hasGapsGreaterThan60Days,
      },
      isRepresentativenessAcceptable,
      blockers,
      warnings,
    };
  }
}
