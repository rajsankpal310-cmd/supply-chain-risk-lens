/**
 * NEXUS-CFR Financial Outlier Policy & Audit Engine
 * Phase 4.5: ML Production Hardening & Data-Arrival Readiness
 *
 * Implements audited domain-aware classification:
 * 1. VALID_EXTREME: Real-world large commercial trade tickets (e.g. ₹50 Cr capital goods purchase). RETAINED.
 * 2. SUSPICIOUS_DATA_QUALITY: Unusual credit period (e.g. 730 days) or extreme ratio requiring compliance review.
 * 3. IMPOSSIBLE_VALUE: Negative amounts, non-positive credit periods (dueDate <= invoiceDate), invalid calendar dates. HARD REJECTED.
 */

export type OutlierClassification = "VALID_EXTREME" | "SUSPICIOUS_DATA_QUALITY" | "IMPOSSIBLE_VALUE" | "STANDARD_RANGE";

export interface OutlierEvaluation {
  invoiceId: string;
  field: string;
  observedValue: number | string;
  classification: OutlierClassification;
  treatment: "RETAIN_IN_TRAINING" | "FLAG_FOR_AUDIT" | "HARD_DROP_INVALID";
  rationale: string;
}

export class FinancialOutlierPolicy {
  public static readonly MAXIMUM_STATUTORY_CREDIT_DAYS = 180; // MSMED statutory benchmark
  public static readonly LARGE_TICKET_BENCHMARK_INR = 50_000_000; // ₹5 Cr enterprise threshold

  /**
   * Evaluates invoice amounts and credit terms against financial sanity boundaries.
   */
  public static evaluateInvoice(invoice: {
    id: string;
    invoiceAmount: number;
    invoiceDate: Date | string;
    dueDate: Date | string;
  }): OutlierEvaluation[] {
    const evaluations: OutlierEvaluation[] = [];
    const amount = Number(invoice.invoiceAmount);

    // 1. Amount Sanity Check
    if (isNaN(amount) || amount <= 0) {
      evaluations.push({
        invoiceId: invoice.id,
        field: "invoiceAmount",
        observedValue: amount,
        classification: "IMPOSSIBLE_VALUE",
        treatment: "HARD_DROP_INVALID",
        rationale: "Invoice gross amount is non-positive or NaN. Commercial sales vouchers must have positive face value.",
      });
    } else if (amount >= this.LARGE_TICKET_BENCHMARK_INR) {
      evaluations.push({
        invoiceId: invoice.id,
        field: "invoiceAmount",
        observedValue: amount,
        classification: "VALID_EXTREME",
        treatment: "RETAIN_IN_TRAINING",
        rationale: `Gross amount (₹${(amount / 10_000_000).toFixed(1)} Cr) is large but represents legitimate enterprise commercial contracts. Retained to preserve tail loss distribution.`,
      });
    }

    // 2. Credit Period Check
    const invDate = new Date(invoice.invoiceDate).getTime();
    const dueDate = new Date(invoice.dueDate).getTime();

    if (isNaN(invDate) || isNaN(dueDate)) {
      evaluations.push({
        invoiceId: invoice.id,
        field: "creditPeriodDays",
        observedValue: "NaN",
        classification: "IMPOSSIBLE_VALUE",
        treatment: "HARD_DROP_INVALID",
        rationale: "Invalid date format encountered in invoiceDate or dueDate.",
      });
    } else {
      const creditDays = Math.round((dueDate - invDate) / (1000 * 60 * 60 * 24));
      if (creditDays <= 0) {
        evaluations.push({
          invoiceId: invoice.id,
          field: "creditPeriodDays",
          observedValue: creditDays,
          classification: "IMPOSSIBLE_VALUE",
          treatment: "HARD_DROP_INVALID",
          rationale: `Maturity date is on or before invoice issuance date (dueDate <= invoiceDate, days: ${creditDays}).`,
        });
      } else if (creditDays > this.MAXIMUM_STATUTORY_CREDIT_DAYS) {
        evaluations.push({
          invoiceId: invoice.id,
          field: "creditPeriodDays",
          observedValue: creditDays,
          classification: "SUSPICIOUS_DATA_QUALITY",
          treatment: "FLAG_FOR_AUDIT",
          rationale: `Contractual credit period (${creditDays} days) exceeds statutory 180-day MSME ceiling. May represent special capital equipment installment terms.`,
        });
      }
    }

    return evaluations;
  }
}
