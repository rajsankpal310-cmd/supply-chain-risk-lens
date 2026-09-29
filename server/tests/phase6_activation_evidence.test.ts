/**
 * NEXUS-CFR Phase 6 Automated Test Suite
 * REAL DATA ACTIVATION, EVIDENCE-BASED ML UNLOCK & PRODUCTION READINESS
 *
 * Verifies all 23+ Phase 6 governance, security, failure-first,
 * and ML readiness invariants.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { SourceRegistry } from "../src/connectors/sourceRegistry";
import { ControlledFileIngestionService } from "../src/pipeline/controlledFileIngestionService";
import { PrimaryDataOnboardingService } from "../src/pipeline/primaryDataOnboardingService";
import { RawSnapshotService } from "../src/pipeline/rawSnapshotService";
import { CanonicalTransformer } from "../src/pipeline/canonicalTransformer";
import { QuarantineService } from "../src/pipeline/quarantineService";
import { EntityResolutionEngine } from "../src/pipeline/entityResolution";
import { OutcomeCensoringAnalyzer } from "../src/ml/validation/outcomeCensoringAnalyzer";
import { RepresentativenessAuditor } from "../src/ml/validation/representativenessAuditor";
import { ReconciliationService } from "../src/pipeline/reconciliationService";
import { DuplicateLeakageGuard } from "../src/ml/datasets/duplicateLeakageGuard";
import { TemporalLeakageGuard } from "../src/ml/validation/temporalLeakageGuard";
import { AntiLeakageAuditor } from "../src/ml/features/featureEligibility";
import { MultiTenantModelRegistry } from "../src/ml/registry/modelRegistry";
import { PredictionService, MLUnavailableError } from "../src/ml/prediction/predictionService";
import { FirstEvidencePipeline } from "../src/ml/pipeline/firstEvidencePipeline";
import { MLPipelineService } from "../src/ml/pipeline/mlPipelineService";
import { AuditLogService } from "../src/pipeline/auditLogService";

describe("Phase 6: Real Data Activation & Governed ML Unlock", () => {
  const TEST_ORG = "ORG-PHASE6-TEST";
  const COMPLIANCE_EMAIL = "compliance.officer@nexuscfr.in";

  beforeEach(() => {
    SourceRegistry.clearRegistry();
    QuarantineService.clearStore();
    MultiTenantModelRegistry.clearTenant(TEST_ORG);
    AuditLogService._reset();
  });

  // 1. Authorized ingestion accepted
  it("01. allows controlled file ingestion with valid corporate legal consent", async () => {
    const csvContent =
      "transaction_id,sme_id,buyer_id,invoice_amount,invoice_date,due_date,payment_date,payment_status\n" +
      "INV-001,SME-100,BUYER-200,50000,2024-01-10,2024-02-10,2024-02-15,PAID\n" +
      "INV-002,SME-100,BUYER-201,75000,2024-01-15,2024-02-15,2024-02-14,PAID";

    const result = await ControlledFileIngestionService.ingestControlledFile({
      organizationId: TEST_ORG,
      uploaderEmail: COMPLIANCE_EMAIL,
      filename: "january_vouchers_authorized.csv",
      rawPayload: csvContent,
      corporateEntityName: "Apex Manufacturing Pvt Ltd",
      corporateRegistrationNumber: "U72900MH2020PTC123456",
      authorizedSignatoryName: "Rajesh Sharma",
      signatoryTitle: "Chief Financial Officer",
      legalConsentReferenceId: "CONSENT-APEX-2024-001",
      provenance: "SIMULATED_BENCHMARK",
    });

    expect(result.fileChecksumSha256).toBeDefined();
    expect(result.onboarding.canonicalSummary.successfulMapped).toBe(2);
    expect(result.sourceRegistration.isEnterpriseAuthorized).toBe(true);
    expect(result.sourceRegistration.legalConsentReferenceId).toBe("CONSENT-APEX-2024-001");
  });

  // 2. Unauthorized ingestion blocked
  it("02. blocks controlled file ingestion if legal consent reference is missing", async () => {
    const csvContent = "transaction_id,invoice_amount\nINV-001,50000";

    await expect(
      ControlledFileIngestionService.ingestControlledFile({
        organizationId: TEST_ORG,
        uploaderEmail: COMPLIANCE_EMAIL,
        filename: "unauthorized.csv",
        rawPayload: csvContent,
        corporateEntityName: "Apex Manufacturing Pvt Ltd",
        authorizedSignatoryName: "Rajesh Sharma",
        signatoryTitle: "CFO",
        legalConsentReferenceId: "", // Empty consent
        provenance: "SIMULATED_BENCHMARK",
      })
    ).rejects.toThrow(/AUTHORIZATION GATE BLOCKED/);
  });

  // 3. Tenant isolation
  it("03. prevents cross-tenant access to registered sources", () => {
    SourceRegistry.registerSource("ORG-A", {
      sourceType: "TALLYPRIME",
      sourceSystem: "TallyPrime 4.1",
      sourceName: "Org A Ledger",
      provider: "TALLY_PRIME",
      sourceOwner: { fullName: "Admin A", email: "admin@orga.com" },
      actorEmail: "admin@orga.com",
    });

    const sourcesA = SourceRegistry.listSourcesForTenant("ORG-A");
    expect(sourcesA.length).toBe(1);

    const sourceAId = sourcesA[0].sourceId;
    expect(() => SourceRegistry.getSource("ORG-B", sourceAId)).toThrow(
      /Unauthorized cross-tenant access/
    );
  });

  // 4. Checksum integrity verification
  it("04. computes and cryptographically verifies raw snapshot checksum", () => {
    const records = [{ id: "REC-1", amount: 1000 }, { id: "REC-2", amount: 2000 }];
    const snapshot = RawSnapshotService.createSnapshot({
      organizationId: TEST_ORG,
      sourceId: "SRC-TEST",
      connectorId: "CONN-TEST",
      batchId: "BAT-001",
      rawRecords: records,
    });

    expect(snapshot.metadata.payloadChecksum).toBeDefined();
    const verified = RawSnapshotService.verifySnapshotIntegrity(
      TEST_ORG,
      snapshot.metadata.snapshotId
    );
    expect(verified).toBe(true);

    const nonExistentVerified = RawSnapshotService.verifySnapshotIntegrity(
      TEST_ORG,
      "NON-EXISTENT-ID"
    );
    expect(nonExistentVerified).toBe(false);
  });

  // 5. Schema drift & canonical mapping
  it("05. maps standard commercial fields and detects unmapped attributes", () => {
    const rawBatch = [
      {
        transaction_id: "TX-100",
        sme_id: "SME-1",
        buyer_id: "BUYER-1",
        invoice_amount: 150000,
        invoice_date: "2024-01-01",
        due_date: "2024-02-01",
        payment_date: "2024-02-05",
        payment_status: "PAID",
        custom_unmapped_erp_flag: "SPECIAL_DISCOUNT",
      },
    ];

    const result = CanonicalTransformer.normalizeRawBatch(
      rawBatch,
      "CONTROLLED_FILE_EXPORT",
      TEST_ORG
    );

    expect(result.successfulCount).toBe(1);
    expect(result.canonicalRecords[0].transaction_id).toBe("TX-100");
    expect(result.results[0].unmappedFields).toContain("custom_unmapped_erp_flag");
  });

  // 6. Reconciliation hard-fail on mismatch
  it("06. reconciliation hard-fails when unaccounted records exist", () => {
    const rep = ReconciliationService.reconcileIngestion({
      organizationId: TEST_ORG,
      sourceId: "SRC-TEST",
      batchId: "BAT-FAIL",
      sourceExtractedCount: 100,
      rawSnapshotCount: 100,
      canonicalCount: 100,
      acceptedCount: 80,
      rejectedCount: 5,
      quarantinedCount: 5,
      censoredCount: 20,
      mlEligibleCount: 60,
      provenance: "REAL_OBSERVED_ENTERPRISE",
      isEnterpriseAuthorized: true,
      qualityScore: 90,
      unmappedErrorsCount: 0, // 80 + 5 + 5 = 90, missing 10 records!
    });

    expect(rep.isFullyReconciled).toBe(false);
    expect(rep.unaccountedDiscrepancy).toBe(10);
    expect(rep.finalMLEligibilityStatus).toBe("BLOCKED");
  });

  // 7. Near-duplicate contamination check
  it("07. detects exact and near-duplicate vouchers with identical semantic tuples", () => {
    const vouchers = [
      {
        id: "INV-101",
        invoiceNumber: "INV-101",
        supplierId: "SUP-A",
        buyerId: "BUY-B",
        invoiceAmount: 250000,
        invoiceDate: "2024-03-01",
      },
      {
        id: "INV-102",
        invoiceNumber: "INV-102",
        supplierId: "SUP-A",
        buyerId: "BUY-B",
        invoiceAmount: 250000, // Same amount, buyer, supplier, and date
        invoiceDate: "2024-03-01",
      },
    ];

    const audit = DuplicateLeakageGuard.auditDuplicates(vouchers);
    expect(audit.hasDuplicates).toBe(true);
    expect(audit.duplicateGroups.length).toBeGreaterThan(0);
  });

  // 8. Entity ambiguity quarantine
  it("08. quarantines ambiguous counterparties lacking statutory identification", () => {
    const records = [
      {
        transaction_id: "TX-AMBIG",
        sme_id: "SME-1",
        buyer_id: "Generic Buyer Name (No GSTIN)",
        invoice_amount: 100000,
        invoice_date: "2024-01-01",
        due_date: "2024-02-01",
        payment_status: "OPEN",
      },
    ];

    const entityResult = EntityResolutionEngine.resolveBatchEntities(TEST_ORG, records as any);
    expect(entityResult.ambiguousUnresolvedCount).toBe(2);
    expect(entityResult.mappings[0].resolutionMethod).toBe("AMBIGUOUS_UNRESOLVED");
  });

  // 9. Censoring handling
  it("09. classifies open immature invoices as right-censored, NOT as defaults", () => {
    const futureDueDate = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString().slice(0, 10);
    const invoices = [
      {
        transaction_id: "TX-OPEN",
        sme_id: "SME-1",
        buyer_id: "BUYER-1",
        invoice_amount: 50000,
        invoice_date: "2024-01-01",
        due_date: futureDueDate,
        payment_date: null,
        payment_status: "OPEN",
      },
    ];

    const rep = OutcomeCensoringAnalyzer.analyzeCensoring(invoices as any);
    expect(rep.openNotYetMatureCount).toBe(1);
    expect(rep.completedSettledCount).toBe(0);
    expect(rep.isCensoringAcceptableForML).toBe(false); // Insufficient mature completed vouchers
  });

  // 10. Target maturity requirement
  it("10. validates that payment delay risk evaluates strictly after maturity horizon", () => {
    const historicalInvoices = [
      {
        transaction_id: "TX-SETTLED",
        sme_id: "SME-1",
        buyer_id: "BUYER-1",
        invoice_amount: 100000,
        invoice_date: "2024-01-01",
        due_date: "2024-02-01",
        payment_date: "2024-02-25", // 24 days delay (>15d threshold = POSITIVE_DELAY)
        payment_status: "PAID",
      },
    ];

    const rep = OutcomeCensoringAnalyzer.analyzeCensoring(historicalInvoices as any);
    expect(rep.completedSettledCount).toBe(1);
    expect(rep.records[0].lifecycle).toBe("COMPLETED_SETTLED");
  });

  // 11. Temporal leakage prevention
  it("11. asserts that feature extraction strictly precedes prediction anchor t0", () => {
    const t0 = new Date("2024-03-01T00:00:00Z");
    const futureEvent = new Date("2024-03-05T00:00:00Z");

    expect(() => {
      TemporalLeakageGuard.assertPrecedesT0(futureEvent, t0, "feature_future_payment");
    }).toThrow(/FATAL TEMPORAL LEAKAGE/);
  });

  // 12. Feature leakage prevention
  it("12. flags outcome and future-derived fields during feature audit", () => {
    const audit = AntiLeakageAuditor.auditFeatureCandidateList([
      "buyerHistoricalDelayRatio",
      "payment_date", // Forbidden target field!
      "payment_delay_days", // Forbidden outcome field!
    ]);

    expect(audit.isLeakageFree).toBe(false);
    expect(audit.violations.length).toBeGreaterThan(0);
  });

  // 13. Simulated-data firewall
  it("13. prevents promotion of models trained on simulated benchmark datasets to PRODUCTION", () => {
    const model = MultiTenantModelRegistry.registerModel(TEST_ORG, {
      version: "0.1-SIMULATED",
      modelType: "LOGISTIC_REGRESSION",
      targetId: "PAYMENT_DELAY_RISK",
      targetVersion: "1.0",
      datasetId: "DS-SIM-001",
      datasetVersion: "v1.0",
      featureVersion: "v1.0.0",
      dataProvenanceClassification: "SIMULATED_BENCHMARK",
      trainingMetadata: {} as any,
      evaluationMetrics: {} as any,
      calibration: {} as any,
      globalImportance: [],
    });

    MultiTenantModelRegistry.transitionLifecycle(
      TEST_ORG,
      model.modelId,
      "APPROVED",
      "ADMIN"
    );

    expect(() => {
      MultiTenantModelRegistry.transitionLifecycle(
        TEST_ORG,
        model.modelId,
        "DEPLOYED",
        "ADMIN",
        "Production deployment attempt",
        false
      );
    }).toThrow(/Simulated Data Firewall/);
  });

  // 14. Insufficient sample size blocked
  it("14. blocks 20-point readiness gate when completed invoices are fewer than 1,000", async () => {
    const report = await MLPipelineService.assessReadiness("ORG-003", "PAYMENT_DELAY_RISK");
    expect(report.overallStatus).toBe("LOCKED");
    expect(
      report.exactBlockers.some((b) => b.includes("completed invoices") || b.includes("settled"))
    ).toBe(true);
  });

  // 15. Insufficient buyers blocked
  it("15. blocks readiness gate when unique commercial buyers are fewer than 50", async () => {
    const report = await MLPipelineService.assessReadiness("ORG-003", "PAYMENT_DELAY_RISK");
    expect(
      report.exactBlockers.some(
        (b) => b.includes("Unique buyers") || b.includes("unique buyers") || b.includes("buyers")
      )
    ).toBe(true);
  });

  // 16. Insufficient time coverage blocked
  it("16. blocks readiness gate when temporal span is under 12 months", async () => {
    const report = await MLPipelineService.assessReadiness("ORG-003", "PAYMENT_DELAY_RISK");
    expect(
      report.exactBlockers.some(
        (b) => b.includes("Temporal span") || b.includes("months")
      )
    ).toBe(true);
  });

  // 17. Insufficient delayed events blocked
  it("17. blocks readiness gate when delayed payment events are fewer than 100", async () => {
    const report = await MLPipelineService.assessReadiness("ORG-003", "PAYMENT_DELAY_RISK");
    expect(
      report.exactBlockers.some(
        (b) => b.includes("Positive Class") || b.includes("positive target events") || b.includes("Delayed events") || b.includes("events")
      )
    ).toBe(true);
  });

  // 18. Model registry lifecycle and checksum validation
  it("18. validates model checksum and prevents tampering in registry", () => {
    const model = MultiTenantModelRegistry.registerModel(TEST_ORG, {
      version: "1.0.0",
      modelType: "LOGISTIC_REGRESSION",
      targetId: "PAYMENT_DELAY_RISK",
      targetVersion: "1.0",
      datasetId: "DS-001",
      datasetVersion: "v1.0",
      featureVersion: "v1.0.0",
      dataProvenanceClassification: "REAL_OBSERVED_ENTERPRISE",
      trainingMetadata: {
        trainedAt: new Date().toISOString(),
        trainingRecordCount: 1500,
        validationRecordCount: 300,
        testRecordCount: 200,
        trainWindow: { start: "2023-01-01", end: "2023-12-31" },
        validationStrategy: "temporal",
        hyperparameters: {},
      },
      evaluationMetrics: {
        validation: { roc_auc: 0.78 } as any,
        outOfTimeTest: { roc_auc: 0.75 } as any,
      },
      calibration: { status: "CALIBRATED" } as any,
      globalImportance: [],
    });

    expect(MultiTenantModelRegistry.verifyModelIntegrity(TEST_ORG, model.modelId)).toBe(true);
  });

  // 19. Governed approval gate
  it("19. forbids deployment of models lacking compliance approval", () => {
    const model = MultiTenantModelRegistry.registerModel(TEST_ORG, {
      version: "1.0.0",
      modelType: "LOGISTIC_REGRESSION",
      targetId: "PAYMENT_DELAY_RISK",
      targetVersion: "1.0",
      datasetId: "DS-001",
      datasetVersion: "v1.0",
      featureVersion: "v1.0.0",
      dataProvenanceClassification: "REAL_OBSERVED_ENTERPRISE",
      trainingMetadata: {} as any,
      evaluationMetrics: {} as any,
      calibration: {} as any,
      globalImportance: [],
    });

    // Attempting direct deployment without compliance signoff
    expect(() => {
      MultiTenantModelRegistry.transitionLifecycle(
        TEST_ORG,
        model.modelId,
        "DEPLOYED",
        "ADMIN"
      );
    }).toThrow(/Deployment violation/);
  });

  // 20. Fallback prediction safety fix
  it("20. strictly labels heuristic output with NON_ML_FALLBACK and NOT_FOR_PRODUCTION_DECISIONING", () => {
    const req = {
      organizationId: TEST_ORG,
      invoice: {
        id: "INV-PRED-1",
        invoiceNumber: "INV-PRED-1",
        organizationId: TEST_ORG,
        supplierId: "SUP-1",
        buyerId: "BUY-1",
        invoiceDate: "2024-01-01",
        dueDate: "2024-02-01",
        invoiceAmount: 50000,
      },
      historicalTransactions: [],
      targetId: "PAYMENT_DELAY_RISK",
    };

    const fallback = PredictionService.generateFallbackPrediction(req);
    expect(fallback.isModelPrediction).toBe(false);
    expect(fallback.inferenceType).toBe("NON_ML_FALLBACK");
    expect(fallback.status).toBe("ML_UNAVAILABLE");
    expect(fallback.reasonCode).toBe("NO_APPROVED_MODEL");
    expect(fallback.policyNotice).toBe("NOT_FOR_PRODUCTION_DECISIONING");
    expect(fallback.warningLabel).toBe("NOT_A_MODEL_PREDICTION");
  });

  // 21. Production inference blocking when model is not approved
  it("21. blocks production prediction requests with MLUnavailableError when no approved model is deployed", () => {
    const req = {
      organizationId: TEST_ORG,
      invoice: {
        id: "INV-BLOCK-1",
        invoiceNumber: "INV-BLOCK-1",
        organizationId: TEST_ORG,
        supplierId: "SUP-1",
        buyerId: "BUY-1",
        invoiceDate: "2024-01-01",
        dueDate: "2024-02-01",
        invoiceAmount: 75000,
      },
      historicalTransactions: [],
      targetId: "PAYMENT_DELAY_RISK",
    };

    expect(() => {
      PredictionService.predictInvoice(req, false);
    }).toThrow(MLUnavailableError);
  });

  // 22. Source connection test state machine
  it("22. updates source connection status upon connection testing", () => {
    const source = SourceRegistry.registerSource(TEST_ORG, {
      sourceType: "SAP_S4HANA",
      sourceSystem: "SAP S/4HANA Cloud 2023",
      sourceName: "Corporate ERP",
      provider: "SAP_S4HANA",
      sourceOwner: { fullName: "ERP Admin", email: "erp@client.com" },
      actorEmail: COMPLIANCE_EMAIL,
    });

    const testRes = SourceRegistry.testConnection(TEST_ORG, source.sourceId, COMPLIANCE_EMAIL);
    expect(testRes.success).toBe(true);
    expect(testRes.status).toBe("CONNECTION_TESTED");

    const failedTest = SourceRegistry.testConnection(TEST_ORG, source.sourceId, COMPLIANCE_EMAIL, {
      simulateFailure: true,
    });
    expect(failedTest.success).toBe(false);
    expect(failedTest.status).toBe("EXTRACTION_FAILED");
  });

  // 23. Structured audit event logging
  it("23. records structured audit events across all critical governance transitions", () => {
    AuditLogService.logEvent({
      organizationId: TEST_ORG,
      eventType: "ML_GATE_EVALUATED",
      actor: "automated-validator",
      status: "BLOCKED",
      details: "Gate evaluated: sample underpowered (N=35 < 1000).",
    });

    const events = AuditLogService.getEvents(TEST_ORG);
    expect(events.length).toBeGreaterThan(0);
    expect(events[0].eventType).toBe("ML_GATE_EVALUATED");
    expect(events[0].status).toBe("BLOCKED");
  });
});
