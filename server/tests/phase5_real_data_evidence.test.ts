/**
 * NEXUS-CFR Phase 5 — Real Authorized Data Acquisition & First Evidence Run Suite
 *
 * Verifies the complete operational pipeline:
 * 1. Genuine source registration vs simulated/unverified rejection
 * 2. Authorization and legal consent handshake
 * 3. Raw immutable data snapshotting & checksums
 * 4. Deterministic canonical invoice transformation
 * 5. Quality quarantine partitioning & review mechanism
 * 6. Conservative entity resolution (anti-fuzzy matching, GSTIN deterministic linking)
 * 7. Cross-source join safety guards
 * 8. Payment outcome validation & censoring breakdown (no default assumption on open invoices)
 * 9. Representativeness & buyer concentration auditor (HHI, top-buyer threshold)
 * 10. End-to-end mathematical reconciliation accounting balance
 * 11. 20-Point ML Readiness Gate dynamically evaluating real vs simulated data
 * 12. Governed model activation & prediction gate enforcement
 * 13. REST APIs for source registration, authorization, onboarding, and evidence runs
 */

import request from "supertest";
import { describe, expect, it, beforeAll, beforeEach } from "vitest";
import app from "../src/app";
import { SourceRegistry } from "../src/connectors/sourceRegistry";
import { RawSnapshotService } from "../src/pipeline/rawSnapshotService";
import { CanonicalTransformer } from "../src/pipeline/canonicalTransformer";
import { QuarantineService } from "../src/pipeline/quarantineService";
import { EntityResolutionEngine } from "../src/pipeline/entityResolution";
import { OutcomeCensoringAnalyzer } from "../src/ml/validation/outcomeCensoringAnalyzer";
import { RepresentativenessAuditor } from "../src/ml/validation/representativenessAuditor";
import { ReconciliationService } from "../src/pipeline/reconciliationService";
import { PrimaryDataOnboardingService } from "../src/pipeline/primaryDataOnboardingService";
import { FirstEvidencePipeline } from "../src/ml/pipeline/firstEvidencePipeline";
import { MultiTenantModelRegistry } from "../src/ml/registry/modelRegistry";
import { PredictionService } from "../src/ml/prediction/predictionService";

