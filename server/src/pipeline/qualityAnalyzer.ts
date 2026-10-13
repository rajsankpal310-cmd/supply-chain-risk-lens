import { DuplicateCheckResult } from "./duplicateDetector";
import { RowValidationResult, ValidationErrorDetail } from "./businessValidator";

export interface QualityScorecard {
  totalRecords: number;
  acceptedCount: number;
  rejectedCount: number;
  invalidCount: number;
  exactDuplicateCount: number;
  exactDuplicateOnValidCount: number;
  potentialDuplicateCount: number;
  completenessRate: number; // 0 - 100
  validityRate: number;     // 0 - 100
  duplicateRate: number;    // 0 - 100
  consistencyRate: number;  // 0 - 100
  overallQualityScore: number; // 0 - 100
  qualityGrade: "A" | "B" | "C" | "D";
  fieldMissingness: Record<string, number>;
  rejectionReasons: ValidationErrorDetail[];
  summaryMessage: string;
  contentFingerprint?: string;
}

export class QualityAnalyzer {
  static analyze(
    validationResults: RowValidationResult[],
    duplicateResults: DuplicateCheckResult[],
    headers: string[] = []
  ): QualityScorecard {
    const totalRecords = validationResults.length;
    if (totalRecords === 0) {
      return {
        totalRecords: 0,
        acceptedCount: 0,
        rejectedCount: 0,
        invalidCount: 0,
        exactDuplicateCount: 0,
        exactDuplicateOnValidCount: 0,
        potentialDuplicateCount: 0,
        completenessRate: 100,
        validityRate: 100,
        duplicateRate: 0,
        consistencyRate: 100,
        overallQualityScore: 100,
        qualityGrade: "A",
        fieldMissingness: {},
        rejectionReasons: [],
        summaryMessage: "Empty dataset provided. No records to evaluate.",
      };
    }

    let exactDuplicateCount = 0;
    let potentialDuplicateCount = 0;
    const isExactMap = new Map<number, boolean>();
    const isPotentialMap = new Map<number, boolean>();
    const dupReasonMap = new Map<number, string>();

    for (const dup of duplicateResults) {
      if (dup.isExactDuplicate) {
        exactDuplicateCount++;
        isExactMap.set(dup.rowNum, true);
        if (dup.duplicateReason) {
          dupReasonMap.set(dup.rowNum, dup.duplicateReason);
        }
      }
      if (dup.isPotentialDuplicate) {
        potentialDuplicateCount++;
        isPotentialMap.set(dup.rowNum, true);
      }
    }

    let validRowsCount = 0;
    let invalidRowsCount = 0;
    let exactDuplicateOnValidCount = 0;
    const allErrors: ValidationErrorDetail[] = [];

    // Track field missingness
    const missingCounts: Record<string, number> = {
      transaction_id: 0,
      sme_id: 0,
      buyer_id: 0,
      invoice_amount: 0,
      invoice_date: 0,
      due_date: 0,
      payment_date: 0,
      outstanding_amount: 0,
      payment_status: 0,
    };

    let consistencyViolations = 0;

    for (const res of validationResults) {
      const c = res.cleaned;
      if (!c.transactionId) missingCounts.transaction_id++;
      if (!c.smeId) missingCounts.sme_id++;
      if (!c.buyerId) missingCounts.buyer_id++;
      if (c.invoiceAmount === undefined) missingCounts.invoice_amount++;
      if (!c.invoiceDate) missingCounts.invoice_date++;
      if (!c.dueDate) missingCounts.due_date++;
      if (!c.paymentDate) missingCounts.payment_date++;
      if (c.outstandingAmount === undefined) missingCounts.outstanding_amount++;
      if (!c.paymentStatus) missingCounts.payment_status++;

      if (res.errors.some((e) => e.rule === "TEMPORAL_SEQUENCE" || e.rule === "STATUS_CONSISTENCY" || e.rule === "OUTSTANDING_BOUNDS")) {
        consistencyViolations++;
      }

      const isExact = Boolean(isExactMap.get(res.rowNum));

      if (res.isValid) {
        if (isExact) {
          exactDuplicateOnValidCount++;
          const reason = dupReasonMap.get(res.rowNum) || "Exact duplicate record: already exists or duplicated within batch.";
          allErrors.push({
            row: res.rowNum,
            field: "transaction_id",
            rule: "EXACT_DUPLICATE",
            problem: reason,
            expectedFormat: "Unique transaction identifier within organization",
            example: "TXN-1001",
          });
        } else {
          validRowsCount++;
        }
      } else {
        invalidRowsCount++;
        allErrors.push(...res.errors);
      }
    }

    const fieldMissingness: Record<string, number> = {};
    for (const [key, count] of Object.entries(missingCounts)) {
      fieldMissingness[key] = Math.round((count / totalRecords) * 100);
    }

    const acceptedCount = validRowsCount;
    const rejectedCount = invalidRowsCount + exactDuplicateOnValidCount;

    // Rates
    const validityRate = Math.round((validationResults.filter((r) => r.isValid).length / totalRecords) * 100);
    const duplicateRate = Math.round(((exactDuplicateCount + potentialDuplicateCount * 0.5) / totalRecords) * 100);
    const consistencyRate = Math.round(((totalRecords - consistencyViolations) / totalRecords) * 100);

    // Calculate core completeness across mandatory concepts: sme_id/supplier, buyer_id, invoice_amount, invoice_date
    const coreMissingAvg = (
      missingCounts.sme_id +
      missingCounts.buyer_id +
      missingCounts.invoice_amount +
      missingCounts.invoice_date
    ) / (4 * totalRecords);
    const completenessRate = Math.max(0, Math.round((1 - coreMissingAvg) * 100));

    // Weighted Overall Score: 40% Validity + 30% Completeness + 20% Non-duplicate + 10% Consistency
    const overallQualityScore = Math.min(
      100,
      Math.max(
        0,
        Math.round(
          0.4 * validityRate +
          0.3 * completenessRate +
          0.2 * Math.max(0, 100 - duplicateRate) +
          0.1 * consistencyRate
        )
      )
    );

    let qualityGrade: "A" | "B" | "C" | "D";
    if (overallQualityScore >= 90) qualityGrade = "A";
    else if (overallQualityScore >= 75) qualityGrade = "B";
    else if (overallQualityScore >= 60) qualityGrade = "C";
    else qualityGrade = "D";

    let summaryMessage = `Processed ${totalRecords} records: ${acceptedCount} accepted for import, ${rejectedCount} rejected (${invalidRowsCount} invalid, ${exactDuplicateOnValidCount} exact duplicates). Quality Score: ${overallQualityScore}/100 (Grade ${qualityGrade}).`;
    if (potentialDuplicateCount > 0) {
      summaryMessage += ` ${potentialDuplicateCount} potential duplicate transactions flagged for review.`;
    }

    return {
      totalRecords,
      acceptedCount,
      rejectedCount,
      invalidCount: invalidRowsCount,
      exactDuplicateCount,
      exactDuplicateOnValidCount,
      potentialDuplicateCount,
      completenessRate,
      validityRate,
      duplicateRate,
      consistencyRate,
      overallQualityScore,
      qualityGrade,
      fieldMissingness,
      rejectionReasons: allErrors,
      summaryMessage,
    };
  }
}
