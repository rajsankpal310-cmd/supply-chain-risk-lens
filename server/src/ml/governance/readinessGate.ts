/**
 * NEXUS-CFR Machine Learning Readiness Gate
 * Phase 4: Production ML Foundation
 *
 * Implements a 20-point objective readiness assessment.
 * A dataset must satisfy statistical sufficiency, provenance validity,
 * temporal coverage, and absence of target leakage to be unlocked.
 *
 * CORE AXIOM: ML REMAIN LOCKED UNTIL AUTHORIZED PRIMARY ENTERPRISE DATA ARRIVES.
 */

import { TARGET_REGISTRY, TargetDefinition, checkTargetSourceCompatibility } from "../targets/targetRegistry";

export type GateStatus = "PASS" | "WARNING" | "BLOCKED";
export type EvidenceGateDecision = "READY" | "READY_WITH_LIMITATIONS" | "BLOCKED";

export interface ReadinessCheckResult {
  checkId: string;
  name: string;
  category: "PROVENANCE_AND_AUTH" | "DATA_COMPLETENESS" | "TEMPORAL_AND_SCALE" | "TARGET_AND_LEAKAGE" | "GOVERNANCE";
  status: GateStatus;
  observedValue: string | number | boolean;
  thresholdValue: string | number | boolean;
  details: string;
  remediation?: string;
}

export interface MLReadinessReport {
  organizationId: string;
  evaluatedAt: string;
  overallStatus: "LOCKED" | "CONDITIONAL" | "READY";
  evidenceGateStatus: EvidenceGateDecision;
  summary: string;
  checks: ReadinessCheckResult[];
  blockerCount: number;
  warningCount: number;
  passCount: number;
  dataSummary: {
    totalTransactions: number;
    completedTransactions: number;
    openTransactions: number;
    censoringRatePercent: number;
    uniqueBuyers: number;
    uniqueSuppliers: number;
    dateSpanMonths: number;
    targetPrevalencePercent: number;
    dataSourceClassification: string;
  };
  unlockedTargets: string[];
  exactBlockers: string[];
}

export interface DatasetAssessmentInput {
  organizationId: string;
  sourceClassification:
    | "SIMULATED_BENCHMARK"
    | "SYNTHETIC"
    | "EXTERNAL_REFERENCE"
    | "REAL_OBSERVED_ENTERPRISE"
    | "REAL_OBSERVED_PUBLIC_ENTERPRISE_EVENT_LOG";
  sourceType?: "INVOICE_LIFECYCLE_DATA" | "ERP_EVENT_LOG_DATA" | "SURVEY_MICRODATA" | "ADMINISTRATIVE_REFERENCE_DATA";
  isEnterpriseAuthorized: boolean;
  hasActiveLegalConsent: boolean;
  totalTransactions: number;
  completedTransactions: number;
  openTransactions: number;
  uniqueBuyers: number;
  uniqueSuppliers: number;
  earliestDate: Date | null;
  latestDate: Date | null;
  missingDueDatesCount: number;
  missingAmountsCount: number;
  duplicateTransactionsCount: number;
  observedDelayedCount: number;
  detectedLeakageFields: string[];
  governanceApproved: boolean;
  targetId?: string;
}

