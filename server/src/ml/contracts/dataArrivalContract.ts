/**
 * NEXUS-CFR Machine Learning Data Arrival Contract
 * Phase 4.5: ML Production Hardening & Data-Arrival Readiness
 *
 * Establishes a formal machine-readable contract for incoming enterprise datasets:
 * SOURCE -> AUTHORIZATION -> PROVENANCE -> RAW SNAPSHOT -> CANONICAL DATA ->
 * QUALITY -> ENTITY RESOLUTION -> TEMPORAL INTEGRITY -> TARGET ELIGIBILITY ->
 * LEAKAGE AUDIT -> ML READINESS.
 */

import crypto from "crypto";

export type ProvenanceClassification =
  | "REAL_OBSERVED_ENTERPRISE"
  | "SIMULATED_BENCHMARK"
  | "SYNTHETIC"
  | "ADMINISTRATIVE_AGGREGATE"
  | "SURVEY_MICRODATA"
  | "EXTERNAL_REFERENCE"
  | "UNVERIFIED";

export type DataArrivalStatus = "BLOCKED" | "CONDITIONAL" | "READY";

export interface EntityCounts {
  uniqueSmeCount: number;
  uniqueBuyerCount: number;
  uniqueSupplierCount: number;
  totalCounterpartyTies: number;
}

export interface InvoiceLifecycleCounts {
  totalInvoices: number;
  completedInvoices: number;
  openInvoices: number;
  rightCensoredInvoices: number;
  invalidInvoices: number;
}

export interface TargetPrevalenceSummary {
  targetId: string;
  positiveCount: number;
  negativeCount: number;
  prevalencePercent: number;
  censoredCount: number;
  isStatisticallySufficient: boolean;
}

export interface DataArrivalAssessment {
  assessmentId: string;
  evaluatedAt: string;
  sourceType: "CONNECTOR_SYNC" | "CONTROLLED_FILE_EXPORT" | "SIMULATED_BENCHMARK";
  sourceSystem: string; // e.g. TALLY_PRIME, ZOHO_BOOKS, SAP_S4HANA, QUICKBOOKS, TREDS, MANUAL_BENCHMARK
  organizationId: string;
  batchId?: string;
  provenanceClassification: ProvenanceClassification;
  isEnterpriseAuthorized: boolean;
  hasActiveLegalConsent: boolean;
  checksum: string;

  recordCounts: InvoiceLifecycleCounts;
  entityCounts: EntityCounts;
  temporalCoverage: {
    startDate: string | null;
    endDate: string | null;
    durationMonths: number;
    isContinuous: boolean;
  };

  qualitySummary: {
    completenessRatePercent: number;
    duplicateCount: number;
    duplicateRatePercent: number;
    missingMandatoryFieldsCount: number;
    outlierCount: number;
  };

  leakageAuditStatus: {
    targetLeakageFree: boolean;
    temporalLeakageFree: boolean;
    entityContaminationFree: boolean;
    detectedViolations: string[];
  };

  targetEligibility: TargetPrevalenceSummary[];
  finalStatus: DataArrivalStatus;
  exactBlockers: string[];
  warnings: string[];
  actionableNextSteps: string[];
}

