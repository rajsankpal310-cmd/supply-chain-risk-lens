import request from "supertest";
import { describe, expect, it, beforeAll, beforeEach } from "vitest";
import app from "../src/app";
import { TemporalLeakageGuard, TemporalLeakageError } from "../src/ml/validation/temporalLeakageGuard";
import { TargetFeatureConflictChecker } from "../src/ml/features/targetFeatureConflict";
import { EntityLeakageGuard } from "../src/ml/validation/entityLeakageGuard";
import { DuplicateLeakageGuard } from "../src/ml/datasets/duplicateLeakageGuard";
import { LineageTracker } from "../src/ml/lineage/lineageTracker";
import { FeatureStabilityEvaluator } from "../src/ml/features/featureStability";
import { FinancialOutlierPolicy } from "../src/ml/quality/outlierPolicy";
import { MultiTenantModelRegistry } from "../src/ml/registry/modelRegistry";
import { PredictionService } from "../src/ml/prediction/predictionService";
import { DataArrivalContractEvaluator } from "../src/ml/contracts/dataArrivalContract";
import { TemporalSplitter } from "../src/ml/validation/temporalSplitter";
import { DriftMonitor } from "../src/ml/monitoring/driftMonitor";

describe("NEXUS-CFR Phase 4.5 — ML Production Hardening & Leakage Prevention Suite", () => {
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
    MultiTenantModelRegistry.clearTenant("ORG-TEST-HARDEN");
    MultiTenantModelRegistry.clearTenant("ORG-TEST-OTHER");
  });

  // 1. Temporal Leakage Hardening
  describe("1. Temporal Leakage & Look-Ahead Hardening", () => {
    it("HARD FAILS if any feature information timestamp is on or after prediction anchor t0", () => {
      const t0 = "2026-03-01T00:00:00.000Z";
      const validEventTime = "2026-02-15T00:00:00.000Z";
      const futureEventTime = "2026-03-05T00:00:00.000Z";

      // Valid pre-t0 feature assertion passes
      expect(() => {
        TemporalLeakageGuard.assertPrecedesT0(validEventTime, t0, "buyerHistoricalDelay30d", "INV-001");
      }).not.toThrow();

      // Look-ahead future event strictly throws TemporalLeakageError
      expect(() => {
        TemporalLeakageGuard.assertPrecedesT0(futureEventTime, t0, "buyerHistoricalDelay30d", "INV-001");
      }).toThrowError(TemporalLeakageError);

      expect(() => {
        TemporalLeakageGuard.assertPrecedesT0(t0, t0, "exactT0Collision", "INV-001");
      }).toThrowError(/does not strictly precede prediction anchor/);
    });

    it("HARD FAILS if historical feature aggregation includes future settlement payments", () => {
      const t0 = "2026-04-01T00:00:00.000Z";
      const contaminatedCorpus = [
        { id: "tx-1", paymentDate: "2026-03-15T00:00:00.000Z" },
        { id: "tx-2", paymentDate: "2026-04-10T00:00:00.000Z" }, // Contamination: cleared after t0
      ];

      expect(() => {
        TemporalLeakageGuard.validateHistoricalFeatureCutoff(contaminatedCorpus, t0, "buyerHistoricalDelayMean30d");
      }).toThrowError(TemporalLeakageError);
    });

    it("enforces optional temporal embargo gap between training and validation cohorts", () => {
      const records = [
        { id: "1", invoiceDate: new Date("2026-01-01") },
        { id: "2", invoiceDate: new Date("2026-01-10") },
        { id: "3", invoiceDate: new Date("2026-01-20") },
        { id: "4", invoiceDate: new Date("2026-01-25") }, // Inside 14d embargo of trainMax
        { id: "5", invoiceDate: new Date("2026-02-15") }, // Beyond 14-day embargo (in validation)
        { id: "6", invoiceDate: new Date("2026-02-20") }, // Retained in validation
        { id: "7", invoiceDate: new Date("2026-03-01") }, // Inside 14d embargo of valMax
        { id: "8", invoiceDate: new Date("2026-03-25") }, // Beyond 14d embargo (in test)
      ];

      const splitWithEmbargo = TemporalSplitter.splitChronological(records, 0.38, 0.38, 14);
      expect(splitWithEmbargo.temporalIntegrityVerified).toBe(true);
      expect(splitWithEmbargo.trainSet.length).toBe(3);
      expect(splitWithEmbargo.validationSet.length).toBe(2);
      expect(splitWithEmbargo.testSet.length).toBe(1);
    });
  });

  // 2. Target <-> Feature Conflict Checker
  describe("2. Target <-> Feature Conflict Hardening", () => {
    it("HARD BLOCKS any feature containing target generation components", () => {
      const candidateFeaturesWithTargetLeakage = [
        "invoiceAmount",
        "creditPeriodDays",
        "paymentDelayDays", // Constitutive label component!
        "actualPaymentStatus",
      ];

      const audit = TargetFeatureConflictChecker.auditTargetFeatureConflict(
        "PAYMENT_DELAY_RISK",
        candidateFeaturesWithTargetLeakage
      );

      expect(audit.hasTargetFeatureConflict).toBe(true);
      expect(audit.auditPassed).toBe(false);
      expect(audit.conflictingFeatures.length).toBe(2);
      expect(audit.conflictingFeatures[0].featureName).toBe("paymentDelayDays");
      expect(audit.auditSummary).toContain("FATAL TARGET LEAKAGE");
    });

    it("passes clean pre-prediction feature lists", () => {
      const cleanFeatures = ["invoiceAmount", "creditPeriodDays", "invoiceDayOfWeek", "buyerHistoricalDelayMean30d"];
      const audit = TargetFeatureConflictChecker.auditTargetFeatureConflict("PAYMENT_DELAY_RISK", cleanFeatures);
      expect(audit.hasTargetFeatureConflict).toBe(false);
      expect(audit.auditPassed).toBe(true);
    });
  });

  // 3. Entity Leakage & Contamination Guard
  describe("3. Entity Leakage: Distinguishing Normal Temporal Reuse vs Future Contamination", () => {
    it("approves normal temporal entity reuse when features use strictly pre-t0 history", () => {
      const trainRecords = [
        { id: "inv-1", invoiceNumber: "INV-01", buyerId: "BUYER-ALPHA", supplierId: "SUPP-01", invoiceDate: "2026-01-01" },
        { id: "inv-2", invoiceNumber: "INV-02", buyerId: "BUYER-ALPHA", supplierId: "SUPP-01", invoiceDate: "2026-02-01" },
      ];
      const testRecords = [
        { id: "inv-3", invoiceNumber: "INV-03", buyerId: "BUYER-ALPHA", supplierId: "SUPP-01", invoiceDate: "2026-05-01" },
      ];

      const audit = EntityLeakageGuard.auditEntitySplits({
        trainRecords,
        testRecords,
        trainCutoffTimestamp: "2026-03-01T00:00:00.000Z",
      });

      expect(audit.entityLeakageStatus).toBe("PASS_VALID_TEMPORAL_REUSE");
      expect(audit.buyerOverlapCount).toBe(1); // Normal temporal reuse
      expect(audit.violations.length).toBe(0);
    });

    it("HARD BLOCKS if exact same transaction ID appears in both train and test", () => {
      const trainRecords = [
        { id: "inv-DUP", invoiceNumber: "INV-100", buyerId: "BUYER-B", supplierId: "SUPP-01", invoiceDate: "2026-01-01" },
      ];
      const testRecords = [
        { id: "inv-DUP", invoiceNumber: "INV-100", buyerId: "BUYER-B", supplierId: "SUPP-01", invoiceDate: "2026-05-01" },
      ];

      const audit = EntityLeakageGuard.auditEntitySplits({
        trainRecords,
        testRecords,
        trainCutoffTimestamp: "2026-03-01T00:00:00.000Z",
      });

      expect(audit.entityLeakageStatus).toBe("CONTAMINATED_IDENTICAL_RECORD");
      expect(audit.violations.some((v) => v.type === "IDENTICAL_TRANSACTION_SPLIT_LEAKAGE")).toBe(true);
    });

    it("HARD BLOCKS if training record has invoiceDate after trainCutoff timestamp", () => {
      const trainRecords = [
        { id: "inv-1", invoiceNumber: "INV-01", buyerId: "BUYER-C", supplierId: "SUPP-01", invoiceDate: "2026-04-01" }, // Future event in train!
      ];
      const testRecords = [
        { id: "inv-2", invoiceNumber: "INV-02", buyerId: "BUYER-C", supplierId: "SUPP-01", invoiceDate: "2026-05-01" },
      ];

      const audit = EntityLeakageGuard.auditEntitySplits({
        trainRecords,
        testRecords,
        trainCutoffTimestamp: "2026-03-01T00:00:00.000Z",
      });

      expect(audit.entityLeakageStatus).toBe("CONTAMINATED_FUTURE_LEAKAGE");
    });
  });

  // 4. Duplicate & Near-Duplicate Leakage Guard
  describe("4. Duplicate Voucher & Split Contamination Guard", () => {
    it("detects exact and semantic tuple duplicates in dataset corpus", () => {
      const corpus = [
        { id: "1", invoiceNumber: "INV-A", supplierId: "S1", buyerId: "B1", invoiceAmount: 100000, invoiceDate: "2026-01-01" },
        { id: "2", invoiceNumber: "INV-A", supplierId: "S1", buyerId: "B1", invoiceAmount: 100000, invoiceDate: "2026-01-01" }, // Exact semantic duplicate
      ];

      const audit = DuplicateLeakageGuard.auditDuplicates(corpus);
      expect(audit.hasDuplicates).toBe(true);
      expect(audit.duplicateVouchersCount).toBe(1);
    });

    it("HARD FAILS when semantic duplicate tuple spans training and test cohorts", () => {
      const trainInvs = [
        { id: "1", invoiceNumber: "INV-A", supplierId: "S1", buyerId: "B1", invoiceAmount: 100000, invoiceDate: "2026-01-01" },
      ];
      const testInvs = [
        { id: "2", invoiceNumber: "INV-A", supplierId: "S1", buyerId: "B1", invoiceAmount: 100000, invoiceDate: "2026-01-01" }, // Duplicate leaked into test
      ];

      const splitAudit = DuplicateLeakageGuard.auditSplitContamination(trainInvs, testInvs);
      expect(splitAudit.isContaminationFree).toBe(false);
      expect(splitAudit.violations.some((v) => v.includes("Semantic tuple"))).toBe(true);
    });
  });

  // 5. Lineage Tracking
  describe("5. Raw -> Canonical -> Feature -> Prediction Lineage", () => {
    it("generates cryptographic feature and prediction lineage signatures", () => {
      const featLineage = LineageTracker.createFeatureLineage({
        featureName: "buyerHistoricalDelayMean30d",
        featureValue: 8.5,
        featureVersion: "2.0-LEAKAGE_SAFE",
        predictionTimestamp: "2026-03-01T00:00:00.000Z",
        sourceTransactionIds: ["tx-101", "tx-102"],
        sourceBatchIds: ["batch-01"],
        sourceSystem: "TALLY_PRIME",
      });

      expect(featLineage.lineageHash).toHaveLength(64);

      const predLineage = LineageTracker.createPredictionLineage({
        organizationId: "ORG-TEST-HARDEN",
        invoiceId: "inv-target",
        buyerId: "BUYER-01",
        supplierId: "SUPP-01",
        modelId: "MDL-01",
        modelVersion: "1.0",
        modelChecksum: "abc1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcd",
        datasetId: "DS-01",
        datasetVersion: "1.0",
        featureVersion: "2.0-LEAKAGE_SAFE",
        featureSnapshotHash: "feedfeedfeedfeedfeedfeedfeedfeedfeedfeedfeedfeedfeedfeedfeedfeed",
        predictedProbability: 0.65,
        riskBand: "HIGH",
        featuresUsed: { invoiceAmount: 500000 },
        featureLineages: [featLineage],
      });

      expect(predLineage.lineageSignature).toHaveLength(64);
      expect(predLineage.counterpartyBuyerId).toBe("BUYER-01");
    });
  });

  // 6. Feature Stability & Class Imbalance
  describe("6. Feature Stability & Class Imbalance Evaluator", () => {
    it("flags constant/degenerate features with zero variance", () => {
      const featureNames = ["constantFeat", "normalFeat"];
      const matrix = [
        [5, 10],
        [5, 20],
        [5, 30],
        [5, 40],
      ];

      const report = FeatureStabilityEvaluator.evaluateFeatureStability(featureNames, matrix);
      expect(report[0].stabilityFlag).toBe("DEGENERATE_CONSTANT");
      expect(report[0].isConstant).toBe(true);
      expect(report[1].stabilityFlag).toBe("STABLE");
    });

    it("evaluates class imbalance without synthetic hallucination", () => {
      const severeImbalancedLabels = [0, 0, 0, 0, 0, 0, 0, 0, 0, 1]; // 10% positive
      const report = FeatureStabilityEvaluator.evaluateClassImbalance(severeImbalancedLabels);
      expect(report.imbalanceSeverity).toBe("MODERATE_IMBALANCE");
      expect(report.recommendedEvaluationMetric).toBe("PR_AUC");
    });
  });

  // 7. Financial Outlier Policy
  describe("7. Audited Financial Outlier Policy", () => {
    it("retains legitimate large commercial tickets as VALID_EXTREME while hard-dropping impossible values", () => {
      const validLargeInvoice = {
        id: "inv-large",
        invoiceAmount: 75_000_000, // ₹7.5 Cr
        invoiceDate: "2026-01-01",
        dueDate: "2026-02-15",
      };
      const invalidNegativeInvoice = {
        id: "inv-neg",
        invoiceAmount: -500_000, // Negative amount
        invoiceDate: "2026-01-01",
        dueDate: "2026-02-15",
      };
      const nonPositiveDurationInvoice = {
        id: "inv-bad-date",
        invoiceAmount: 100_000,
        invoiceDate: "2026-02-15",
        dueDate: "2026-01-01", // Due date before invoice date!
      };

      const evalLarge = FinancialOutlierPolicy.evaluateInvoice(validLargeInvoice);
      expect(evalLarge[0].classification).toBe("VALID_EXTREME");
      expect(evalLarge[0].treatment).toBe("RETAIN_IN_TRAINING");

      const evalNeg = FinancialOutlierPolicy.evaluateInvoice(invalidNegativeInvoice);
      expect(evalNeg[0].classification).toBe("IMPOSSIBLE_VALUE");
      expect(evalNeg[0].treatment).toBe("HARD_DROP_INVALID");

      const evalBadDate = FinancialOutlierPolicy.evaluateInvoice(nonPositiveDurationInvoice);
      expect(evalBadDate[0].classification).toBe("IMPOSSIBLE_VALUE");
      expect(evalBadDate[0].treatment).toBe("HARD_DROP_INVALID");
    });
  });

  // 8. Simulated Data Firewall & Model Integrity
  describe("8. Simulated Data Firewall & Model Checksum Integrity", () => {
    it("SIMULATED DATA FIREWALL: Rejects deploying model trained on SIMULATED_BENCHMARK to production", () => {
      const model = MultiTenantModelRegistry.registerModel("ORG-TEST-HARDEN", {
        version: "1.0-SIMULATED",
        modelType: "LOGISTIC_REGRESSION",
        targetId: "PAYMENT_DELAY_RISK",
        targetVersion: "1.0",
        datasetId: "DS-SIM-01",
        datasetVersion: "1.0",
        featureVersion: "2.0-LEAKAGE_SAFE",
        dataProvenanceClassification: "SIMULATED_BENCHMARK",
        trainingMetadata: {} as any,
        evaluationMetrics: {} as any,
        calibration: {} as any,
        globalImportance: [],
      });

      // Approve model as Admin
      MultiTenantModelRegistry.transitionLifecycle("ORG-TEST-HARDEN", model.modelId, "APPROVED", "ADMIN");

      // Attempting to deploy to production without allowSimulatedDemo flag MUST FAIL
      expect(() => {
        MultiTenantModelRegistry.transitionLifecycle(
          "ORG-TEST-HARDEN",
          model.modelId,
          "DEPLOYED",
          "ADMIN",
          "Deploying",
          false // allowSimulatedDemo = false
        );
      }).toThrowError(/Simulated Data Firewall/);
    });

    it("verifies model cryptographic checksum integrity", () => {
      const model = MultiTenantModelRegistry.registerModel("ORG-TEST-HARDEN", {
        version: "1.0",
        modelType: "LOGISTIC_REGRESSION",
        targetId: "PAYMENT_DELAY_RISK",
        targetVersion: "1.0",
        datasetId: "DS-01",
        datasetVersion: "1.0",
        featureVersion: "2.0-LEAKAGE_SAFE",
        dataProvenanceClassification: "REAL_OBSERVED_ENTERPRISE",
        trainingMetadata: {} as any,
        evaluationMetrics: {} as any,
        calibration: {} as any,
        globalImportance: [],
      });

      const isIntact = MultiTenantModelRegistry.verifyModelIntegrity("ORG-TEST-HARDEN", model.modelId);
      expect(isIntact).toBe(true);

      // Tampering with checksum causes verification failure
      model.checksum = "tampered_fake_checksum_1234567890abcdef1234567890abcdef1234567890abcd";
      const isTamperedIntact = MultiTenantModelRegistry.verifyModelIntegrity("ORG-TEST-HARDEN", model.modelId);
      expect(isTamperedIntact).toBe(false);
    });

    it("governed rollback: allows rollback only to previously approved models, rejecting unapproved fallbacks", () => {
      const approvedModelV1 = MultiTenantModelRegistry.registerModel("ORG-TEST-HARDEN", {
        version: "1.0-V1",
        modelType: "LOGISTIC_REGRESSION",
        targetId: "PAYMENT_DELAY_RISK",
        targetVersion: "1.0",
        datasetId: "DS-01",
        datasetVersion: "1.0",
        featureVersion: "2.0-LEAKAGE_SAFE",
        dataProvenanceClassification: "REAL_OBSERVED_ENTERPRISE",
        trainingMetadata: {} as any,
        evaluationMetrics: {} as any,
        calibration: {} as any,
        globalImportance: [],
      });
      MultiTenantModelRegistry.transitionLifecycle("ORG-TEST-HARDEN", approvedModelV1.modelId, "APPROVED", "ADMIN");

      const experimentalModelV2 = MultiTenantModelRegistry.registerModel("ORG-TEST-HARDEN", {
        version: "2.0-EXPERIMENTAL",
        modelType: "LOGISTIC_REGRESSION",
        targetId: "PAYMENT_DELAY_RISK",
        targetVersion: "1.0",
        datasetId: "DS-02",
        datasetVersion: "2.0",
        featureVersion: "2.0-LEAKAGE_SAFE",
        dataProvenanceClassification: "REAL_OBSERVED_ENTERPRISE",
        trainingMetadata: {} as any,
        evaluationMetrics: {} as any,
        calibration: {} as any,
        globalImportance: [],
      });

      // Rolling back to experimental unapproved model MUST FAIL
      expect(() => {
        MultiTenantModelRegistry.rollbackProductionModel(
          "ORG-TEST-HARDEN",
          "PAYMENT_DELAY_RISK",
          experimentalModelV2.modelId,
          "ADMIN",
          "Emergency rollback"
        );
      }).toThrowError(/Rollback violation: Cannot rollback to unapproved model/);

      // Rolling back to approved model V1 succeeds
      const rollbackResult = MultiTenantModelRegistry.rollbackProductionModel(
        "ORG-TEST-HARDEN",
        "PAYMENT_DELAY_RISK",
        approvedModelV1.modelId,
        "ADMIN",
        "Rollback to stable approved V1"
      );

      expect(rollbackResult.activeModel.modelId).toBe(approvedModelV1.modelId);
      expect(rollbackResult.activeModel.lifecycleState).toBe("DEPLOYED");
      expect(rollbackResult.activeModel.governance.rollbackAudit?.length).toBe(1);
    });
  });

  // 9. Fail-Safe Prediction Behavior
  describe("9. Fail-Safe Prediction Behavior & Data Quality Block", () => {
    it("DATA QUALITY BLOCK: rejects prediction on invoice with non-positive amount or invalid dates", () => {
      const invalidInvoice = {
        id: "inv-bad",
        invoiceNumber: "INV-BAD",
        organizationId: "ORG-003",
        supplierId: "S1",
        buyerId: "B1",
        invoiceDate: new Date("2026-01-01"),
        dueDate: new Date("2026-02-01"),
        invoiceAmount: -100, // Invalid amount
        status: "PENDING",
      };

      expect(() => {
        PredictionService.predictInvoice({
          organizationId: "ORG-003",
          invoice: invalidInvoice,
          historicalTransactions: [],
        });
      }).toThrowError(/DATA QUALITY BLOCK/);
    });

    it("VERSION MISMATCH: fails safely if deployed model expects feature version different from extractor", () => {
      // Register model with featureVersion 1.0 while extractor runs 2.0-LEAKAGE_SAFE
      const oldModel = MultiTenantModelRegistry.registerModel("ORG-TEST-HARDEN", {
        version: "1.0",
        modelType: "LOGISTIC_REGRESSION",
        targetId: "PAYMENT_DELAY_RISK",
        targetVersion: "1.0",
        datasetId: "DS-01",
        datasetVersion: "1.0",
        featureVersion: "1.0-DEPRECATED",
        dataProvenanceClassification: "REAL_OBSERVED_ENTERPRISE",
        trainingMetadata: {} as any,
        evaluationMetrics: {} as any,
        calibration: {} as any,
        globalImportance: [],
      });
      MultiTenantModelRegistry.transitionLifecycle("ORG-TEST-HARDEN", oldModel.modelId, "APPROVED", "ADMIN");
      MultiTenantModelRegistry.transitionLifecycle("ORG-TEST-HARDEN", oldModel.modelId, "DEPLOYED", "ADMIN");

      const invoice = {
        id: "inv-valid",
        invoiceNumber: "INV-VALID",
        organizationId: "ORG-TEST-HARDEN",
        supplierId: "S1",
        buyerId: "B1",
        invoiceDate: new Date("2026-01-01"),
        dueDate: new Date("2026-02-01"),
        invoiceAmount: 100000,
        status: "PENDING",
      };

      expect(() => {
        PredictionService.predictInvoice({
          organizationId: "ORG-TEST-HARDEN",
          invoice,
          historicalTransactions: [],
        });
      }).toThrowError(/VERSION MISMATCH ERROR/);
    });
  });

  // 10. Drift Monitoring Hardening
  describe("10. Drift Monitoring: Available vs Statistically Active", () => {
    it("reports PENDING_OUTCOMES and MONITORING_AVAILABLE when delayed actuals < 50", () => {
      const report = DriftMonitor.generateMonitoringReport(
        "ORG-003",
        "MDL-01",
        { invoiceAmount: [100, 200, 300] },
        { invoiceAmount: [105, 205, 305] },
        [0.2, 0.4, 0.6],
        10 // Only 10 settled actuals matured
      );

      expect(report.delayedPerformanceStatus).toBe("PENDING_OUTCOMES");
      expect(report.monitoringStatus).toBe("MONITORING_AVAILABLE");
      expect(report.featureDriftSummary.governedPolicy.policyId).toBe("POL-DRIFT-PSI-1.0");
    });
  });

  // 11. REST API Endpoints for Data Arrival & Rollback
  describe("11. Phase 4.5 REST API Endpoints", () => {
    it("GET /api/ml/data-arrival/assessment returns structured machine-readable contract", async () => {
      const res = await request(app)
        .get("/api/ml/data-arrival/assessment")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const assessment = res.body.assessment;

      expect(assessment.assessmentId).toBeDefined();
      expect(assessment.provenanceClassification).toBe("SIMULATED_BENCHMARK");
      expect(assessment.finalStatus).toBe("BLOCKED");
      expect(assessment.exactBlockers.length).toBeGreaterThan(0);
      expect(assessment.checksum).toHaveLength(64);
    });

    it("POST /api/ml/data-arrival/dry-run labels output SIMULATED DRY RUN — NOT ML EVIDENCE", async () => {
      const res = await request(app)
        .post("/api/ml/data-arrival/dry-run")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.dryRunMode).toBe("SIMULATED DRY RUN — NOT ML EVIDENCE");
      expect(res.body.disclaimer).toContain("TECHNICAL VERIFICATION ONLY");
      expect(res.body.result.status).toBe("COMPLETED_EXPERIMENTAL");
    });

    it("POST /api/ml/data-arrival/dry-run rejects VIEWER role with 403", async () => {
      const res = await request(app)
        .post("/api/ml/data-arrival/dry-run")
        .set("Authorization", `Bearer ${viewerToken}`);

      expect(res.status).toBe(403);
    });
  });
});
