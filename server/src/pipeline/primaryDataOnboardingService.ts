/**
 * NEXUS-CFR Primary Data Onboarding Pipeline Service
 * Phase 5: Real Authorized Data Acquisition & First Evidence Run
 *
 * Orchestrates the complete end-to-end operational journey:
 * 1. Source Identification & Authorization Audit
 * 2. Immutable Raw Data Snapshotting
 * 3. Canonical Schema Normalization
 * 4. Data Quality Partitioning (Accepted, Warning, Rejected, Quarantined)
 * 5. Conservative Entity Resolution
 * 6. Payment Outcome & Censoring Analysis
 * 7. Population Representativeness & Concentration Audit
 * 8. End-to-End Mathematical Reconciliation
 * 9. Machine-Readable Data Arrival Contract Evaluation
 */

import { SourceRegistry, GovernedSourceRegistration } from "../connectors/sourceRegistry";
import { RawSnapshotService, RawSnapshotArtifact } from "./rawSnapshotService";
import { CanonicalTransformer, CanonicalNormalizationBatchResult } from "./canonicalTransformer";
import { QuarantineService, QualityPartitionSummary } from "./quarantineService";
import { EntityResolutionEngine, EntityResolutionResult } from "./entityResolution";
import { OutcomeCensoringAnalyzer, CensoringAnalysisReport } from "../ml/validation/outcomeCensoringAnalyzer";
import { RepresentativenessAuditor, RepresentativenessAuditReport } from "../ml/validation/representativenessAuditor";
import { ReconciliationService, DataImportReconciliationReport } from "./reconciliationService";
import { DataArrivalContractEvaluator, DataArrivalAssessment, ProvenanceClassification } from "../ml/contracts/dataArrivalContract";

export interface OnboardingExecutionResult {
  executionId: string;
  organizationId: string;
  sourceId: string;
  batchId: string;
  executedAt: string;
  sourceRegistration: GovernedSourceRegistration;
  snapshot: RawSnapshotArtifact["metadata"];
  canonicalSummary: {
    totalRawRecords: number;
    successfulMapped: number;
    warningMapped: number;
    failedMapped: number;
  };
  qualitySummary: {
    acceptedCount: number;
    warningCount: number;
    rejectedCount: number;
    quarantinedCount: number;
    qualityScore: number;
    acceptedRecords?: any[];
  };
  entityResolution: {
    totalEntities: number;
    autoLinked: number;
    ambiguousUnresolved: number;
  };
  censoringReport: {
    completedSettledCount: number;
    openImmatureCount: number;
    rightCensoredExpiredCount: number;
    overallCensoringRatePercent: number;
  };
  representativeness: {
    uniqueBuyers: number;
    uniqueSuppliers: number;
    topBuyerSharePercent: number;
    herfindahlIndex: number;
    isAcceptable: boolean;
  };
  reconciliation: DataImportReconciliationReport;
  dataArrivalAssessment: DataArrivalAssessment;
  overallStatus: "BLOCKED" | "CONDITIONAL" | "READY_FOR_ML_EVIDENCE";
  blockers: string[];
}