export class DataArrivalContractEvaluator {
  /**
   * Assesses whether an incoming raw or canonical dataset satisfies the Data Arrival Contract.
   */
  public static evaluateArrival(params: {
    sourceType: "CONNECTOR_SYNC" | "CONTROLLED_FILE_EXPORT" | "SIMULATED_BENCHMARK";
    sourceSystem: string;
    organizationId: string;
    batchId?: string;
    provenanceClassification: ProvenanceClassification;
    isEnterpriseAuthorized: boolean;
    hasActiveLegalConsent: boolean;
    invoices: Array<{
      id: string;
      invoiceNumber: string;
      supplierId: string;
      buyerId: string;
      invoiceDate: Date | string;
      dueDate: Date | string;
      invoiceAmount: number;
      paymentDate?: Date | string | null;
      paymentDelayDays?: number | null;
    }>;
    duplicateCount?: number;
    leakageViolations?: string[];
  }): DataArrivalAssessment {
    const { invoices, provenanceClassification, isEnterpriseAuthorized, hasActiveLegalConsent } = params;
    const assessmentId = `ARR-${params.organizationId}-${Date.now().toString(36).toUpperCase()}`;

    const uniqueSmes = new Set<string>();
    const uniqueBuyers = new Set<string>();
    const uniqueSuppliers = new Set<string>();
    const counterpartyTies = new Set<string>();

    let completedCount = 0;
    let openCount = 0;
    let censoredCount = 0;
    let invalidCount = 0;
    let missingFieldsCount = 0;
    let earliestDate: Date | null = null;
    let latestDate: Date | null = null;

    let positiveDelayCount = 0;
    let negativeDelayCount = 0;
    const now = Date.now();

    for (const inv of invoices) {
      if (!inv.invoiceDate || !inv.dueDate || !inv.invoiceAmount || inv.invoiceAmount <= 0) {
        invalidCount++;
        missingFieldsCount++;
        continue;
      }

      uniqueSmes.add(inv.supplierId);
      uniqueSuppliers.add(inv.supplierId);
      uniqueBuyers.add(inv.buyerId);
      counterpartyTies.add(`${inv.supplierId}->${inv.buyerId}`);

      const invDate = new Date(inv.invoiceDate);
      const dueDate = new Date(inv.dueDate);

      if (isNaN(invDate.getTime()) || isNaN(dueDate.getTime()) || dueDate <= invDate) {
        invalidCount++;
        continue;
      }

      if (!earliestDate || invDate < earliestDate) earliestDate = invDate;
      if (!latestDate || invDate > latestDate) latestDate = invDate;

      if (inv.paymentDate) {
        completedCount++;
        const payDate = new Date(inv.paymentDate);
        if (payDate.getTime() > dueDate.getTime()) {
          positiveDelayCount++;
        } else {
          negativeDelayCount++;
        }
      } else {
        openCount++;
        if (now > dueDate.getTime()) {
          // Open past due: confirmed delayed outcome, duration censored
          positiveDelayCount++;
        } else {
          // Open within unexpired window: right-censored observation
          censoredCount++;
        }
      }
    }

    let durationMonths = 0;
    if (earliestDate && latestDate) {
      const diffMs = Math.abs(latestDate.getTime() - earliestDate.getTime());
      durationMonths = Math.round(diffMs / (1000 * 60 * 60 * 24 * 30.4375));
    }

    const duplicateCount = params.duplicateCount ?? 0;
    const duplicateRate = invoices.length > 0 ? (duplicateCount / invoices.length) * 100 : 0;
    const completenessRate = invoices.length > 0 ? ((invoices.length - missingFieldsCount) / invoices.length) * 100 : 0;

    const exactBlockers: string[] = [];
    const warnings: string[] = [];
    const actionableNextSteps: string[] = [];

    // 1. Provenance & Auth Gates
    const isRealEnterprise = provenanceClassification === "REAL_OBSERVED_ENTERPRISE";
    if (!isRealEnterprise) {
      exactBlockers.push(
        `Provenance check failed: Classification is '${provenanceClassification}'. Real ML training strictly requires 'REAL_OBSERVED_ENTERPRISE'.`
      );
      actionableNextSteps.push("Connect an authorized ERP connector or upload an attested enterprise ledger export.");
    }

    if (!isEnterpriseAuthorized || !hasActiveLegalConsent) {
      exactBlockers.push("Corporate authorization or legal processing consent is missing or unverified.");
      actionableNextSteps.push("Execute legal data consent handshake under Phase 3.9 Enterprise Connectors.");
    }

    // 2. Statistical Scale Gates
    if (completedCount < 1000) {
      exactBlockers.push(`Insufficient completed transactions: Found ${completedCount} settled vouchers (Minimum required: 1,000).`);
      actionableNextSteps.push(`Acquire at least ${1000 - completedCount} additional settled commercial invoices.`);
    }

    if (uniqueBuyers.size < 50) {
      exactBlockers.push(`Insufficient buyer diversity: Found ${uniqueBuyers.size} unique buyers (Minimum required: 50).`);
      actionableNextSteps.push("Expand trade portfolio coverage to span additional commercial buyers.");
    }

    if (durationMonths < 12) {
      exactBlockers.push(`Truncated temporal span: Data covers ${durationMonths} months (Minimum required: 12 months).`);
      actionableNextSteps.push("Synchronize historical ERP ledger spanning at least 1-2 full annual working capital cycles.");
    }

    if (positiveDelayCount < 100) {
      exactBlockers.push(`Insufficient positive default/delay events: Found ${positiveDelayCount} positive events (Minimum required: 100).`);
      actionableNextSteps.push("Ensure connected dataset contains sufficient delinquent or delayed transactions for supervised learning.");
    }

    // 3. Right-censoring Gate
    const censoringRate = invoices.length > 0 ? (censoredCount / invoices.length) * 100 : 0;
    if (censoringRate > 50.0) {
      exactBlockers.push(`Excessive right-censoring: ${censoringRate.toFixed(1)}% of invoices are open and unexpired (Maximum threshold: 50.0%).`);
      actionableNextSteps.push("Exclude unexpired open transactions from supervised training matrices.");
    } else if (censoringRate > 30.0) {
      warnings.push(`Elevated right-censoring: ${censoringRate.toFixed(1)}% open invoices. Duration models will exclude open vouchers.`);
    }

    // 4. Leakage Violations
    const leakageViolations = params.leakageViolations || [];
    if (leakageViolations.length > 0) {
      exactBlockers.push(`Target or temporal leakage detected: ${leakageViolations.join("; ")}`);
      actionableNextSteps.push("Purge post-prediction outcome timestamps from feature matrix.");
    }

    // Final Status Determination
    let finalStatus: DataArrivalStatus = "BLOCKED";
    if (exactBlockers.length === 0 && warnings.length === 0) {
      finalStatus = "READY";
    } else if (exactBlockers.length === 0 && warnings.length > 0) {
      finalStatus = "CONDITIONAL";
    } else {
      finalStatus = "BLOCKED";
    }

    const checksumPayload = JSON.stringify({
      assessmentId,
      org: params.organizationId,
      recordCount: invoices.length,
      provenance: provenanceClassification,
      first10: invoices.slice(0, 10).map((i) => i.id),
    });
    const checksum = crypto.createHash("sha256").update(checksumPayload).digest("hex");

    const prevalence = completedCount > 0 ? (positiveDelayCount / completedCount) * 100 : 0;

    return {
      assessmentId,
      evaluatedAt: new Date().toISOString(),
      sourceType: params.sourceType,
      sourceSystem: params.sourceSystem,
      organizationId: params.organizationId,
      batchId: params.batchId,
      provenanceClassification,
      isEnterpriseAuthorized,
      hasActiveLegalConsent,
      checksum,
      recordCounts: {
        totalInvoices: invoices.length,
        completedInvoices: completedCount,
        openInvoices: openCount,
        rightCensoredInvoices: censoredCount,
        invalidInvoices: invalidCount,
      },
      entityCounts: {
        uniqueSmeCount: uniqueSmes.size,
        uniqueBuyerCount: uniqueBuyers.size,
        uniqueSupplierCount: uniqueSuppliers.size,
        totalCounterpartyTies: counterpartyTies.size,
      },
      temporalCoverage: {
        startDate: earliestDate ? earliestDate.toISOString().split("T")[0] : null,
        endDate: latestDate ? latestDate.toISOString().split("T")[0] : null,
        durationMonths,
        isContinuous: durationMonths >= 6,
      },
      qualitySummary: {
        completenessRatePercent: parseFloat(completenessRate.toFixed(2)),
        duplicateCount,
        duplicateRatePercent: parseFloat(duplicateRate.toFixed(2)),
        missingMandatoryFieldsCount: missingFieldsCount,
        outlierCount: 0,
      },
      leakageAuditStatus: {
        targetLeakageFree: !leakageViolations.some((v) => /target/i.test(v)),
        temporalLeakageFree: !leakageViolations.some((v) => /temporal/i.test(v)),
        entityContaminationFree: !leakageViolations.some((v) => /entity/i.test(v)),
        detectedViolations: leakageViolations,
      },
      targetEligibility: [
        {
          targetId: "PAYMENT_DELAY_RISK",
          positiveCount: positiveDelayCount,
          negativeCount: negativeDelayCount,
          prevalencePercent: parseFloat(prevalence.toFixed(2)),
          censoredCount,
          isStatisticallySufficient: completedCount >= 1000 && positiveDelayCount >= 100,
        },
      ],
      finalStatus,
      exactBlockers,
      warnings,
      actionableNextSteps,
    };
  }
}