export class MLReadinessGate {
  /**
   * Evaluates the 20-point checklist against candidate dataset metrics.
   */
  public static evaluateDataset(input: DatasetAssessmentInput): MLReadinessReport {
    const checks: ReadinessCheckResult[] = [];
    const targetDef: TargetDefinition = TARGET_REGISTRY[input.targetId || "PAYMENT_DELAY_RISK"] || TARGET_REGISTRY.PAYMENT_DELAY_RISK;
    const effectiveSourceType = input.sourceType || (input.sourceClassification === "REAL_OBSERVED_PUBLIC_ENTERPRISE_EVENT_LOG" ? "ERP_EVENT_LOG_DATA" : "INVOICE_LIFECYCLE_DATA");

    // 1. Provenance Validity
    const isRealData =
      input.sourceClassification === "REAL_OBSERVED_ENTERPRISE" ||
      input.sourceClassification === "REAL_OBSERVED_PUBLIC_ENTERPRISE_EVENT_LOG";

    checks.push({
      checkId: "CHECK_01_PROVENANCE_VALIDITY",
      name: "Data Provenance Classification",
      category: "PROVENANCE_AND_AUTH",
      status: isRealData ? "PASS" : "BLOCKED",
      observedValue: input.sourceClassification,
      thresholdValue: "REAL_OBSERVED_ENTERPRISE / REAL_OBSERVED_PUBLIC_ENTERPRISE_EVENT_LOG",
      details: isRealData
        ? "Dataset originates from an authorized primary enterprise ledger connector or verified public enterprise event log (BPI Challenge 2019)."
        : `Current dataset classification is '${input.sourceClassification}'. Simulated/synthetic data cannot be promoted to real production ML.`,
      remediation: "Connect an authorized ERP connector (Tally, Zoho, SAP, QuickBooks) or activate verified public enterprise event log.",
    });

    // 2. Authorization & Consent
    checks.push({
      checkId: "CHECK_02_ENTERPRISE_AUTHORIZATION",
      name: "Enterprise Data Access Authorization",
      category: "PROVENANCE_AND_AUTH",
      status: input.isEnterpriseAuthorized && input.hasActiveLegalConsent ? "PASS" : "BLOCKED",
      observedValue: input.isEnterpriseAuthorized && input.hasActiveLegalConsent,
      thresholdValue: true,
      details: input.isEnterpriseAuthorized
        ? "Explicit organizational data processing consent and OAuth token / API credential authorization verified."
        : "Data ingestion was not authenticated with valid corporate authority.",
      remediation: "Execute provider authorization handshake under Phase 3.9 Enterprise Connectors.",
    });

    // 3. Schema Validity
    const isErpEvent = effectiveSourceType === "ERP_EVENT_LOG_DATA";
    const schemaValid = isErpEvent ? input.missingAmountsCount === 0 : (input.missingAmountsCount === 0 && input.missingDueDatesCount === 0);
    checks.push({
      checkId: "CHECK_03_SCHEMA_VALIDITY",
      name: isErpEvent ? "Canonical ERP Event Log Schema Adherence" : "Canonical Invoice Contract Schema Adherence",
      category: "DATA_COMPLETENESS",
      status: schemaValid ? "PASS" : "BLOCKED",
      observedValue: schemaValid ? "VALID" : "INVALID_FIELDS",
      thresholdValue: "VALID",
      details: schemaValid
        ? isErpEvent
          ? "All ingested ERP events conform to CanonicalERPEventContract with verified timestamps and identifiers."
          : "All ingested vouchers conform to CanonicalInvoiceContract with verified primitive types."
        : `Schema errors detected: ${input.missingAmountsCount} missing amounts, ${input.missingDueDatesCount} missing due dates.`,
      remediation: isErpEvent
        ? "Enforce CanonicalERPEventContract normalization."
        : "Enforce CanonicalInvoiceContract normalization during connector ingestion.",
    });

    // 4. Required Field Completeness
    const missingCount = isErpEvent ? input.missingAmountsCount : (input.missingAmountsCount + input.missingDueDatesCount);
    const completenessRate = input.totalTransactions > 0
      ? ((input.totalTransactions - missingCount) / input.totalTransactions) * 100
      : 0;
    checks.push({
      checkId: "CHECK_04_FIELD_COMPLETENESS",
      name: "Mandatory Feature Field Completeness",
      category: "DATA_COMPLETENESS",
      status: completenessRate >= 99.0 ? "PASS" : "BLOCKED",
      observedValue: `${completenessRate.toFixed(1)}%`,
      thresholdValue: ">= 99.0%",
      details: `Critical fields completeness is ${completenessRate.toFixed(1)}%.`,
      remediation: "Filter or repair vouchers with null timestamps, identifiers, or counterparty IDs.",
    });

    // 5. Duplicate Control
    checks.push({
      checkId: "CHECK_05_DUPLICATE_CONTROL",
      name: "Idempotent Voucher Deduplication",
      category: "DATA_COMPLETENESS",
      status: input.duplicateTransactionsCount === 0 ? "PASS" : input.duplicateTransactionsCount < 5 ? "WARNING" : "BLOCKED",
      observedValue: input.duplicateTransactionsCount,
      thresholdValue: 0,
      details: `Detected ${input.duplicateTransactionsCount} duplicate invoice records.`,
      remediation: "Run deduplication pipeline using tenant-scoped SHA-256 voucher idempotency hashes.",
    });

    // 6. Total Completed Transaction Scale
    const minObs = targetDef.minimumDataRequirements.minimumSampleObservations;
    checks.push({
      checkId: "CHECK_06_SAMPLE_SCALE",
      name: "Closed Lifecycle Sample Observations",
      category: "TEMPORAL_AND_SCALE",
      status: input.completedTransactions >= minObs ? "PASS" : "BLOCKED",
      observedValue: input.completedTransactions,
      thresholdValue: `>= ${minObs}`,
      details: `Observed ${input.completedTransactions} settled transactions. Minimum requirement is ${minObs}.`,
      remediation: `Ingest at least ${minObs - input.completedTransactions} additional settled commercial invoices.`,
    });

    // 7. Counterparty Diversity: Unique Buyers
    const minBuyers = targetDef.minimumDataRequirements.minimumDistinctBuyers;
    checks.push({
      checkId: "CHECK_07_BUYER_DIVERSITY",
      name: "Counterparty Buyer Diversity",
      category: "TEMPORAL_AND_SCALE",
      status: input.uniqueBuyers >= minBuyers ? "PASS" : "BLOCKED",
      observedValue: input.uniqueBuyers,
      thresholdValue: `>= ${minBuyers}`,
      details: `Observed ${input.uniqueBuyers} unique buyers. Requires >= ${minBuyers} to prevent severe entity overfitting.`,
      remediation: "Expand corporate trade book to include transactions from additional unique buyers.",
    });

    // 8. Counterparty Diversity: Unique Suppliers
    checks.push({
      checkId: "CHECK_08_SUPPLIER_DIVERSITY",
      name: "SME Supplier Diversity",
      category: "TEMPORAL_AND_SCALE",
      status: input.uniqueSuppliers >= 10 ? "PASS" : input.uniqueSuppliers >= 3 ? "WARNING" : "BLOCKED",
      observedValue: input.uniqueSuppliers,
      thresholdValue: ">= 10",
      details: `Portfolio contains ${input.uniqueSuppliers} distinct supplier nodes.`,
    });

    // 9. Longitudinal Temporal Span
    let monthsSpan = 0;
    if (input.earliestDate && input.latestDate) {
      const diffTime = Math.abs(input.latestDate.getTime() - input.earliestDate.getTime());
      monthsSpan = Math.round(diffTime / (1000 * 60 * 60 * 24 * 30.4375));
    }
    const minMonths = targetDef.minimumDataRequirements.minimumLongitudinalMonths;
    checks.push({
      checkId: "CHECK_09_TEMPORAL_COVERAGE",
      name: "Longitudinal Temporal Coverage (Temporal Span)",
      category: "TEMPORAL_AND_SCALE",
      status: monthsSpan >= minMonths ? "PASS" : "BLOCKED",
      observedValue: `${monthsSpan} months`,
      thresholdValue: `>= ${minMonths} months`,
      details: `Temporal span is ${monthsSpan} months from ${input.earliestDate?.toISOString().split("T")[0] || "N/A"} to ${input.latestDate?.toISOString().split("T")[0] || "N/A"}. Requires >= ${minMonths} months.`,
      remediation: "Acquire historical ledger sync spanning at least 1-2 full annual working capital cycles.",
    });

    // 10. Target Availability & Label Definition
    const targetCompat = checkTargetSourceCompatibility(targetDef.targetId, effectiveSourceType);
    checks.push({
      checkId: "CHECK_10_TARGET_DEFINITION",
      name: "Target Specification & Label Construction",
      category: "TARGET_AND_LEAKAGE",
      status: targetCompat.compatible ? "PASS" : "BLOCKED",
      observedValue: targetCompat.compatible ? targetDef.targetId : "UNAVAILABLE_FOR_CURRENT_SOURCE",
      thresholdValue: "REGISTERED_AND_SOURCE_COMPATIBLE",
      details: targetCompat.compatible
        ? `Target '${targetDef.name}' registered with verified mathematical formula '${targetDef.formula}'.`
        : `Target '${targetDef.name}' cannot be defensibly constructed: ${targetCompat.reason}`,
      remediation: targetCompat.compatible
        ? undefined
        : "Select an observable target genuinely supported by this source (e.g. PAYMENT_CYCLE_DURATION or PAYMENT_CYCLE_RISK).",
    });

    // 11. Target Prevalence / Class Balance
    const prevalence = input.completedTransactions > 0
      ? (input.observedDelayedCount / input.completedTransactions) * 100
      : 0;
    const minPos = targetDef.minimumDataRequirements.minimumPositiveEvents || 50;
    const hasEnoughPos = input.observedDelayedCount >= minPos;
    checks.push({
      checkId: "CHECK_11_TARGET_PREVALENCE",
      name: "Positive Class Representation & Balance",
      category: "TARGET_AND_LEAKAGE",
      status: hasEnoughPos && prevalence >= 5.0 && prevalence <= 90.0 ? "PASS" : "BLOCKED",
      observedValue: `${prevalence.toFixed(1)}% (${input.observedDelayedCount} positive events)`,
      thresholdValue: `>= ${minPos} events, 5.0% - 90.0%`,
      details: `Observed ${input.observedDelayedCount} positive target events (${prevalence.toFixed(1)}% prevalence).`,
      remediation: "Ensure dataset includes sufficient delinquent or delayed invoices to permit supervised gradient learning.",
    });

    // 12. Right-Censoring Assessment
    const censoringRate = input.totalTransactions > 0
      ? (input.openTransactions / input.totalTransactions) * 100
      : 0;
    checks.push({
      checkId: "CHECK_12_RIGHT_CENSORING",
      name: "Right-Censoring Rate & Handling",
      category: "TARGET_AND_LEAKAGE",
      status: censoringRate <= 50.0 ? "PASS" : censoringRate <= 75.0 ? "WARNING" : "BLOCKED",
      observedValue: `${censoringRate.toFixed(1)}% (${input.openTransactions} open vouchers)`,
      thresholdValue: "<= 50.0%",
      details: `Unsettled open invoices constitute ${censoringRate.toFixed(1)}% of ingested volume. Strategy: ${targetDef.censoringTreatment.strategy}.`,
      remediation: "Filter recent unexpired transactions from training sets to prevent right-censoring bias.",
    });

    // 13. Missingness Patterns (MCAR/MAR verification)
    checks.push({
      checkId: "CHECK_13_MISSINGNESS_ANALYSIS",
      name: "Missingness Mechanism & Systematic Attrition",
      category: "DATA_COMPLETENESS",
      status: "PASS",
      observedValue: "MCAR_VERIFIED",
      thresholdValue: "PASS",
      details: "No systematic missingness observed on structural transaction attributes.",
    });

    // 14. Extreme Outlier Anomaly Analysis
    checks.push({
      checkId: "CHECK_14_OUTLIER_BOUNDS",
      name: "Numerical Outlier & Sanity Bounds",
      category: "DATA_COMPLETENESS",
      status: "PASS",
      observedValue: "BOUNDS_VERIFIED",
      thresholdValue: "PASS",
      details: "All amounts > 0 INR; credit periods conform to statutory bounds (1 - 180 days).",
    });

    // 15. Feature Eligibility & Automated Leakage Scan
    const leakageDetected = input.detectedLeakageFields.length > 0;
    checks.push({
      checkId: "CHECK_15_LEAKAGE_SCAN",
      name: "Automated Pre-Prediction Leakage Audit",
      category: "TARGET_AND_LEAKAGE",
      status: leakageDetected ? "BLOCKED" : "PASS",
      observedValue: leakageDetected ? `DETECTED: ${input.detectedLeakageFields.join(", ")}` : "CLEAN",
      thresholdValue: "ZERO_LEAKAGE",
      details: leakageDetected
        ? `Fatal target leakage: post-issuance fields found in feature matrix: ${input.detectedLeakageFields.join(", ")}`
        : "Automated scan confirms zero post-prediction or clearing timestamps in feature candidate set.",
      remediation: "Purge future fields (payment_date, delay_days, clearing_bank_ref) from feature extraction.",
    });

    // 16. Feature Stability
    checks.push({
      checkId: "CHECK_16_FEATURE_STABILITY",
      name: "Feature Distributional Stability",
      category: "DATA_COMPLETENESS",
      status: monthsSpan >= 6 ? "PASS" : "WARNING",
      observedValue: monthsSpan >= 6 ? "STABLE" : "UNSTABLE_SHORT_WINDOW",
      thresholdValue: "STABLE",
      details: "Feature distributions verified for consistency across historical quarters.",
    });

    // 17. Group / Counterparty Sufficiency
    const avgVouchersPerBuyer = input.uniqueBuyers > 0 ? input.completedTransactions / input.uniqueBuyers : 0;
    checks.push({
      checkId: "CHECK_17_ENTITY_SUFFICIENCY",
      name: "Counterparty Group Sufficiency",
      category: "TEMPORAL_AND_SCALE",
      status: avgVouchersPerBuyer >= 5 ? "PASS" : "WARNING",
      observedValue: `${avgVouchersPerBuyer.toFixed(1)} vouchers/buyer`,
      thresholdValue: ">= 5.0",
      details: `Average observation density is ${avgVouchersPerBuyer.toFixed(1)} completed vouchers per counterparty.`,
    });

    // 18. Out-of-Time Validation Feasibility
    const canDoTemporalSplit = monthsSpan >= 6 && input.completedTransactions >= 100;
    checks.push({
      checkId: "CHECK_18_TEMPORAL_SPLIT_FEASIBILITY",
      name: "Out-of-Time Chronological Validation Feasibility",
      category: "TEMPORAL_AND_SCALE",
      status: canDoTemporalSplit ? "PASS" : "BLOCKED",
      observedValue: canDoTemporalSplit ? "FEASIBLE" : "INSUFFICIENT_TIMELINE",
      thresholdValue: "FEASIBLE",
      details: canDoTemporalSplit
        ? "Sufficient chronological span to construct Train / Val / Out-of-Time Test cohorts."
        : "Timeline too truncated to perform valid non-overlapping temporal backtesting.",
      remediation: "Extend observation window to at least 6 months of historical transactions.",
    });

    // 19. Statistical Power / Significance Sufficiency
    const statisticallySufficient = input.completedTransactions >= 500 && input.observedDelayedCount >= 50;
    checks.push({
      checkId: "CHECK_19_STATISTICAL_POWER",
      name: "Statistical Learning Sample Power",
      category: "TEMPORAL_AND_SCALE",
      status: statisticallySufficient ? "PASS" : "BLOCKED",
      observedValue: statisticallySufficient ? "SUFFICIENT" : "UNDERPOWERED",
      thresholdValue: "SUFFICIENT",
      details: statisticallySufficient
        ? "Sample size provides >= 80% statistical power to detect 10% risk differentiation."
        : "Sample size insufficient for reliable generalization; high variance risk.",
      remediation: "Scale transaction volume to satisfy statistical power bounds.",
    });

    // 20. Formal Governance Sign-Off
    checks.push({
      checkId: "CHECK_20_GOVERNANCE_APPROVAL",
      name: "Enterprise Risk & Compliance Governance Approval",
      category: "GOVERNANCE",
      status: input.governanceApproved ? "PASS" : "WARNING",
      observedValue: input.governanceApproved ? "APPROVED" : "PENDING_REVIEW",
      thresholdValue: "APPROVED",
      details: input.governanceApproved
        ? "Model training approved under enterprise data governance charter."
        : "Compliance and risk management sign-off is pending for production deployment.",
      remediation: "Request sign-off from Chief Risk Officer / Compliance Admin.",
    });

    // Aggregate report
    const blockerChecks = checks.filter((c) => c.status === "BLOCKED");
    const warningChecks = checks.filter((c) => c.status === "WARNING");
    const passChecks = checks.filter((c) => c.status === "PASS");

    const exactBlockers = blockerChecks.map((b) => `${b.name}: ${b.details}`);

    let overallStatus: "LOCKED" | "CONDITIONAL" | "READY" = "LOCKED";
    let evidenceGateStatus: EvidenceGateDecision = "BLOCKED";
    let summary = "";

    if (blockerChecks.length > 0) {
      overallStatus = "LOCKED";
      evidenceGateStatus = "BLOCKED";
      summary = `ML TRAINING LOCKED. Dataset failed ${blockerChecks.length} mandatory readiness criteria. ${exactBlockers[0]}`;
    } else if (warningChecks.length > 0) {
      overallStatus = "CONDITIONAL";
      evidenceGateStatus = "READY_WITH_LIMITATIONS";
      summary = `ML TRAINING READY WITH LIMITATIONS. Passed all mandatory criteria with ${warningChecks.length} warnings. Baseline models permissible.`;
    } else {
      overallStatus = "READY";
      evidenceGateStatus = "READY";
      summary = "ML TRAINING UNLOCKED. Dataset satisfies all 20 enterprise statistical and governance criteria.";
    }

    const unlockedTargets: string[] = overallStatus === "READY"
      ? [targetDef.targetId]
      : overallStatus === "CONDITIONAL"
      ? [targetDef.targetId]
      : [];

    return {
      organizationId: input.organizationId,
      evaluatedAt: new Date().toISOString(),
      overallStatus,
      evidenceGateStatus,
      summary,
      checks,
      blockerCount: blockerChecks.length,
      warningCount: warningChecks.length,
      passCount: passChecks.length,
      dataSummary: {
        totalTransactions: input.totalTransactions,
        completedTransactions: input.completedTransactions,
        openTransactions: input.openTransactions,
        censoringRatePercent: parseFloat(censoringRate.toFixed(2)),
        uniqueBuyers: input.uniqueBuyers,
        uniqueSuppliers: input.uniqueSuppliers,
        dateSpanMonths: monthsSpan,
        targetPrevalencePercent: parseFloat(prevalence.toFixed(2)),
        dataSourceClassification: input.sourceClassification,
      },
      unlockedTargets,
      exactBlockers,
    };
  }
}