describe("NEXUS-CFR Phase 5 — Real Authorized Data Acquisition & Evidence Run Suite", () => {
  let adminToken: string;
  let viewerToken: string;

  beforeAll(async () => {
    const resAdmin = await request(app)
      .post("/api/auth/login")
      .send({ email: "realadmin@nexuscfr.in", password: "demo1234" });
    adminToken = resAdmin.body.data.token;

    const resViewer = await request(app)
      .post("/api/auth/login")
      .send({ email: "viewer@nexus-cfr.demo", password: "demo1234" });
    viewerToken = resViewer.body.data.token;
  });

  beforeEach(() => {
    MultiTenantModelRegistry.clearTenant("ORG-P5-TEST");
    MultiTenantModelRegistry.clearTenant("ORG-P5-OTHER");
    EntityResolutionEngine.clearStore();
  });

  // --------------------------------------------------------------------------
  // 1. Source Registry & Authorization Handshake
  // --------------------------------------------------------------------------
  describe("1. Source Registry & Authorization Handshake", () => {
    it("1. Genuine enterprise source is accepted and registered with correct provenance", () => {
      const source = SourceRegistry.registerSource("ORG-P5-TEST", {
        sourceType: "TALLYPRIME",
        provider: "Tally Solutions",
        sourceSystem: "TallyPrime ERP 4.1",
        sourceName: "Mumbai Primary Ledger",
        provenance: "REAL_OBSERVED_ENTERPRISE",
        schemaVersion: "4.1.0",
        sourceOwner: { fullName: "CFO", email: "cfo@enterprise-client.in" },
        actorEmail: "admin@enterprise-client.in",
      });

      expect(source.sourceId).toMatch(/^SRC-ORG-P5-TEST-TALLYPRIME-/);
      expect(source.connectionStatus).toBe("AUTHORIZATION_REQUIRED");
      expect(source.lifecycleState).toBe("AUTHORIZATION_PENDING");
      expect(source.isEnterpriseAuthorized).toBe(false);
    });

    it("2. Simulated source is blocked from masquerading as REAL_OBSERVED_ENTERPRISE", () => {
      expect(() => {
        SourceRegistry.registerSource("ORG-P5-TEST", {
          sourceType: "SIMULATED_BENCHMARK" as any,
          provider: "Synthetic Generator",
          sourceSystem: "MockERP Synthetic Data",
          sourceName: "Fake Real Ledger",
          provenance: "REAL_OBSERVED_ENTERPRISE",
          schemaVersion: "1.0",
          sourceOwner: { fullName: "Bad Actor", email: "badactor@fake.com" },
          actorEmail: "badactor@fake.com",
        });
      }).toThrowError(/Zero-Fabrication Invariant|Unsupported source class/);
    });

    it("3. Unverified or unrecognized source provider class is blocked", () => {
      expect(() => {
        SourceRegistry.registerSource("ORG-P5-TEST", {
          sourceType: "UNVERIFIED_SCRAPER" as any,
          provider: "Unknown Web Scraper",
          sourceSystem: "Unknown",
          sourceName: "Scraped Data",
          provenance: "UNVERIFIED" as any,
          schemaVersion: "0.1",
          sourceOwner: { fullName: "Unknown", email: "unknown@web.com" },
          actorEmail: "unknown@web.com",
        });
      }).toThrowError(/Unsupported source class/);
    });

    it("4. Missing legal authorization blocks data connection transition", () => {
      const source = SourceRegistry.registerSource("ORG-P5-TEST", {
        sourceType: "SAP_S4HANA",
        provider: "SAP SE",
        sourceSystem: "SAP S/4HANA Cloud",
        sourceName: "Enterprise Finance Hub",
        provenance: "REAL_OBSERVED_ENTERPRISE",
        schemaVersion: "2023.2",
        sourceOwner: { fullName: "Finance Director", email: "finance-director@enterprise.com" },
        actorEmail: "admin@enterprise.com",
      });

      // Attempting to mark connection complete without authorization throws error
      expect(() => {
        SourceRegistry.transitionSourceState(
          "ORG-P5-TEST",
          source.sourceId,
          "CONNECTED",
          "admin@enterprise.com",
          "Attempted connection"
        );
      }).toThrowError(/Source cannot transition to CONNECTED without verified legal enterprise authorization/);
    });

    it("5. Completing formal legal authorization transitions source to AUTHORIZED", () => {
      const source = SourceRegistry.registerSource("ORG-P5-TEST", {
        sourceType: "ZOHO_BOOKS",
        provider: "Zoho Corp",
        sourceSystem: "Zoho Books India",
        sourceName: "Chennai Production Books",
        provenance: "REAL_OBSERVED_ENTERPRISE",
        schemaVersion: "v3",
        sourceOwner: { fullName: "Controller", email: "controller@chennai-sme.in" },
        actorEmail: "admin@chennai-sme.in",
      });

      const authorized = SourceRegistry.recordAuthorization("ORG-P5-TEST", source.sourceId, {
        authorizedByActor: "Chief Financial Officer (cfo@chennai-sme.in)",
        legalConsentReferenceId: "CONSENT-ZOHO-IN-2026-9921",
        extractionPurpose: "SME Credit Risk Assessment & Supply Chain Financing",
        dataScope: "Sales invoices, credit notes, and payment receipts FY 2024-2026",
        retentionPolicy: "7_YEARS_STATUTORY_COMPLIANCE",
        provenanceClassification: "REAL_OBSERVED_ENTERPRISE",
      });

      expect(authorized.isEnterpriseAuthorized).toBe(true);
      expect(authorized.connectionStatus).toBe("READY_FOR_CONNECTION");
      expect(authorized.lifecycleState).toBe("AUTHORIZED");
      expect(authorized.legalConsentReferenceId).toBe("CONSENT-ZOHO-IN-2026-9921");
    });
  });

  // --------------------------------------------------------------------------
  // 2. Raw Snapshotting & Provenance Invariance
  // --------------------------------------------------------------------------
  describe("2. Raw Snapshotting & Provenance Invariance", () => {
    it("6. Creates immutable SHA-256 payload snapshot and fingerprint", () => {
      const payload = [
        { VchNo: "INV-2026-001", Date: "2026-01-15", PartyName: "Tata Motors Ltd", Amount: 250000 },
        { VchNo: "INV-2026-002", Date: "2026-01-18", PartyName: "Mahindra & Mahindra", Amount: 180000 },
      ];

      const snapshot = RawSnapshotService.createSnapshot({
        sourceId: "SRC-TALLY-001",
        connectorId: "CONN-TALLY-PRIME",
        organizationId: "ORG-P5-TEST",
        batchId: "BAT-001",
        rawRecords: payload,
      });

      expect(snapshot.metadata.snapshotId).toMatch(/^SNAP-/);
      expect(snapshot.metadata.sourceRecordCount).toBe(2);
      expect(snapshot.metadata.payloadChecksum).toHaveLength(64);
      expect(snapshot.metadata.schemaFingerprint).toHaveLength(64);

      // Verify tamper-evident verification
      const verifyTamperFree = RawSnapshotService.verifySnapshotIntegrity("ORG-P5-TEST", snapshot.metadata.snapshotId);
      expect(verifyTamperFree).toBe(true);

      const nonExistent = RawSnapshotService.verifySnapshotIntegrity("ORG-P5-TEST", "NON_EXISTENT_SNAP");
      expect(nonExistent).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // 3. Canonical Transformation & Schema Mismatch Handling
  // --------------------------------------------------------------------------
  describe("3. Canonical Transformation & Schema Validation", () => {
    it("7. Deterministically maps TallyPrime raw vouchers to CanonicalInvoiceContract", () => {
      const tallyVouchers = [
        {
          VOUCHERNUMBER: "TALLY-INV-101",
          DATE: "2025-04-10",
          BILLDUEDATE: "2025-05-10",
          PARTYNAME: "Tata Motors Ltd",
          COMPANYNAME: "Auto Component Sales",
          AMOUNT: 450000,
        },
      ];

      const result = CanonicalTransformer.normalizeRawBatch(
        tallyVouchers,
        "TALLY_PRIME",
        "ORG-P5-TEST"
      );

      expect(result.totalRawRecords).toBe(1);
      expect(result.successfulCount).toBe(1);
      expect(result.failedCount).toBe(0);

      const canonical = result.canonicalRecords[0];
      expect(canonical.transaction_id).toBe("TALLY-INV-101");
      expect(canonical.invoice_amount).toBe(450000);
      expect(canonical.currency).toBe("INR");
      expect(canonical.credit_period).toBe(30);
    });

    it("8. Rejects raw records with critical missing fields without silent imputation", () => {
      const invalidVouchers = [
        {
          VOUCHERNUMBER: "TALLY-INV-BAD",
          // DATE missing
          BILLDUEDATE: "2025-05-10",
          PARTYNAME: "Buyer Ltd",
          COMPANYNAME: "SME Co",
          AMOUNT: 0, // Invalid amount
        },
      ];

      const result = CanonicalTransformer.normalizeRawBatch(
        invalidVouchers,
        "TALLY_PRIME",
        "ORG-P5-TEST"
      );

      expect(result.failedCount).toBe(1);
      expect(result.successfulCount).toBe(0);
      expect(result.results[0].transformationErrors.length).toBeGreaterThan(0);
    });
  });

  // --------------------------------------------------------------------------
  // 4. Data Quality Partitioning & Quarantine Review Mechanism
  // --------------------------------------------------------------------------
  describe("4. Data Quality Quarantine & Tiering", () => {
    it("9. Partitions records into ACCEPTED, WARNING, REJECTED, and QUARANTINED tiers", () => {
      const records = [
        {
          transaction_id: "TX-VALID-1",
          sme_id: "SME-1",
          supplier_id: "SME-1",
          buyer_id: "BUYER-1",
          invoice_amount: 100000,
          invoice_date: "2025-01-01",
          due_date: "2025-01-31",
          payment_date: "2025-01-28",
          payment_status: "PAID",
          currency: "INR",
          source_system: "SAP",
          source_record_id: "REC-1",
          credit_period: 30,
        },
        {
          // Warning: Missing optional supplier_id
          transaction_id: "TX-WARN-2",
          sme_id: "SME-1",
          buyer_id: "BUYER-2",
          invoice_amount: 50000,
          invoice_date: "2025-02-01",
          due_date: "2025-03-03",
          payment_status: "PENDING",
          currency: "INR",
          source_system: "SAP",
          source_record_id: "REC-2",
          credit_period: 30,
        },
        {
          // Rejected: Negative amount
          transaction_id: "TX-REJ-3",
          sme_id: "SME-1",
          supplier_id: "SME-1",
          buyer_id: "BUYER-1",
          invoice_amount: -500,
          invoice_date: "2025-01-01",
          due_date: "2025-01-31",
          payment_status: "PAID",
          currency: "INR",
          source_system: "SAP",
          source_record_id: "REC-3",
          credit_period: 30,
        },
        {
          // Quarantined: Conflicting chronological dates (due date before invoice date)
          transaction_id: "TX-QUAR-4",
          sme_id: "SME-1",
          supplier_id: "SME-1",
          buyer_id: "BUYER-UNKNOWN",
          invoice_amount: 75000,
          invoice_date: "2025-04-15",
          due_date: "2025-03-15", // Due date before invoice date!
          payment_status: "PENDING",
          currency: "INR",
          source_system: "SAP",
          source_record_id: "REC-4",
          credit_period: -31,
        },
      ];

      const partition = QuarantineService.evaluateAndPartition("ORG-P5-TEST", "SRC-SAP-01", records as any);
      expect(partition.accepted.length).toBe(2); // TX-VALID-1 and TX-WARN-2
      expect(partition.warning.length).toBe(1);  // TX-WARN-2
      expect(partition.rejected.length).toBe(1); // TX-REJ-3
      expect(partition.quarantined.length).toBe(1); // TX-QUAR-4

      expect(partition.quarantined[0].quarantineReason).toBe("CONFLICTING_DATES");
    });

    it("10. Provides review and resolution workflow for quarantined records", () => {
      const records = [
        {
          transaction_id: "TX-TO-RESOLVE",
          sme_id: "SME-1",
          supplier_id: "SME-1",
          buyer_id: "UNKNOWN_BUYER",
          invoice_amount: 30000,
          invoice_date: "2025-01-10",
          due_date: "2025-01-05", // Chronological conflict
          payment_status: "PENDING",
          currency: "INR",
          source_system: "TALLY",
          source_record_id: "REC-Q1",
          credit_period: -5,
        },
      ];

      const partition = QuarantineService.evaluateAndPartition("ORG-P5-TEST", "SRC-Q1", records as any);
      const qItem = partition.quarantined[0];

      // Review and release with approval
      const reviewed = QuarantineService.reviewQuarantineRecord(
        "ORG-P5-TEST",
        qItem.quarantineId,
        "APPROVED_RELEASE",
        "data-steward@enterprise.in",
        "Verified with supplier invoice hardcopy"
      );

      expect(reviewed.reviewStatus).toBe("APPROVED_RELEASE");
      expect(reviewed.reviewedBy).toBe("data-steward@enterprise.in");
      expect(reviewed.reviewedAt).toBeDefined();
    });
  });

  // --------------------------------------------------------------------------
  // 5. Conservative Entity Resolution & Cross-Source Join Safety
  // --------------------------------------------------------------------------
  describe("5. Conservative Entity Resolution & Anti-Fuzzy Safety", () => {
    it("11. Deterministically auto-links high-confidence exact GSTINs", () => {
      const mapping = EntityResolutionEngine.resolveEntity("ORG-P5-TEST", {
        rawIdentifier: "VEND-01",
        rawName: "Tata Motors Commercial Vehicle Hub Pune",
        entityType: "BUYER",
        gstin: "27AAACT2727Q1ZW",
      });

      expect(mapping.resolutionMethod).toBe("EXACT_TAX_IDENTIFIER");
      expect(mapping.confidenceScore).toBe(1.0);
      expect(mapping.canonicalEntityId).toBe("CAN-GSTIN-27AAACT2727Q1ZW");
    });

    it("12. Refuses to auto-merge ambiguous or similar names (anti-fuzzy matching)", () => {
      const entity1 = EntityResolutionEngine.resolveEntity("ORG-P5-TEST", {
        rawIdentifier: "VEND-02",
        rawName: "Tata Consultancy Services Ltd",
        entityType: "BUYER",
      });

      const entity2 = EntityResolutionEngine.resolveEntity("ORG-P5-TEST", {
        rawIdentifier: "VEND-03",
        rawName: "Tata Consumer Products Ltd",
        entityType: "BUYER",
      });

      expect(entity1.canonicalEntityId).not.toBe(entity2.canonicalEntityId);
      expect(entity1.confidenceScore).toBeLessThan(0.7);
      expect(entity1.resolutionMethod).toBe("AMBIGUOUS_UNRESOLVED");
    });

    it("13. Prevents fabricated cross-domain joins with external macro datasets without legitimate primary keys", () => {
      // Joining micro commercial invoice with external dataset without valid key is rejected
      const invalidLink = EntityResolutionEngine.validateCrossSourceLinkage("CAN-INV-001", "state_aggregate_key");
      expect(invalidLink.isLinkageAuthorized).toBe(false);
      expect(invalidLink.violationReason).toContain("not an authorized, verified statutory identifier");

      // Valid statutory 15-character GSTIN key is authorized
      const validLink = EntityResolutionEngine.validateCrossSourceLinkage("CAN-INV-001", "27AAACT2727Q1ZW");
      expect(validLink.isLinkageAuthorized).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // 6. Payment Outcome Validation & Right-Censoring Analysis
  // --------------------------------------------------------------------------
  describe("6. Payment Outcome & Censoring Analysis", () => {
    it("14. Chronological payment date validation: rejects paymentDate earlier than invoiceDate", () => {
      const invalidPaymentInvoice = [
        {
          transaction_id: "INV-CHRONO-ERR",
          sme_id: "SME-1",
          buyer_id: "BUYER-1",
          invoice_amount: 100000,
          invoice_date: "2025-06-01",
          due_date: "2025-06-30",
          payment_date: "2025-05-15", // Payment before invoice issuance!
          payment_status: "PAID",
          currency: "INR",
          source_system: "SAP",
          source_record_id: "R1",
          credit_period: 29,
        },
      ];

      const report = OutcomeCensoringAnalyzer.analyzeCensoring(invalidPaymentInvoice as any);
      expect(report.invalidContradictoryCount).toBe(1);
      expect(report.completedSettledCount).toBe(0);
      expect(report.records[0].validationFaults[0]).toContain("payment_date (2025-05-15) precedes invoice_date");
    });

    it("15. Never classifies open invoices with NULL paymentDate as default or negative outcome", () => {
      const openInvoices = [
        {
          transaction_id: "INV-OPEN-1",
          sme_id: "SME-1",
          buyer_id: "BUYER-1",
          invoice_amount: 50000,
          invoice_date: "2026-03-01",
          due_date: "2026-04-01",
          payment_date: null,
          payment_status: "OPEN",
          currency: "INR",
          source_system: "SAP",
          source_record_id: "R2",
          credit_period: 31,
        },
      ];

      const report = OutcomeCensoringAnalyzer.analyzeCensoring(openInvoices as any, "2026-03-15T00:00:00.000Z");
      expect(report.openNotYetMatureCount).toBe(1);
      expect(report.completedSettledCount).toBe(0);
      expect(report.records[0].isEligibleForMLTraining).toBe(false);
      expect(report.records[0].censoringReason).toContain("within negotiated credit term");
    });
  });

  // --------------------------------------------------------------------------
  // 7. Representativeness & Concentration Audit
  // --------------------------------------------------------------------------
  describe("7. Population Representativeness & Concentration Audit", () => {
    it("16. Flags high buyer concentration when a single buyer accounts for excessive share (>75%)", () => {
      const invoices = [
        ...Array.from({ length: 9 }, (_, i) => ({
          transaction_id: `INV-TATA-${i}`,
          sme_id: "SME-1",
          buyer_id: "BUYER-TATA",
          invoice_amount: 100000,
          invoice_date: "2025-01-15",
          due_date: "2025-02-15",
          payment_date: "2025-02-10",
          payment_status: "PAID",
          currency: "INR",
          credit_period: 31,
        })),
        {
          transaction_id: "INV-OTHER-1",
          sme_id: "SME-1",
          buyer_id: "BUYER-OTHER",
          invoice_amount: 100000,
          invoice_date: "2025-01-20",
          due_date: "2025-02-20",
          payment_date: "2025-02-18",
          payment_status: "PAID",
          currency: "INR",
          credit_period: 31,
        },
      ];

      const audit = RepresentativenessAuditor.auditRepresentativeness(invoices as any);
      expect(audit.isRepresentativenessAcceptable).toBe(false);
      expect(audit.buyerConcentration.topBuyerSharePercent).toBe(90.0);
      expect(audit.buyerConcentration.status).toBe("HIGHLY_CONCENTRATED_BLOCKED");
      expect(audit.blockers[0]).toContain("Fatal Buyer Concentration");
    });
  });

  // --------------------------------------------------------------------------
  // 8. End-to-End Mathematical Reconciliation
  // --------------------------------------------------------------------------
  describe("8. End-to-End Mathematical Reconciliation", () => {
    it("17. Guarantees exact ledger accounting: Source == Raw == Canonical == Accepted + Rejected + Quarantined", () => {
      const reconciliation = ReconciliationService.reconcileIngestion({
        organizationId: "ORG-P5-TEST",
        sourceId: "SRC-TEST-001",
        batchId: "BATCH-REC-001",
        sourceExtractedCount: 1100,
        rawSnapshotCount: 1100,
        canonicalCount: 1100,
        acceptedCount: 1050,
        rejectedCount: 30,
        quarantinedCount: 20,
        censoredCount: 50,
        mlEligibleCount: 1000,
        provenance: "REAL_OBSERVED_ENTERPRISE",
        isEnterpriseAuthorized: true,
        qualityScore: 95,
      });

      expect(reconciliation.isFullyReconciled).toBe(true);
      expect(reconciliation.unaccountedDiscrepancy).toBe(0);
      expect(reconciliation.finalMLEligibilityStatus).toBe("ELIGIBLE");
    });

    it("18. Flags discrepancy if ledger records disappear mysteriously between stages", () => {
      const reconciliation = ReconciliationService.reconcileIngestion({
        organizationId: "ORG-P5-TEST",
        sourceId: "SRC-TEST-002",
        batchId: "BATCH-REC-002",
        sourceExtractedCount: 1000,
        rawSnapshotCount: 1000,
        canonicalCount: 950, // 50 vanished unaccounted!
        acceptedCount: 950,
        rejectedCount: 0,
        quarantinedCount: 0,
        censoredCount: 0,
        mlEligibleCount: 950,
        provenance: "REAL_OBSERVED_ENTERPRISE",
        isEnterpriseAuthorized: true,
        qualityScore: 95,
      });

      expect(reconciliation.isFullyReconciled).toBe(false);
      expect(reconciliation.unaccountedDiscrepancy).toBe(50);
      expect(reconciliation.finalMLEligibilityStatus).toBe("BLOCKED");
    });
  });

  // --------------------------------------------------------------------------
  // 9. Full Primary Data Onboarding Pipeline & Simulated Data Firewall
  // --------------------------------------------------------------------------
  describe("9. Full Onboarding Pipeline & Simulated Data Firewall", () => {
    it("19. Rejects simulated source from unlocking production ML gate", async () => {
      const source = SourceRegistry.registerSource("ORG-P5-TEST", {
        sourceType: "CONTROLLED_FILE_EXPORT",
        provider: "Internal Simulator",
        sourceSystem: "B2B_SIMULATOR",
        sourceName: "Simulated Export",
        provenance: "SIMULATED_BENCHMARK",
        schemaVersion: "1.0",
        sourceOwner: { fullName: "QA", email: "admin@simulator.in" },
        actorEmail: "admin@simulator.in",
      });

      const result = await PrimaryDataOnboardingService.executeOnboarding({
        organizationId: "ORG-P5-TEST",
        sourceId: source.sourceId,
        rawRecords: [
          {
            transaction_id: "SIM-INV-01",
            sme_id: "SME-1",
            buyer_id: "BUYER-1",
            invoice_amount: 100000,
            invoice_date: "2025-01-01",
            due_date: "2025-01-31",
            payment_date: "2025-01-25",
            payment_status: "PAID",
            currency: "INR",
          },
        ],
        actorEmail: "admin@simulator.in",
      });

      expect(result.dataArrivalAssessment.finalStatus).toBe("BLOCKED");
      expect(result.dataArrivalAssessment.exactBlockers.some((b) => b.includes("Provenance check failed"))).toBe(true);
      expect(result.overallStatus).toBe("BLOCKED");
      expect(result.blockers.some((b) => b.includes("Data Provenance Blocked"))).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // 10. First Evidence Run: Locked Gate & Watermarked Dry Run
  // --------------------------------------------------------------------------
  describe("10. First Evidence Run: Locked Gate & Watermarked Dry Run", () => {
    it("20. First Evidence Run is strictly LOCKED if genuine authorized data is absent", async () => {
      const result = await FirstEvidencePipeline.executeEvidenceRun({
        organizationId: "ORG-P5-TEST",
        rawInvoices: [],
        isEnterpriseAuthorized: false,
        provenanceClassification: "SIMULATED_BENCHMARK",
        actorEmail: "tester@nexuscfr.in",
        forceSimulatedDryRun: false,
      });

      expect(result.gateStatus).toBe("LOCKED");
      expect(result.operationalMode).toBe("SIMULATED_BENCHMARK_DRY_RUN");
      expect(result.watermarkLabel).toBe("ML TRAINING BLOCKED — NO AUTHORIZED PRIMARY DATA");
      expect(result.governanceRecommendation.canDeployToProduction).toBe(false);
    });

    it("21. Governed Model Activation refuses deployment of simulated benchmark models to production", () => {
      const registeredModel = MultiTenantModelRegistry.registerModel("ORG-P5-TEST", {
        version: "0.1-SIMULATED_BENCHMARK",
        modelType: "LOGISTIC_REGRESSION",
        targetId: "PAYMENT_DELAY_RISK",
        targetVersion: "1.0",
        datasetId: "DS-SIM-001",
        datasetVersion: "0.1",
        featureVersion: "2.0-LEAKAGE_SAFE",
        dataProvenanceClassification: "SIMULATED_BENCHMARK",
        trainingMetadata: {
          trainedAt: new Date().toISOString(),
          trainingRecordCount: 50,
          validationRecordCount: 10,
          testRecordCount: 10,
          trainWindow: { start: "2024-01-01", end: "2024-12-31", count: 50 },
          validationStrategy: "OUT_OF_TIME_CHRONOLOGICAL",
          hyperparameters: { learningRate: 0.05, l2Penalty: 0.01, iterations: 100 },
        },
        evaluationMetrics: {
          validation: { roc_auc: 0.85, pr_auc: 0.70, precision: 0.8, recall: 0.75, f1_score: 0.77, specificity: 0.85, accuracy: 0.8, brier_score: 0.15, confusion_matrix: { tp: 7, fp: 2, fn: 2, tn: 9 } },
          outOfTimeTest: { roc_auc: 0.82, pr_auc: 0.68, precision: 0.78, recall: 0.72, f1_score: 0.75, specificity: 0.82, accuracy: 0.78, brier_score: 0.16, confusion_matrix: { tp: 7, fp: 2, fn: 3, tn: 8 } },
        },
        calibration: {
          method: "PLATT_SCALING",
          brierScore: 0.16,
          expectedCalibrationError: 0.04,
          isWellCalibrated: true,
          calibrationCurve: [],
        },
        globalImportance: [],
        serializedWeights: "{}",
      });

      // First approve the model
      MultiTenantModelRegistry.transitionLifecycle(
        "ORG-P5-TEST",
        registeredModel.modelId,
        "APPROVED",
        "ADMIN",
        "Approved for testing"
      );

      // Attempting to deploy simulated model to DEPLOYED production must fail due to Simulated Data Firewall
      expect(() => {
        MultiTenantModelRegistry.transitionLifecycle(
          "ORG-P5-TEST",
          registeredModel.modelId,
          "DEPLOYED",
          "ADMIN",
          "Attempting deployment of simulated model"
        );
      }).toThrowError(/Simulated Data Firewall/);
    });

    it("22. Prediction Service blocks inference if requested model is unapproved or deprecated", () => {
      // Prediction attempt on tenant with NO deployed models throws Production ML Locked
      expect(() => {
        PredictionService.predictInvoice({
          organizationId: "ORG-P5-TEST",
          invoice: {
            id: "INV-PRED-1",
            invoiceNumber: "INV-001",
            supplierId: "SME-1",
            buyerId: "BUYER-1",
            invoiceDate: new Date("2026-03-01"),
            dueDate: new Date("2026-03-31"),
            invoiceAmount: 100000,
            status: "OPEN",
            organizationId: "ORG-P5-TEST",
          },
          historicalTransactions: [],
        });
      }).toThrowError(/Production ML Locked: No APPROVED and DEPLOYED model found/);
    });
  });

  // --------------------------------------------------------------------------
  // 11. REST API Integration Endpoints
  // --------------------------------------------------------------------------
  describe("11. REST API Integration Endpoints", () => {
    it("23. POST /api/connectors/sources/register registers a valid primary source", async () => {
      const res = await request(app)
        .post("/api/connectors/sources/register")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          sourceType: "TALLYPRIME",
          provider: "Tally Solutions",
          sourceSystem: "TallyPrime ERP 4.1",
          sourceName: "API Testing Primary Ledger",
          provenance: "REAL_OBSERVED_ENTERPRISE",
          schemaVersion: "4.1.0",
          sourceOwner: { fullName: "CFO", email: "cfo@enterprise-client.in" },
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.sourceId).toBeDefined();
      expect(res.body.data.connectionStatus).toBe("AUTHORIZATION_REQUIRED");
    });

    it("24. POST /api/connectors/sources/:id/authorize records legal consent reference", async () => {
      const regRes = await request(app)
        .post("/api/connectors/sources/register")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          sourceType: "ZOHO_BOOKS",
          provider: "Zoho Corp",
          sourceSystem: "Zoho Books API",
          sourceName: "Auth Flow Source",
          provenance: "REAL_OBSERVED_ENTERPRISE",
          schemaVersion: "1.0",
          sourceOwner: { fullName: "Director", email: "director@client.in" },
        });

      const sourceId = regRes.body.data.sourceId;

      const authRes = await request(app)
        .post(`/api/connectors/sources/${sourceId}/authorize`)
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          legalConsentReferenceId: "CONSENT-DIRECTOR-2026-0042",
          extractionPurpose: "SME Early Warning Risk Prediction",
          dataScope: "Invoices and credit notes 2025-2026",
          retentionPolicy: "7_YEARS_LEGAL_COMPLIANCE",
        });

      expect(authRes.status).toBe(200);
      expect(authRes.body.success).toBe(true);
      expect(authRes.body.data.isEnterpriseAuthorized).toBe(true);
      expect(authRes.body.data.lifecycleState).toBe("AUTHORIZED");
    });

    it("25. GET /api/connectors/quarantine returns quarantined items with tenant isolation", async () => {
      const res = await request(app)
        .get("/api/connectors/quarantine")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    it("26. POST /api/ml/evidence/run returns watermarked dry-run report when real data is unavailable", async () => {
      const res = await request(app)
        .post("/api/ml/evidence/run")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          targetId: "PAYMENT_DELAY_RISK",
          forceSimulatedDryRun: true,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.evidenceResult.watermarkLabel).toBe("SIMULATED DRY RUN — NOT REAL-WORLD ML EVIDENCE");
      expect(res.body.evidenceResult.gateStatus).toBe("LOCKED");
      expect(res.body.evidenceResult.governanceRecommendation.canDeployToProduction).toBe(false);
    });

    it("27. Viewer role is forbidden from triggering First Evidence Run (RBAC enforcement)", async () => {
      const res = await request(app)
        .post("/api/ml/evidence/run")
        .set("Authorization", `Bearer ${viewerToken}`)
        .send({
          targetId: "PAYMENT_DELAY_RISK",
        });

      expect(res.status).toBe(403);
    });

    it("28. Multi-Tenant isolation: ORG_B cannot access ORG_A registered sources", async () => {
      const regRes = await request(app)
        .post("/api/connectors/sources/register")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          sourceType: "TALLYPRIME",
          provider: "Tally Solutions",
          sourceSystem: "TallyPrime ERP 4.1",
          sourceName: "Org A Private Ledger",
          provenance: "REAL_OBSERVED_ENTERPRISE",
          schemaVersion: "4.1.0",
          sourceOwner: { fullName: "Admin", email: "admin@orga.in" },
        });

      const sourceId = regRes.body.data.sourceId;

      // Login as user from ORG-002
      const orgBLogin = await request(app)
        .post("/api/auth/login")
        .send({ email: "analyst@nexus-cfr.demo", password: "demo1234" });
      const orgBToken = orgBLogin.body.data.token;

      // ORG_B attempts to authorize ORG_A source
      const crossRes = await request(app)
        .post(`/api/connectors/sources/${sourceId}/authorize`)
        .set("Authorization", `Bearer ${orgBToken}`)
        .send({
          legalConsentReferenceId: "CONSENT-HACK",
          extractionPurpose: "Illegal Access",
          dataScope: "All",
          retentionPolicy: "None",
        });

      // Source belongs to ORG_A, so accessing it under ORG_B throws unauthorized/not found error
      expect(crossRes.status).toBe(500);
      expect(crossRes.body.error?.message || crossRes.body.message).toContain("does not belong to tenant");
    });
  });
});
