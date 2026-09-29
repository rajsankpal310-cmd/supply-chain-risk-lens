/**
 * NEXUS-CFR Payment Outcome & Censoring Analysis Engine
 * Phase 5: Real Authorized Data Acquisition & First Evidence Run
 *
 * Formally validates commercial payment outcomes and executes rigorous right-censoring analysis.
 * CRITICAL RULE: Invoices that are open and within credit term (immature) must NEVER
 * be treated as negative outcomes (defaults) or fabricated as positive outcomes.
 */

import { CanonicalInvoiceContract } from "../../pipeline/canonicalContract";

export type InvoiceObservationLifecycle =
  | "COMPLETED_SETTLED"
  | "OPEN_NOT_YET_MATURE"
  | "RIGHT_CENSORED_EXPIRED"
  | "INVALID_CONTRADICTORY";

export interface OutcomeRecordAnalysis {
  transactionId: string;
  lifecycle: InvoiceObservationLifecycle;
  invoiceDate: string;
  dueDate: string;
  paymentDate?: string | null;
  paymentDelayDays: number | null;
  isEligibleForMLTraining: boolean;
  censoringReason?: string;
  validationFaults: string[];
}

export interface CensoringCohortBreakdown {
  cohortName: string;
  totalVouchers: number;
  completedCount: number;
  openImmatureCount: number;
  rightCensoredCount: number;
  invalidCount: number;
  censoringRatePercent: number;
}

export interface CensoringAnalysisReport {
  totalRecordsEvaluated: number;
  completedSettledCount: number;
  openNotYetMatureCount: number;
  rightCensoredExpiredCount: number;
  invalidContradictoryCount: number;
  overallCensoringRatePercent: number;
  cohortBreakdown: CensoringCohortBreakdown[];
  buyerCensoringBreakdown: Array<{
    buyerId: string;
    totalInvoices: number;
    completedInvoices: number;
    censoredRatePercent: number;
  }>;
  isCensoringAcceptableForML: boolean; // Must be <= 50%
  records: OutcomeRecordAnalysis[];
  summaryMessage: string;
}

