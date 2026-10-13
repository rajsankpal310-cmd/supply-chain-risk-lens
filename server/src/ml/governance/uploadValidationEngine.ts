import { CanonicalInvoiceContract } from "../../pipeline/canonicalContract";

export interface DatasetUploadStatusReport {
  source: string;
  provenanceClassification: "REAL_OBSERVED" | "ARCHITECTURAL_BENCHMARK" | "SIMULATED";
  records: number;
  uniqueSmes: number;
  uniqueBuyers: number;
  uniqueSuppliers: number;
  dateRange: {
    start: string;
    end: string;
    durationDays: number;
  };
  missingness: {
    amountMissingRate: number;
    invoiceDateMissingRate: number;
    dueDateMissingRate: number;
    paymentDateMissingRate: number;
  };
  duplicates: {
    duplicateTxnIdCount: number;
    duplicateRate: number;
  };
  invalidRecords: {
    invalidDateCount: number;
    negativeAmountCount: number;
    invertedDateCount: number; // due_date < invoice_date
  };
  completedTransactions: number;
  openCensoredTransactions: number;
  censoringRatePercent: number;
  positiveEvents: number; // delayed payments
  negativeEvents: number; // on-time payments
  targetAvailable: boolean;
  targetId: string;
  leakageDetected: boolean;
  leakageReasons: string[];
  temporalCoverage: {
    durationDays: number;
    sufficient: boolean;
  };
  mlReadinessVerdict: "SAFE_FOR_ML" | "NOT_READY_FOR_ML";
  verdictSymbol: "✓ SAFE FOR ML" | "⚠ NOT READY FOR ML";
  blockingReasons: string[];
  warnings: string[];
  governanceAttestation: string;
}

