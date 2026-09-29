/**
 * NEXUS-CFR Phase 7 Integration Test Suite
 * Real Data Acquisition, Provenance Verification, and Governed Unlock
 *
 * Verifies:
 * 1. Valid authorized real file can enter and be ingested
 * 2. Missing authorization blocks ingestion
 * 3. Missing signatory blocks ingestion
 * 4. Simulated file cannot become REAL_OBSERVED_ENTERPRISE
 * 5. Provenance cannot be silently upgraded
 * 6. Tenant isolation works across registered sources
 * 7. Raw snapshot checksum is cryptographically verified
 * 8. Double-entry reconciliation conservation is enforced
 * 9. Real data can be acquired even when ML is statistically insufficient
 * 10. Insufficient real data remains strictly ML_LOCKED
 * 11. Sufficient data can satisfy the ML readiness gate
 * 12. No approved model means ML_UNAVAILABLE and fallback never masquerades as ML
 * 13. Export template contains strictly headers and ZERO fake transactions
 * 14. Acquisition status reports NO_REAL_SOURCE_CONNECTED when no real data exists
 * 15. First real evidence report generates auditable markdown
 */

import { describe, it, expect, beforeEach } from "vitest";
import { ControlledFileIngestionService } from "../src/pipeline/controlledFileIngestionService";
import { SourceRegistry } from "../src/connectors/sourceRegistry";
import { RawSnapshotService } from "../src/pipeline/rawSnapshotService";
import { MLReadinessGate } from "../src/ml/governance/readinessGate";
import { PredictionService, MLUnavailableError } from "../src/ml/prediction/predictionService";
import { MultiTenantModelRegistry } from "../src/ml/registry/modelRegistry";

const TEST_ORG = "ORG-PHASE7-TEST";
const OTHER_ORG = "ORG-PHASE7-OTHER";

const SAMPLE_REAL_CSV = `transaction_id,sme_id,buyer_id,supplier_id,invoice_amount,invoice_date,due_date,payment_date,credit_period,outstanding_amount,payment_status,currency
TX-R-001,SME-REAL-1,BUYER-REAL-1,SUP-1,150000,2024-01-10,2024-02-10,2024-02-08,31,0,PAID,INR
TX-R-002,SME-REAL-1,BUYER-REAL-2,SUP-1,250000,2024-01-15,2024-02-15,2024-03-01,31,0,PAID,INR
TX-R-003,SME-REAL-1,BUYER-REAL-3,SUP-1,75000,2024-02-01,2024-03-01,,30,75000,OPEN,INR
`;