export class OutcomeCensoringAnalyzer {
  /**
   * Analyzes payment outcomes and evaluates right-censoring across a set of canonical invoices.
   */
  public static analyzeCensoring(
    invoices: CanonicalInvoiceContract[],
    observationCutoffDate: Date | string = new Date()
  ): CensoringAnalysisReport {
    const cutoffTime = new Date(observationCutoffDate).getTime();
    const analyzedRecords: OutcomeRecordAnalysis[] = [];

    let completedCount = 0;
    let openImmatureCount = 0;
    let rightCensoredCount = 0;
    let invalidCount = 0;

    const buyerMap = new Map<string, { total: number; completed: number; censored: number }>();
    const cohortMap = new Map<string, { total: number; completed: number; open: number; censored: number; invalid: number }>();

    for (const inv of invoices) {
      const invTime = new Date(inv.invoice_date).getTime();
      const dueTime = new Date(inv.due_date).getTime();
      const payTime = inv.payment_date ? new Date(inv.payment_date).getTime() : null;

      const faults: string[] = [];

      // Validation 1: dueDate >= invoiceDate
      if (dueTime < invTime) {
        faults.push(`Contradictory contract: due_date (${inv.due_date}) precedes invoice_date (${inv.invoice_date}).`);
      }

      // Validation 2: paymentDate >= invoiceDate
      if (payTime !== null && payTime < invTime) {
        faults.push(`Impossible sequence: payment_date (${inv.payment_date}) precedes invoice_date (${inv.invoice_date}).`);
      }

      if (faults.length > 0) {
        invalidCount++;
        analyzedRecords.push({
          transactionId: inv.transaction_id,
          lifecycle: "INVALID_CONTRADICTORY",
          invoiceDate: inv.invoice_date,
          dueDate: inv.due_date,
          paymentDate: inv.payment_date,
          paymentDelayDays: null,
          isEligibleForMLTraining: false,
          censoringReason: "Mathematical/chronological inconsistency",
          validationFaults: faults,
        });
        continue;
      }

      // Track cohort by issuance quarter
      const quarter = `${new Date(inv.invoice_date).getFullYear()}-Q${Math.floor(new Date(inv.invoice_date).getMonth() / 3) + 1}`;
      const cStats = cohortMap.get(quarter) || { total: 0, completed: 0, open: 0, censored: 0, invalid: 0 };
      cStats.total++;

      // Track buyer stats
      const bStats = buyerMap.get(inv.buyer_id) || { total: 0, completed: 0, censored: 0 };
      bStats.total++;

      let lifecycle: InvoiceObservationLifecycle;
      let delayDays: number | null = null;
      let isEligible = false;
      let censoringReason: string | undefined;

      // Classification A: COMPLETED / SETTLED
      if (payTime !== null) {
        lifecycle = "COMPLETED_SETTLED";
        completedCount++;
        cStats.completed++;
        bStats.completed++;

        // Delay days: days past due date (positive = delayed, <=0 = on-time)
        const delayMs = payTime - dueTime;
        delayDays = Math.round(delayMs / (1000 * 60 * 60 * 24));
        isEligible = true;
      }
      // Classification B: OPEN BUT NOT YET MATURE (within credit term as of cutoff date)
      else if (dueTime >= cutoffTime) {
        lifecycle = "OPEN_NOT_YET_MATURE";
        openImmatureCount++;
        cStats.open++;
        bStats.censored++;
        isEligible = false;
        censoringReason = "Voucher currently within negotiated credit term; outcome not yet mature.";
      }
      // Classification C: RIGHT-CENSORED EXPIRED (past due date as of cutoff date without recorded settlement)
      else {
        lifecycle = "RIGHT_CENSORED_EXPIRED";
        rightCensoredCount++;
        cStats.censored++;
        bStats.censored++;
        isEligible = false;
        censoringReason = "Past contractual due date without confirmed settlement or write-off at observation cutoff.";
      }

      cohortMap.set(quarter, cStats);
      buyerMap.set(inv.buyer_id, bStats);

      analyzedRecords.push({
        transactionId: inv.transaction_id,
        lifecycle,
        invoiceDate: inv.invoice_date,
        dueDate: inv.due_date,
        paymentDate: inv.payment_date,
        paymentDelayDays: delayDays,
        isEligibleForMLTraining: isEligible,
        censoringReason,
        validationFaults: [],
      });
    }

    const total = invoices.length;
    const censoredTotal = openImmatureCount + rightCensoredCount;
    const overallCensoringRate = total > 0 ? Number(((censoredTotal / total) * 100).toFixed(1)) : 0;

    const cohortBreakdown: CensoringCohortBreakdown[] = Array.from(cohortMap.entries())
      .map(([cohortName, stats]) => ({
        cohortName,
        totalVouchers: stats.total,
        completedCount: stats.completed,
        openImmatureCount: stats.open,
        rightCensoredCount: stats.censored,
        invalidCount: stats.invalid,
        censoringRatePercent: Number((((stats.open + stats.censored) / (stats.total || 1)) * 100).toFixed(1)),
      }))
      .sort((a, b) => a.cohortName.localeCompare(b.cohortName));

    const buyerCensoringBreakdown = Array.from(buyerMap.entries())
      .map(([buyerId, stats]) => ({
        buyerId,
        totalInvoices: stats.total,
        completedInvoices: stats.completed,
        censoredRatePercent: Number(((stats.censored / (stats.total || 1)) * 100).toFixed(1)),
      }))
      .sort((a, b) => b.totalInvoices - a.totalInvoices);

    const isCensoringAcceptableForML = overallCensoringRate <= 50.0 && completedCount >= 1000;

    const summaryMessage = isCensoringAcceptableForML
      ? `Censoring rate acceptable: ${overallCensoringRate}% (≤ 50.0% threshold) with ${completedCount} completed training observations.`
      : `Censoring rate excessive or sample underpowered: ${overallCensoringRate}% censored with ${completedCount} completed observations (requires ≥ 1,000 completed vouchers and ≤ 50% censoring).`;

    return {
      totalRecordsEvaluated: total,
      completedSettledCount: completedCount,
      openNotYetMatureCount: openImmatureCount,
      rightCensoredExpiredCount: rightCensoredCount,
      invalidContradictoryCount: invalidCount,
      overallCensoringRatePercent: overallCensoringRate,
      cohortBreakdown,
      buyerCensoringBreakdown,
      isCensoringAcceptableForML,
      records: analyzedRecords,
      summaryMessage,
    };
  }
}