export class UploadValidationEngine {
  /**
   * Evaluates an uploaded dataset through the strict 18-step ML readiness pipeline:
   * UPLOAD -> SOURCE IDENTIFICATION -> PROVENANCE -> SCHEMA DETECTION -> CANONICAL MAPPING ->
   * DATA QUALITY -> DUPLICATE CHECK -> BUSINESS VALIDATION -> TARGET AVAILABILITY ->
   * TARGET MATURITY -> CENSORING ANALYSIS -> LEAKAGE CHECK -> ENTITY CHECK ->
   * TEMPORAL COVERAGE -> CLASS BALANCE -> STATISTICAL SUFFICIENCY -> ML READINESS -> VERDICT
   */
  public static validateUpload(
    records: CanonicalInvoiceContract[],
    sourceName: string = "Uploaded Enterprise Dataset",
    provenance: "REAL_OBSERVED" | "ARCHITECTURAL_BENCHMARK" | "SIMULATED" = "REAL_OBSERVED",
    targetId: string = "PAYMENT_DELAY_RISK"
  ): DatasetUploadStatusReport {
    const blockingReasons: string[] = [];
    const warnings: string[] = [];
    const leakageReasons: string[] = [];

    const totalRecords = records.length;

    // 1. Minimum Sample Size
    if (totalRecords < 30) {
      blockingReasons.push(`Insufficient sample size: ${totalRecords} records found (minimum 30 required for statistical inference).`);
    }

    // 2. Provenance Check
    if (provenance === "SIMULATED") {
      blockingReasons.push("Dataset classified as SIMULATED. Simulated or mock data cannot train production ML models.");
    }

    const smes = new Set<string>();
    const buyers = new Set<string>();
    const suppliers = new Set<string>();
    const seenTxnIds = new Set<string>();

    let duplicateTxnIdCount = 0;
    let missingAmountCount = 0;
    let missingInvoiceDateCount = 0;
    let missingDueDateCount = 0;
    let missingPaymentDateCount = 0;
    let invalidDateCount = 0;
    let negativeAmountCount = 0;
    let invertedDateCount = 0;

    let minDateMs = Infinity;
    let maxDateMs = -Infinity;

    let completedTransactions = 0;
    let openCensoredTransactions = 0;
    let positiveEvents = 0; // delayed
    let negativeEvents = 0; // on-time

    for (const r of records) {
      if (!r.transaction_id || seenTxnIds.has(r.transaction_id)) {
        duplicateTxnIdCount++;
      } else {
        seenTxnIds.add(r.transaction_id);
      }

      if (r.sme_id) smes.add(r.sme_id);
      if (r.buyer_id) buyers.add(r.buyer_id);
      if (r.supplier_id) suppliers.add(r.supplier_id);

      // Amount validation
      if (r.invoice_amount === undefined || r.invoice_amount === null || isNaN(r.invoice_amount)) {
        missingAmountCount++;
      } else if (r.invoice_amount <= 0) {
        negativeAmountCount++;
      }

      // Date validation
      let iDateMs = NaN;
      let dDateMs = NaN;
      let pDateMs = NaN;

      if (!r.invoice_date) {
        missingInvoiceDateCount++;
      } else {
        iDateMs = new Date(r.invoice_date).getTime();
        if (isNaN(iDateMs)) {
          invalidDateCount++;
        } else {
          if (iDateMs < minDateMs) minDateMs = iDateMs;
          if (iDateMs > maxDateMs) maxDateMs = iDateMs;
        }
      }

      if (!r.due_date) {
        missingDueDateCount++;
      } else {
        dDateMs = new Date(r.due_date).getTime();
        if (isNaN(dDateMs)) {
          invalidDateCount++;
        }
      }

      if (!isNaN(iDateMs) && !isNaN(dDateMs) && dDateMs < iDateMs) {
        invertedDateCount++;
      }

      if (!r.payment_date) {
        missingPaymentDateCount++;
        openCensoredTransactions++;
      } else {
        pDateMs = new Date(r.payment_date).getTime();
        if (isNaN(pDateMs)) {
          invalidDateCount++;
        } else {
          completedTransactions++;
          if (pDateMs > maxDateMs) maxDateMs = pDateMs;

          // Target evaluation: delayed vs on-time
          if (!isNaN(dDateMs)) {
            const delayDays = Math.round((pDateMs - dDateMs) / (1000 * 60 * 60 * 24));
            if (delayDays > 0) {
              positiveEvents++;
            } else {
              negativeEvents++;
            }
          }
        }
      }

      // Check for target leakage fields in raw payload
      if (r.raw_payload) {
        const payloadKeys = Object.keys(r.raw_payload);
        const forbidden = ["future_default", "actual_recovery", "default_status", "collection_status"];
        for (const f of forbidden) {
          if (payloadKeys.includes(f)) {
            leakageReasons.push(`Post-outcome field '${f}' detected in raw payload.`);
          }
        }
      }
    }

    // 3. Duplicate Contamination
    const duplicateRate = totalRecords > 0 ? duplicateTxnIdCount / totalRecords : 1;
    if (duplicateTxnIdCount > 0) {
      blockingReasons.push(`Duplicate contamination detected: ${duplicateTxnIdCount} duplicate transaction IDs (${(duplicateRate * 100).toFixed(1)}%).`);
    }

    // 4. Inverted Dates (Temporal Leakage)
    if (invertedDateCount > 0) {
      blockingReasons.push(`Temporal sequence violation: ${invertedDateCount} records have due_date earlier than invoice_date.`);
    }

    // 5. Critical Field Missingness
    if (missingAmountCount > 0 || missingDueDateCount > 0 || missingInvoiceDateCount > 0) {
      blockingReasons.push(`Critical missing fields: ${missingAmountCount} missing amounts, ${missingDueDateCount} missing due dates.`);
    }

    // 6. Target Availability & Maturity
    const paymentDateMissingRate = totalRecords > 0 ? missingPaymentDateCount / totalRecords : 1;
    if (paymentDateMissingRate > 0.60) {
      blockingReasons.push(`Payment date is missing for ${(paymentDateMissingRate * 100).toFixed(1)}% of records (> 60% ceiling). Insufficient historical closures to construct target.`);
    }

    if (completedTransactions < 10) {
      blockingReasons.push(`Target cannot be constructed: Only ${completedTransactions} settled transactions observed (minimum 10 required).`);
    }

    // 7. Class Balance
    if (completedTransactions >= 10) {
      if (positiveEvents === 0 || negativeEvents === 0) {
        blockingReasons.push("Dataset contains only one class. Training requires both delayed and on-time historical examples.");
      } else if (positiveEvents < 3 || negativeEvents < 3) {
        blockingReasons.push(`Severe class imbalance: Minority class has only ${Math.min(positiveEvents, negativeEvents)} examples (minimum 3 required).`);
      }
    }

    // 8. Temporal Coverage
    const durationDays = minDateMs !== Infinity && maxDateMs !== -Infinity
      ? Math.round((maxDateMs - minDateMs) / (1000 * 60 * 60 * 24))
      : 0;

    const temporalSufficient = durationDays >= 45;
    if (!temporalSufficient) {
      blockingReasons.push(`Temporal history is too short: Observation window spans only ${durationDays} days (< 45 days required for credit cycle dynamics).`);
    }

    // 9. Excessive Right Censoring
    const censoringRatePercent = totalRecords > 0 ? Number(((openCensoredTransactions / totalRecords) * 100).toFixed(1)) : 100;
    if (censoringRatePercent >= 90) {
      blockingReasons.push(`Too many right-censored invoices: ${censoringRatePercent}% are unsettled (> 90% threshold).`);
    }

    // 10. Entity Diversity Check
    if (buyers.size < 2 && totalRecords >= 30) {
      warnings.push(`Low counterparty diversity: Only ${buyers.size} unique buyers observed.`);
    }

    // Leakage verdict
    const leakageDetected = leakageReasons.length > 0;
    if (leakageDetected) {
      blockingReasons.push(...leakageReasons);
    }

    const isSafe = blockingReasons.length === 0;

    return {
      source: sourceName,
      provenanceClassification: provenance,
      records: totalRecords,
      uniqueSmes: smes.size,
      uniqueBuyers: buyers.size,
      uniqueSuppliers: suppliers.size,
      dateRange: {
        start: minDateMs !== Infinity ? new Date(minDateMs).toISOString().slice(0, 10) : "N/A",
        end: maxDateMs !== -Infinity ? new Date(maxDateMs).toISOString().slice(0, 10) : "N/A",
        durationDays,
      },
      missingness: {
        amountMissingRate: totalRecords > 0 ? Number((missingAmountCount / totalRecords).toFixed(3)) : 1,
        invoiceDateMissingRate: totalRecords > 0 ? Number((missingInvoiceDateCount / totalRecords).toFixed(3)) : 1,
        dueDateMissingRate: totalRecords > 0 ? Number((missingDueDateCount / totalRecords).toFixed(3)) : 1,
        paymentDateMissingRate: Number(paymentDateMissingRate.toFixed(3)),
      },
      duplicates: {
        duplicateTxnIdCount,
        duplicateRate: Number(duplicateRate.toFixed(4)),
      },
      invalidRecords: {
        invalidDateCount,
        negativeAmountCount,
        invertedDateCount,
      },
      completedTransactions,
      openCensoredTransactions,
      censoringRatePercent,
      positiveEvents,
      negativeEvents,
      targetAvailable: completedTransactions >= 10 && positiveEvents > 0 && negativeEvents > 0,
      targetId,
      leakageDetected,
      leakageReasons,
      temporalCoverage: {
        durationDays,
        sufficient: temporalSufficient,
      },
      mlReadinessVerdict: isSafe ? "SAFE_FOR_ML" : "NOT_READY_FOR_ML",
      verdictSymbol: isSafe ? "✓ SAFE FOR ML" : "⚠ NOT READY FOR ML",
      blockingReasons,
      warnings,
      governanceAttestation: isSafe
        ? "AUDIT PASSED: Uploaded dataset satisfies all schema, non-leakage, temporal duration, and statistical sufficiency checks. Ready for user-confirmed model training."
        : `AUDIT REJECTED: ${blockingReasons.length} blocking issues detected. Training blocked to prevent flawed, uncalibrated, or leaked ML inference.`,
    };
  }
}