describe("NEXUS-CFR Phase 7: Real Data Acquisition Execution Suite", () => {
  beforeEach(() => {
    // Clean registry for test tenant
    const sources = SourceRegistry.listSourcesForTenant(TEST_ORG);
    // fresh test execution
  });

  // 1. Valid authorized real file can enter and be ingested
  it("01. allows valid authorized real enterprise export to enter the pipeline", async () => {
    const result = await ControlledFileIngestionService.ingestControlledFile({
      organizationId: TEST_ORG,
      uploaderEmail: "cfo@apex-mfg.com",
      filename: "apex_real_ledger_2024.csv",
      rawPayload: SAMPLE_REAL_CSV,
      sourceName: "Apex Manufacturing Ledger",
      corporateEntityName: "Apex Precision Engineering Pvt Ltd",
      corporateRegistrationNumber: "U29253MH2018PTC123456",
      authorizedSignatoryName: "Rajesh Sharma",
      signatoryTitle: "Chief Financial Officer",
      legalConsentReferenceId: "DSA-2026-BOARD-RES-42",
      provenance: "REAL_OBSERVED_ENTERPRISE",
      persistToLedger: false,
    });

    expect(result.fileIngestionId).toBeDefined();
    expect(result.sourceRegistration.provenance).toBe("REAL_OBSERVED_ENTERPRISE");
    expect(result.sourceRegistration.isEnterpriseAuthorized).toBe(true);
    expect(result.summaryBreakdown.classification).toBe("REAL_OBSERVED / AUTHORIZED");
    expect(result.summaryBreakdown.reconciliation).toBe("PASSED");
    expect(result.summaryBreakdown.totalRecords).toBe(3);
  });

  // 2. Missing authorization blocks ingestion
  it("02. blocks ingestion when legal consent reference ID is missing", async () => {
    await expect(
      ControlledFileIngestionService.ingestControlledFile({
        organizationId: TEST_ORG,
        uploaderEmail: "cfo@apex-mfg.com",
        filename: "unauthorized.csv",
        rawPayload: SAMPLE_REAL_CSV,
        corporateEntityName: "Apex Ltd",
        authorizedSignatoryName: "Rajesh Sharma",
        signatoryTitle: "CFO",
        legalConsentReferenceId: "", // EMPTY!
        provenance: "REAL_OBSERVED_ENTERPRISE",
        persistToLedger: false,
      })
    ).rejects.toThrow(/AUTHORIZATION GATE BLOCKED/);
  });

  // 3. Missing signatory blocks ingestion
  it("03. blocks ingestion when corporate signatory name is missing", async () => {
    await expect(
      ControlledFileIngestionService.ingestControlledFile({
        organizationId: TEST_ORG,
        uploaderEmail: "cfo@apex-mfg.com",
        filename: "no_signatory.csv",
        rawPayload: SAMPLE_REAL_CSV,
        corporateEntityName: "Apex Ltd",
        authorizedSignatoryName: "   ", // EMPTY!
        signatoryTitle: "CFO",
        legalConsentReferenceId: "DSA-2026-001",
        provenance: "REAL_OBSERVED_ENTERPRISE",
        persistToLedger: false,
      })
    ).rejects.toThrow(/Authorized corporate signatory name is mandatory/);
  });

  // 4. Simulated file cannot become REAL_OBSERVED_ENTERPRISE
  it("04. prevents simulated files from receiving REAL_OBSERVED classification or unlocking ML", async () => {
    const result = await ControlledFileIngestionService.ingestControlledFile({
      organizationId: TEST_ORG,
      uploaderEmail: "analyst@test.com",
      filename: "simulated_benchmark.csv",
      rawPayload: SAMPLE_REAL_CSV,
      corporateEntityName: "Simulated Test Co",
      authorizedSignatoryName: "Test Officer",
      signatoryTitle: "Analyst",
      legalConsentReferenceId: "TEST-CONSENT-01",
      provenance: "SIMULATED_BENCHMARK",
      persistToLedger: false,
    });

    expect(result.provenance).toBe("SIMULATED_BENCHMARK");
    expect(result.isEligibleForProductionML).toBe(false);
    expect(result.blockers.some((b) => b.includes("SIMULATED FIREWALL"))).toBe(true);
  });

  // 5. Provenance cannot be silently upgraded
  it("05. preserves declared provenance classification without silent promotion", async () => {
    const source = SourceRegistry.registerSource(TEST_ORG, {
      sourceType: "CONTROLLED_FILE_EXPORT",
      sourceSystem: "SYNTHETIC_DATA",
      sourceName: "Synthetic Source",
      provider: "CONTROLLED_FILE_EXPORT",
      sourceOwner: { fullName: "Test", email: "test@example.com" },
      provenance: "SYNTHETIC",
      actorEmail: "test@example.com",
    });

    expect(source.provenance).toBe("SYNTHETIC");
    expect(source.provenance).not.toBe("REAL_OBSERVED_ENTERPRISE");
  });

  // 6. Tenant isolation works across registered sources
  it("06. enforces strict multi-tenant boundary on registered enterprise sources", async () => {
    const source = SourceRegistry.registerSource(TEST_ORG, {
      sourceType: "CONTROLLED_FILE_EXPORT",
      sourceSystem: "TEST_ERP",
      sourceName: "Org 1 Source",
      provider: "CONTROLLED_FILE_EXPORT",
      sourceOwner: { fullName: "Admin", email: "admin@org1.com" },
      provenance: "REAL_OBSERVED_ENTERPRISE",
      actorEmail: "admin@org1.com",
    });

    expect(() => {
      SourceRegistry.getSource(OTHER_ORG, source.sourceId);
    }).toThrow(/Unauthorized cross-tenant access/);
  });

  // 7. Raw snapshot checksum works
  it("07. computes and cryptographically verifies raw snapshot checksum", async () => {
    const snapshot = RawSnapshotService.createSnapshot({
      organizationId: TEST_ORG,
      sourceId: "SRC-TEST-001",
      connectorId: "CONN-FILE",
      batchId: "BAT-001",
      rawRecords: [{ id: "INV-1", amount: 1000 }],
    });

    expect(snapshot.metadata.payloadChecksum).toBeDefined();
    const verified = RawSnapshotService.verifySnapshotIntegrity(TEST_ORG, snapshot.metadata.snapshotId);
    expect(verified).toBe(true);
  });

  // 8. Reconciliation works with double-entry conservation
  it("08. verifies double-entry reconciliation conservation on acquired files", async () => {
    const result = await ControlledFileIngestionService.ingestControlledFile({
      organizationId: TEST_ORG,
      uploaderEmail: "cfo@apex-mfg.com",
      filename: "reconciliation_test.csv",
      rawPayload: SAMPLE_REAL_CSV,
      corporateEntityName: "Apex Ltd",
      authorizedSignatoryName: "Rajesh Sharma",
      signatoryTitle: "CFO",
      legalConsentReferenceId: "DSA-2026-REC-01",
      provenance: "REAL_OBSERVED_ENTERPRISE",
      persistToLedger: false,
    });

    const rec = result.onboarding.reconciliation;
    expect(rec.isFullyReconciled).toBe(true);
    expect(rec.unaccountedDiscrepancy).toBe(0);
    expect(rec.counts.sourceExtractedCount).toBe(3);
  });

  // 9. Real data can be stored even when ML is insufficient
  it("09. accepts and records genuine enterprise data even when sample size is insufficient for ML", async () => {
    const smallRealCsv = `transaction_id,sme_id,buyer_id,invoice_amount,invoice_date,due_date,payment_date,payment_status
TX-SM-1,SME-1,BUY-1,50000,2024-01-01,2024-02-01,2024-01-28,PAID
TX-SM-2,SME-1,BUY-2,75000,2024-01-05,2024-02-05,2024-02-15,PAID
`;
    const result = await ControlledFileIngestionService.ingestControlledFile({
      organizationId: TEST_ORG,
      uploaderEmail: "cfo@apex-mfg.com",
      filename: "small_real.csv",
      rawPayload: smallRealCsv,
      corporateEntityName: "Apex Ltd",
      authorizedSignatoryName: "Rajesh Sharma",
      signatoryTitle: "CFO",
      legalConsentReferenceId: "DSA-SMALL-01",
      provenance: "REAL_OBSERVED_ENTERPRISE",
      persistToLedger: false,
    });

    // CRITICAL PRINCIPLE: Ingestion succeeds! Data is REAL_OBSERVED!
    expect(result.provenance).toBe("REAL_OBSERVED_ENTERPRISE");
    expect(result.summaryBreakdown.totalRecords).toBe(2);
    expect(result.summaryBreakdown.reconciliation).toBe("PASSED");
  });

  // 10. Insufficient real data remains ML_LOCKED
  it("10. keeps ML readiness gate strictly LOCKED when real data has insufficient records or buyers", async () => {
    const smallRealCsv = `transaction_id,sme_id,buyer_id,invoice_amount,invoice_date,due_date,payment_date,payment_status
TX-SM-1,SME-1,BUY-1,50000,2024-01-01,2024-02-01,2024-01-28,PAID
TX-SM-2,SME-1,BUY-2,75000,2024-01-05,2024-02-05,2024-02-15,PAID
`;
    const result = await ControlledFileIngestionService.ingestControlledFile({
      organizationId: TEST_ORG,
      uploaderEmail: "cfo@apex-mfg.com",
      filename: "small_real_locked.csv",
      rawPayload: smallRealCsv,
      corporateEntityName: "Apex Ltd",
      authorizedSignatoryName: "Rajesh Sharma",
      signatoryTitle: "CFO",
      legalConsentReferenceId: "DSA-LOCKED-01",
      provenance: "REAL_OBSERVED_ENTERPRISE",
      persistToLedger: false,
    });

    expect(result.isEligibleForProductionML).toBe(false);
    expect(result.summaryBreakdown.mlReadiness).toBe("LOCKED");
    expect(result.blockers.length).toBeGreaterThan(0);
  });

  // 11. Sufficient real data can trigger the existing ML gate
  it("11. evaluates 20-point ML readiness gate to READY when statistical power requirements are met", () => {
    const earliestDate = new Date("2023-01-01");
    const latestDate = new Date("2024-06-30");
    const readiness = MLReadinessGate.evaluateDataset({
      targetId: "PAYMENT_DELAY_RISK",
      organizationId: TEST_ORG,
      sourceClassification: "REAL_OBSERVED_ENTERPRISE",
      isEnterpriseAuthorized: true,
      hasActiveLegalConsent: true,
      totalTransactions: 1500,
      completedTransactions: 1200,
      openTransactions: 300,
      uniqueBuyers: 60,
      uniqueSuppliers: 15,
      earliestDate,
      latestDate,
      missingDueDatesCount: 0,
      missingAmountsCount: 0,
      duplicateTransactionsCount: 0,
      observedDelayedCount: 150,
      detectedLeakageFields: [],
      governanceApproved: true,
    });

    expect(readiness.overallStatus).toBe("READY");
    expect(readiness.blockerCount).toBe(0);
    expect(readiness.summary).toContain("ML TRAINING UNLOCKED");
  });

  // 12. No approved model means ML_UNAVAILABLE and fallback never masquerades as ML
  it("12. throws MLUnavailableError when attempting model inference without approved deployed model", () => {
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

    expect(() => {
      PredictionService.predictInvoice(req, false);
    }).toThrow(MLUnavailableError);

    // Fallback is strictly watermarked
    const fallback = PredictionService.generateFallbackPrediction(req);
    expect(fallback.isModelPrediction).toBe(false);
    expect(fallback.inferenceType).toBe("NON_ML_FALLBACK");
    expect(fallback.warningLabel).toBe("NOT_A_MODEL_PREDICTION");
    expect(fallback.policyNotice).toBe("NOT_FOR_PRODUCTION_DECISIONING");
  });

  // 13. Export template contains strictly headers and ZERO fake transactions
  it("13. generates an authoritative export template containing ONLY column headers and NO fake rows", () => {
    const template = ControlledFileIngestionService.getAuthorizedExportTemplateCsv();
    const lines = template.trim().split("\n");
    expect(lines.length).toBe(1); // HEADERS ONLY!
    expect(lines[0]).toBe(
      "transaction_id,sme_id,buyer_id,supplier_id,invoice_amount,invoice_date,due_date,payment_date,credit_period,outstanding_amount,payment_status,currency"
    );
  });

  // 14. Acquisition status reports NO_REAL_SOURCE_CONNECTED when no real data exists
  it("14. truthfully reports NO_REAL_SOURCE_CONNECTED when no primary data is attached", async () => {
    const status = await ControlledFileIngestionService.getRealDataAcquisitionStatus("ORG-UNATTACHED");
    expect(status.realDataAcquired).toBe(false);
    expect(status.status).toBe("NO_REAL_SOURCE_CONNECTED");
    expect(status.missingHumanAction).toBe("UPLOAD_AUTHORIZED_REAL_EXPORT");
    expect(status.actualRecordCount).toBe(0);
  });

  // 15. First real evidence report generates comprehensive auditable markdown
  it("15. generates First Real Evidence Report with auditable markdown structure", async () => {
    const result = await ControlledFileIngestionService.ingestControlledFile({
      organizationId: TEST_ORG,
      uploaderEmail: "cfo@apex-mfg.com",
      filename: "evidence_report_test.csv",
      rawPayload: SAMPLE_REAL_CSV,
      corporateEntityName: "Apex Ltd",
      authorizedSignatoryName: "Rajesh Sharma",
      signatoryTitle: "CFO",
      legalConsentReferenceId: "DSA-REPORT-01",
      provenance: "REAL_OBSERVED_ENTERPRISE",
      persistToLedger: false,
    });

    const report = ControlledFileIngestionService.generateFirstRealEvidenceReport(TEST_ORG, result);
    expect(report).toContain("NEXUS-CFR FIRST REAL DATA EVIDENCE REPORT");
    expect(report).toContain("REAL DATA EVIDENCE — ACQUIRED PRIMARY ENTERPRISE LEDGER");
    expect(report).toContain(result.fileChecksumSha256);
    expect(report).toContain("Apex Ltd");
    expect(report).toContain("Reconciliation Audit");
  });
});