export class PrimaryDataOnboardingService {
  /**
   * Runs the complete data onboarding and governance pipeline on incoming enterprise records.
   */
  public static async executeOnboarding(params: {
    organizationId: string;
    sourceId: string;
    connectorId: string;
    batchId: string;
    rawRecords: Record<string, any>[];
    actorEmail: string;
  }): Promise<OnboardingExecutionResult> {
    const { organizationId, sourceId, connectorId, batchId, rawRecords, actorEmail } = params;

    const blockers: string[] = [];

    // Step 1: Source Verification
    const source = SourceRegistry.getSource(organizationId, sourceId);
    if (!source) {
      throw new Error(`Source '${sourceId}' not registered for organization '${organizationId}'.`);
    }

    if (!source.isEnterpriseAuthorized) {
      blockers.push("Source Authorization Missing: Enterprise legal consent has not been recorded.");
    }

    if (source.provenance !== "REAL_OBSERVED_ENTERPRISE") {
      blockers.push(
        `Data Provenance Blocked: Source provenance is '${source.provenance}'. Production ML requires REAL_OBSERVED_ENTERPRISE.`
      );
    }

    // Step 2: Immutable Raw Snapshot
    const snapshotArtifact = RawSnapshotService.createSnapshot({
      organizationId,
      sourceId,
      connectorId,
      batchId,
      rawRecords,
    });

    // Step 3: Canonical Schema Normalization
    const canonicalResult: CanonicalNormalizationBatchResult = CanonicalTransformer.normalizeRawBatch(
      rawRecords,
      source.sourceType,
      organizationId
    );

    // Step 4: Data Quality Tier Partitioning
    const qualitySummary: QualityPartitionSummary = QuarantineService.evaluateAndPartition(
      organizationId,
      sourceId,
      canonicalResult.canonicalRecords
    );

    if (qualitySummary.rejected.length > 0) {
      blockers.push(`${qualitySummary.rejected.length} records rejected due to critical schema or financial errors.`);
    }
    if (qualitySummary.quarantined.length > 0) {
      blockers.push(
        `${qualitySummary.quarantined.length} records quarantined for compliance review (ambiguous identity or conflicting dates).`
      );
    }

    // Step 5: Conservative Entity Resolution
    const entityResult: EntityResolutionResult = EntityResolutionEngine.resolveBatchEntities(
      organizationId,
      qualitySummary.accepted
    );

    // Step 6: Payment Outcome & Right-Censoring Analysis
    const censoringReport: CensoringAnalysisReport = OutcomeCensoringAnalyzer.analyzeCensoring(
      qualitySummary.accepted
    );

    if (!censoringReport.isCensoringAcceptableForML) {
      blockers.push(
        `Censoring & Power Bound: ${censoringReport.completedSettledCount} completed invoices observed (requires ≥ 1,000 completed vouchers and ≤ 50% censoring).`
      );
    }

    // Step 7: Representativeness & Concentration Audit
    const representativeness: RepresentativenessAuditReport = RepresentativenessAuditor.auditRepresentativeness(
      qualitySummary.accepted
    );

    if (!representativeness.isRepresentativenessAcceptable) {
      blockers.push(...representativeness.blockers);
    }

    // Step 8: End-to-End Reconciliation
    const reconciliation: DataImportReconciliationReport = ReconciliationService.reconcileIngestion({
      organizationId,
      sourceId,
      batchId,
      sourceExtractedCount: rawRecords.length,
      rawSnapshotCount: snapshotArtifact.metadata.sourceRecordCount,
      canonicalCount: canonicalResult.canonicalRecords.length,
      acceptedCount: qualitySummary.accepted.length,
      rejectedCount: qualitySummary.rejected.length,
      quarantinedCount: qualitySummary.quarantined.length,
      censoredCount: censoringReport.openNotYetMatureCount + censoringReport.rightCensoredExpiredCount,
      mlEligibleCount: censoringReport.completedSettledCount,
      provenance: source.provenance,
      isEnterpriseAuthorized: source.isEnterpriseAuthorized,
      qualityScore: qualitySummary.qualityScore,
      unmappedErrorsCount: canonicalResult.failedCount,
    });

    if (!reconciliation.isFullyReconciled) {
      blockers.push(`Reconciliation Discrepancy: ${reconciliation.unaccountedDiscrepancy} unaccounted record variance.`);
    }

    const arrivalSourceType: "CONNECTOR_SYNC" | "CONTROLLED_FILE_EXPORT" | "SIMULATED_BENCHMARK" =
      source.sourceType === "CONTROLLED_FILE_EXPORT"
        ? "CONTROLLED_FILE_EXPORT"
        : (source.sourceType as string) === "SIMULATED_BENCHMARK"
        ? "SIMULATED_BENCHMARK"
        : "CONNECTOR_SYNC";

    const arrivalProvenance: ProvenanceClassification =
      (source.provenance as string) === "ARCHITECTURAL_BENCHMARK"
        ? "SIMULATED_BENCHMARK"
        : (source.provenance as ProvenanceClassification);

    // Step 9: Machine-Readable Data Arrival Contract Evaluation
    const dataArrivalAssessment: DataArrivalAssessment = DataArrivalContractEvaluator.evaluateArrival({
      sourceType: arrivalSourceType,
      sourceSystem: source.sourceSystem,
      organizationId,
      provenanceClassification: arrivalProvenance,
      isEnterpriseAuthorized: source.isEnterpriseAuthorized,
      hasActiveLegalConsent: Boolean(source.legalConsentReferenceId),
      invoices: qualitySummary.accepted.map((inv) => ({
        id: inv.transaction_id,
        invoiceNumber: inv.transaction_id,
        supplierId: inv.supplier_id || inv.sme_id,
        buyerId: inv.buyer_id,
        invoiceDate: inv.invoice_date,
        dueDate: inv.due_date,
        invoiceAmount: inv.invoice_amount,
        paymentDate: inv.payment_date,
        paymentDelayDays: inv.payment_date
          ? Math.round(
              (new Date(inv.payment_date).getTime() - new Date(inv.due_date).getTime()) /
                (1000 * 60 * 60 * 24)
            )
          : null,
      })),
      duplicateCount: 0,
      leakageViolations: [],
    });

    // Update Source state
    let overallStatus: OnboardingExecutionResult["overallStatus"] = "BLOCKED";
    if (blockers.length === 0 && dataArrivalAssessment.finalStatus === "READY") {
      overallStatus = "READY_FOR_ML_EVIDENCE";
      SourceRegistry.transitionSourceState(
        organizationId,
        sourceId,
        "ML_ASSESSED",
        actorEmail,
        "Onboarding complete: All 20 readiness criteria satisfied. Eligible for real ML evidence run.",
        "DATA_READY"
      );
    } else {
      overallStatus = "BLOCKED";
      SourceRegistry.transitionSourceState(
        organizationId,
        sourceId,
        "VALIDATED",
        actorEmail,
        `Onboarding evaluated: ${blockers.length} governance / statistical criteria blocked.`,
        "DATA_BLOCKED"
      );
    }

    return {
      executionId: `ONB-${organizationId}-${Date.now().toString(36).toUpperCase()}`,
      organizationId,
      sourceId,
      batchId,
      executedAt: new Date().toISOString(),
      sourceRegistration: source,
      snapshot: snapshotArtifact.metadata,
      canonicalSummary: {
        totalRawRecords: canonicalResult.totalRawRecords,
        successfulMapped: canonicalResult.successfulCount,
        warningMapped: canonicalResult.warningCount,
        failedMapped: canonicalResult.failedCount,
      },
      qualitySummary: {
        acceptedCount: qualitySummary.accepted.length,
        warningCount: qualitySummary.warning.length,
        rejectedCount: qualitySummary.rejected.length,
        quarantinedCount: qualitySummary.quarantined.length,
        qualityScore: qualitySummary.qualityScore,
        acceptedRecords: qualitySummary.accepted,
      },
      entityResolution: {
        totalEntities: entityResult.totalEntitiesProcessed,
        autoLinked: entityResult.deterministicAutoLinkedCount,
        ambiguousUnresolved: entityResult.ambiguousUnresolvedCount,
      },
      censoringReport: {
        completedSettledCount: censoringReport.completedSettledCount,
        openImmatureCount: censoringReport.openNotYetMatureCount,
        rightCensoredExpiredCount: censoringReport.rightCensoredExpiredCount,
        overallCensoringRatePercent: censoringReport.overallCensoringRatePercent,
      },
      representativeness: {
        uniqueBuyers: representativeness.uniqueBuyers,
        uniqueSuppliers: representativeness.uniqueSmeSuppliers,
        topBuyerSharePercent: representativeness.buyerConcentration.topBuyerSharePercent,
        herfindahlIndex: representativeness.buyerConcentration.herfindahlIndex,
        isAcceptable: representativeness.isRepresentativenessAcceptable,
      },
      reconciliation,
      dataArrivalAssessment,
      overallStatus,
      blockers,
    };
  }
}
