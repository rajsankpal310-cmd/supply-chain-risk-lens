/**
 * NEXUS-CFR Data Import Reconciliation Service
 * Phase 5: Real Authorized Data Acquisition & First Evidence Run
 *
 * Mathematically verifies and accounts for record transitions through every ingestion stage:
 * Source -> Raw Snapshot -> Canonical -> Accepted/Rejected/Quarantined -> ML Eligible.
 * Generates auditable DataImportReconciliationReports.
 */

export interface StageAccounting {
  stage: string;
  count: number;
  differenceFromPrevious: number;
  explanation: string;
}

export interface DataImportReconciliationReport {
  reconciliationId: string;
  organizationId: string;
  sourceId: string;
  batchId: string;
  reconciledAt: string;
  counts: {
    sourceExtractedCount: number;
    rawSnapshotCount: number;
    canonicalCount: number;
    acceptedCount: number;
    rejectedCount: number;
    quarantinedCount: number;
    censoredCount: number;
    mlEligibleCount: number;
  };
  stages: StageAccounting[];
  isFullyReconciled: boolean;
  unaccountedDiscrepancy: number;
  qualityScore: number;
  provenance: string;
  isEnterpriseAuthorized: boolean;
  finalMLEligibilityStatus: "ELIGIBLE" | "CONDITIONALLY_RESTRICTED" | "BLOCKED";
  governanceAttestation: string;
}

export class ReconciliationService {
  /**
   * Evaluates complete end-to-end reconciliation for an ingestion run.
   */
  public static reconcileIngestion(params: {
    organizationId: string;
    sourceId: string;
    batchId: string;
    sourceExtractedCount: number;
    rawSnapshotCount: number;
    canonicalCount: number;
    acceptedCount: number;
    rejectedCount: number;
    quarantinedCount: number;
    censoredCount: number;
    mlEligibleCount: number;
    provenance: string;
    isEnterpriseAuthorized: boolean;
    qualityScore: number;
    unmappedErrorsCount?: number;
  }): DataImportReconciliationReport {
    const {
      organizationId,
      sourceId,
      batchId,
      sourceExtractedCount,
      rawSnapshotCount,
      canonicalCount,
      acceptedCount,
      rejectedCount,
      quarantinedCount,
      censoredCount,
      mlEligibleCount,
      provenance,
      isEnterpriseAuthorized,
      qualityScore,
      unmappedErrorsCount = 0,
    } = params;

    const stages: StageAccounting[] = [];

    // Stage 1: Source -> Raw Snapshot
    const diffRaw = rawSnapshotCount - sourceExtractedCount;
    stages.push({
      stage: "SOURCE_TO_RAW_SNAPSHOT",
      count: rawSnapshotCount,
      differenceFromPrevious: diffRaw,
      explanation:
        diffRaw === 0
          ? "Exact parity: 100% of extracted records preserved in raw cryptographic snapshot."
          : `Discrepancy of ${diffRaw} records during raw snapshotting.`,
    });

    // Stage 2: Raw -> Canonical
    const diffCanonical = canonicalCount - rawSnapshotCount;
    stages.push({
      stage: "RAW_TO_CANONICAL_MAPPING",
      count: canonicalCount,
      differenceFromPrevious: diffCanonical,
      explanation:
        diffCanonical === 0
          ? "100% of raw records mapped successfully to canonical contract schema."
          : `${Math.abs(diffCanonical)} records failed mandatory schema mapping or unmapped fields (Errors: ${unmappedErrorsCount}).`,
    });

    // Stage 3: Canonical Quality Partitioning (Accepted + Rejected + Quarantined = Canonical)
    const partitionSum = acceptedCount + rejectedCount + quarantinedCount;
    const diffPartition = partitionSum - canonicalCount;
    stages.push({
      stage: "QUALITY_TIER_PARTITIONING",
      count: partitionSum,
      differenceFromPrevious: diffPartition,
      explanation:
        diffPartition === 0
          ? `Exact partition conservation: Accepted (${acceptedCount}) + Rejected (${rejectedCount}) + Quarantined (${quarantinedCount}) == Canonical (${canonicalCount}).`
          : `Conservation violation: Quality tiers sum to ${partitionSum}, differing from canonical count by ${diffPartition}.`,
    });

    // Stage 4: Accepted -> ML Eligible (Accepted = ML Eligible + Censored/Pre-t0)
    const diffMLEligible = mlEligibleCount + censoredCount - acceptedCount;
    stages.push({
      stage: "ML_ELIGIBILITY_CENSORING_FILTER",
      count: mlEligibleCount,
      differenceFromPrevious: mlEligibleCount - acceptedCount,
      explanation:
        diffMLEligible === 0
          ? `Exact outcome conservation: ML Eligible (${mlEligibleCount}) + Censored/Immature (${censoredCount}) == Accepted (${acceptedCount}).`
          : `Outcome variance of ${diffMLEligible} records during right-censoring segregation.`,
    });

    // Total unaccounted discrepancy
    const unaccountedCanonical = Math.abs(diffCanonical) - (unmappedErrorsCount || 0);
    const unaccountedDiscrepancy = Math.abs(diffRaw) + Math.max(0, unaccountedCanonical) + Math.abs(diffPartition) + Math.abs(diffMLEligible);
    const isFullyReconciled = unaccountedDiscrepancy === 0;

    let finalMLEligibilityStatus: DataImportReconciliationReport["finalMLEligibilityStatus"] = "BLOCKED";
    if (
      isFullyReconciled &&
      isEnterpriseAuthorized &&
      provenance === "REAL_OBSERVED_ENTERPRISE" &&
      mlEligibleCount >= 1000 &&
      qualityScore >= 70
    ) {
      finalMLEligibilityStatus = "ELIGIBLE";
    } else if (isFullyReconciled && mlEligibleCount >= 100) {
      finalMLEligibilityStatus = "CONDITIONALLY_RESTRICTED";
    }

    const reconciliationId = `REC-${organizationId}-${Date.now().toString(36).toUpperCase()}`;

    return {
      reconciliationId,
      organizationId,
      sourceId,
      batchId,
      reconciledAt: new Date().toISOString(),
      counts: {
        sourceExtractedCount,
        rawSnapshotCount,
        canonicalCount,
        acceptedCount,
        rejectedCount,
        quarantinedCount,
        censoredCount,
        mlEligibleCount,
      },
      stages,
      isFullyReconciled,
      unaccountedDiscrepancy,
      qualityScore,
      provenance,
      isEnterpriseAuthorized,
      finalMLEligibilityStatus,
      governanceAttestation: isFullyReconciled
        ? "Reconciliation certified: Mathematical record accounting balance verified across all 4 pipeline stages."
        : `Reconciliation audit flagged: ${unaccountedDiscrepancy} unaccounted record variance detected. Compliance review required.`,
    };
  }
}
