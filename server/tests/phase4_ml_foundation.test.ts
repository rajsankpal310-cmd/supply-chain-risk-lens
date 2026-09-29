import { describe, expect, it, beforeEach } from "vitest";
import { TARGET_REGISTRY } from "../src/ml/targets/targetRegistry";
import { AntiLeakageAuditor, FEATURE_SPECIFICATIONS } from "../src/ml/features/featureEligibility";
import { FeatureEngine, RawInvoiceRecord } from "../src/ml/features/featureEngine";
import { TemporalSplitter } from "../src/ml/validation/temporalSplitter";
import { MLDatasetBuilder } from "../src/ml/datasets/datasetBuilder";
import { LogisticRegressionClassifier, RidgeRegressor, DecisionForestClassifier } from "../src/ml/models/baselineModels";
import { MLMetrics } from "../src/ml/models/metrics";
import { ProbabilityCalibrator } from "../src/ml/models/calibration";
import { ModelExplainer } from "../src/ml/explainability/explainer";
import { MultiTenantModelRegistry } from "../src/ml/registry/modelRegistry";
import { MLReadinessGate } from "../src/ml/governance/readinessGate";
import { RiskBandManager, DEFAULT_THRESHOLD_POLICIES } from "../src/ml/prediction/riskBands";
import { DriftMonitor } from "../src/ml/monitoring/driftMonitor";
import { NetworkMlBridge, TransactionMlRiskScore } from "../src/ml/network/networkMlBridge";

describe("NEXUS-CFR Phase 4 — Production ML Foundation Test Suite", () => {
  beforeEach(() => {
    MultiTenantModelRegistry.clearTenant("ORG-TEST-A");
    MultiTenantModelRegistry.clearTenant("ORG-TEST-B");
  });

  // 1. Target Registry
  describe("1. Target Registry & Business Problem Definitions", () => {
    it("registers all candidate prediction targets with formal definitions and formulas", () => {
      const targets = Object.keys(TARGET_REGISTRY);
      expect(targets).toContain("PAYMENT_DELAY_RISK");
      expect(targets).toContain("PAYMENT_DELAY_SEVERITY");
      expect(targets).toContain("SEVERE_DELINQUENCY_RISK");
      expect(targets).toContain("SME_FINANCIAL_STRESS");

      const delayDef = TARGET_REGISTRY.PAYMENT_DELAY_RISK;
      expect(delayDef.problemType).toBe("BINARY_CLASSIFICATION");
      expect(delayDef.formula).toBe("y = I(paymentDate > dueDate)");
      expect(delayDef.censoringTreatment.handlesRightCensoring).toBe(true);
      expect(delayDef.censoringTreatment.naiveImputationRule).toContain("FATAL: Never impute payment_delay = 0");
    });
  });

  // 2. Anti-Leakage & Feature Eligibility
  describe("2. Anti-Leakage Auditor & Feature Eligibility", () => {
    it("classifies pre-t0 features as SAFE and post-outcome fields as FORBIDDEN", () => {
      expect(FEATURE_SPECIFICATIONS.invoiceAmount.eligibility).toBe("SAFE_PRE_PREDICTION");
      expect(FEATURE_SPECIFICATIONS.creditPeriodDays.eligibility).toBe("SAFE_PRE_PREDICTION");
      expect(FEATURE_SPECIFICATIONS.paymentDate.eligibility).toBe("POST_OUTCOME_FORBIDDEN");
      expect(FEATURE_SPECIFICATIONS.paymentDelayDays.eligibility).toBe("POST_OUTCOME_FORBIDDEN");
      expect(FEATURE_SPECIFICATIONS.actualPaymentStatus.eligibility).toBe("POST_OUTCOME_FORBIDDEN");
    });

    it("automatically catches and blocks forbidden post-outcome features in candidate sets", () => {
      const candidateFeaturesWithLeakage = [
        "invoiceAmount",
        "creditPeriodDays",
        "paymentDate", // Fatal leakage
        "actualPaymentStatus", // Fatal leakage
        "clearing_bank_reference", // Matches regex blacklist
      ];

      const audit = AntiLeakageAuditor.auditFeatureCandidateList(candidateFeaturesWithLeakage);
      expect(audit.isLeakageFree).toBe(false);
      expect(audit.forbiddenFeaturesDetected).toContain("paymentDate");
      expect(audit.forbiddenFeaturesDetected).toContain("actualPaymentStatus");
      expect(audit.forbiddenFeaturesDetected).toContain("clearing_bank_reference");
      expect(audit.violations.length).toBe(3);
    });

    it("passes clean pre-t0 feature candidate sets", () => {
      const cleanFeatures = [
        "invoiceAmount",
        "creditPeriodDays",
        "invoiceDayOfWeek",
        "buyerHistoricalDelayMean30d",
        "networkBuyerInDegreePreT0",
      ];
      const audit = AntiLeakageAuditor.auditFeatureCandidateList(cleanFeatures);
      expect(audit.isLeakageFree).toBe(true);
      expect(audit.forbiddenFeaturesDetected.length).toBe(0);
    });
  });

  // 3. Feature Engineering Engine
  describe("3. Feature Engineering Engine & Temporal Correctness", () => {
    const historicalTxs: RawInvoiceRecord[] = [
      {
        id: "tx-1",
        invoiceNumber: "INV-001",
        organizationId: "ORG-TEST-A",
        supplierId: "SUPP-01",
        buyerId: "BUYER-01",
        invoiceDate: new Date("2026-01-01"),
        dueDate: new Date("2026-01-31"),
        invoiceAmount: 100000,
        paymentDate: new Date("2026-02-10"), // 10 days delayed
        paymentDelayDays: 10,
        status: "COMPLETED",
      },
      {
        id: "tx-2",
        invoiceNumber: "INV-002",
        organizationId: "ORG-TEST-A",
        supplierId: "SUPP-01",
        buyerId: "BUYER-01",
        invoiceDate: new Date("2026-01-15"),
        dueDate: new Date("2026-02-15"),
        invoiceAmount: 200000,
        paymentDate: new Date("2026-02-15"), // on time (0 days delay)
        paymentDelayDays: 0,
        status: "COMPLETED",
      },
      {
        id: "tx-future",
        invoiceNumber: "INV-003",
        organizationId: "ORG-TEST-A",
        supplierId: "SUPP-01",
        buyerId: "BUYER-01",
        invoiceDate: new Date("2026-03-01"),
        dueDate: new Date("2026-03-31"),
        invoiceAmount: 500000,
        paymentDate: new Date("2026-04-15"), // Future settlement (must NOT leak into pre-March 1 predictions)
        paymentDelayDays: 15,
        status: "COMPLETED",
      },
    ];

    it("computes pre-t0 features without looking ahead into future settlements", () => {
      // Predict for an invoice issued on 2026-02-20 (before tx-future was issued or settled)
      const targetInvoice: RawInvoiceRecord = {
        id: "tx-target",
        invoiceNumber: "INV-TARGET",
        organizationId: "ORG-TEST-A",
        supplierId: "SUPP-01",
        buyerId: "BUYER-01",
        invoiceDate: new Date("2026-02-20"),
        dueDate: new Date("2026-03-22"),
        invoiceAmount: 150000,
        status: "PENDING",
      };

      const snapshot = FeatureEngine.extractFeaturesForInvoice(targetInvoice, historicalTxs);
      expect(snapshot.features.invoiceAmount).toBe(150000);
      expect(snapshot.features.creditPeriodDays).toBe(30);
      expect(snapshot.features.buyerSettledCountPreT0).toBe(2); // Only tx-1 and tx-2 were settled pre-Feb 20
      // Buyer mean delay of tx-1 (10) and tx-2 (0) = 5.0 days
      expect(snapshot.features.buyerHistoricalDelayMean30d).toBe(5);
      // Ensure SHA-256 snapshot hash exists
      expect(snapshot.snapshotHash).toHaveLength(64);
    });
  });

  // 4. Temporal Splitter
  describe("4. Temporal Validation & Chronological Splitting", () => {
    it("partitions records strictly chronologically without temporal leakage", () => {
      const records = [
        { id: "1", invoiceDate: new Date("2026-01-01") },
        { id: "2", invoiceDate: new Date("2026-02-01") },
        { id: "3", invoiceDate: new Date("2026-03-01") },
        { id: "4", invoiceDate: new Date("2026-04-01") },
        { id: "5", invoiceDate: new Date("2026-05-01") },
        { id: "6", invoiceDate: new Date("2026-06-01") },
        { id: "7", invoiceDate: new Date("2026-07-01") },
        { id: "8", invoiceDate: new Date("2026-08-01") },
        { id: "9", invoiceDate: new Date("2026-09-01") },
        { id: "10", invoiceDate: new Date("2026-10-01") },
      ];

      const split = TemporalSplitter.splitChronological(records, 0.6, 0.2);
      expect(split.splitStrategy).toBe("OUT_OF_TIME_CHRONOLOGICAL");
      expect(split.trainSet.length).toBe(6);
      expect(split.validationSet.length).toBe(2);
      expect(split.testSet.length).toBe(2);
      expect(split.temporalIntegrityVerified).toBe(true);

      const trainMax = new Date(split.trainSet[split.trainSet.length - 1].invoiceDate).getTime();
      const valMin = new Date(split.validationSet[0].invoiceDate).getTime();
      const testMin = new Date(split.testSet[0].invoiceDate).getTime();

      expect(trainMax).toBeLessThanOrEqual(valMin);
      expect(valMin).toBeLessThanOrEqual(testMin);
    });
  });

  // 5. ML Dataset Builder
  describe("5. ML Dataset Builder & Censoring Exclusions", () => {
    it("excludes unexpired open invoices from training sets as right-censored observations", () => {
      const futureDueDate = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000); // 60 days in future
      const invoices: RawInvoiceRecord[] = [
        {
          id: "inv-1",
          invoiceNumber: "INV-01",
          organizationId: "ORG-TEST-A",
          supplierId: "S1",
          buyerId: "B1",
          invoiceDate: new Date("2026-01-01"),
          dueDate: new Date("2026-01-31"),
          invoiceAmount: 100000,
          paymentDate: new Date("2026-02-10"),
          status: "COMPLETED",
        },
        {
          id: "inv-2",
          invoiceNumber: "INV-02",
          organizationId: "ORG-TEST-A",
          supplierId: "S1",
          buyerId: "B1",
          invoiceDate: new Date("2026-01-05"),
          dueDate: new Date("2026-02-05"),
          invoiceAmount: 200000,
          paymentDate: new Date("2026-02-05"),
          status: "COMPLETED",
        },
        {
          id: "inv-3",
          invoiceNumber: "INV-03",
          organizationId: "ORG-TEST-A",
          supplierId: "S1",
          buyerId: "B1",
          invoiceDate: new Date("2026-01-10"),
          dueDate: new Date("2026-02-10"),
          invoiceAmount: 300000,
          paymentDate: new Date("2026-02-25"),
          status: "COMPLETED",
        },
        {
          id: "inv-4",
          invoiceNumber: "INV-04",
          organizationId: "ORG-TEST-A",
          supplierId: "S1",
          buyerId: "B1",
          invoiceDate: new Date("2026-01-15"),
          dueDate: new Date("2026-02-15"),
          invoiceAmount: 400000,
          paymentDate: new Date("2026-02-15"),
          status: "COMPLETED",
        },
        {
          id: "inv-5",
          invoiceNumber: "INV-05",
          organizationId: "ORG-TEST-A",
          supplierId: "S1",
          buyerId: "B1",
          invoiceDate: new Date("2026-01-20"),
          dueDate: new Date("2026-02-20"),
          invoiceAmount: 500000,
          paymentDate: new Date("2026-03-01"),
          status: "COMPLETED",
        },
        {
          id: "inv-censored",
          invoiceNumber: "INV-CENS",
          organizationId: "ORG-TEST-A",
          supplierId: "S1",
          buyerId: "B1",
          invoiceDate: new Date(),
          dueDate: futureDueDate,
          invoiceAmount: 250000,
          paymentDate: null, // Open, unexpired
          status: "PENDING",
        },
      ];

      const dataset = MLDatasetBuilder.buildDataset("ORG-TEST-A", invoices, "PAYMENT_DELAY_RISK");
      expect(dataset.recordCount.censoredExcludedCount).toBe(1);
      expect(dataset.exclusionLog.some((e) => e.invoiceId === "inv-censored")).toBe(true);
      expect(dataset.checksum).toHaveLength(64);
    });
  });

  // 6. Tiered Models & Numerical Metrics
  describe("6. Tiered Models & Numerical Evaluation", () => {
    it("trains Logistic Regression, evaluates ROC-AUC, and checks calibration", () => {
      // Generate synthetic linear separable dataset for smoke test
      const X: number[][] = [];
      const y: number[] = [];
      for (let i = 0; i < 60; i++) {
        const f1 = i < 30 ? i * 2 : i * 5;
        const f2 = i < 30 ? 10 : 50;
        X.push([f1, f2]);
        y.push(i < 30 ? 0 : 1);
      }

      const model = new LogisticRegressionClassifier(0.1, 0.001, 500, 1e-2);
      const res = model.fit(X, y, ["feature1", "feature2"]);
      expect(res.iterationsTrained).toBeGreaterThan(0);

      const probs = X.map((x) => model.predictProbability(x));
      const metrics = MLMetrics.evaluateClassification(y, probs);

      expect(metrics.rocAuc).toBeGreaterThanOrEqual(0.85);
      expect(metrics.brierScore).toBeLessThanOrEqual(0.20);
      expect(metrics.accuracy).toBeGreaterThanOrEqual(0.80);
    });

    it("trains Ridge Regressor and evaluates MAE, RMSE, and R2", () => {
      const X = [[1], [2], [3], [4], [5], [6], [7], [8]];
      const y = [5, 10, 15, 20, 25, 30, 35, 40]; // y = 5 * x

      const regressor = new RidgeRegressor(0.02, 0.05, 400);
      regressor.fit(X, y, ["ticketSize"]);

      const preds = X.map((x) => regressor.predict(x));
      const regMetrics = MLMetrics.evaluateRegression(y, preds);

      expect(regMetrics.mae).toBeLessThan(3.0);
      expect(regMetrics.rSquared).toBeGreaterThan(0.90);
    });

    it("withholds Platt calibration when validation sample size < 100", () => {
      const smallValActuals = [0, 1, 0, 1, 0];
      const smallValScores = [-1.2, 0.8, -0.5, 1.1, -0.2];

      const report = ProbabilityCalibrator.fitPlattScaling(smallValScores, smallValActuals);
      expect(report.status).toBe("INSUFFICIENT_EVIDENCE");
      expect(report.method).toBe("NONE");
      expect(report.diagnostics).toContain("threshold; probability calibration withheld");
    });
  });

  // 7. Explainability
  describe("7. Model Explainability & Factor Attributions", () => {
    it("computes normalized feature importance and explains predictions without fabrication", () => {
      const X = [[10, 1], [20, 2], [30, 3], [70, 7], [80, 8], [90, 9]];
      const y = [0, 0, 0, 1, 1, 1];
      const featureNames = ["buyerOverdueRatioPreT0", "creditPeriodDays"];

      const model = new LogisticRegressionClassifier(0.05, 0.01, 300);
      model.fit(X, y, featureNames);

      const importance = ModelExplainer.computeGlobalImportance(model);
      expect(importance.length).toBe(2);
      expect(importance[0].importanceWeight + importance[1].importanceWeight).toBeCloseTo(1.0, 2);

      const localExpl = ModelExplainer.explainInvoicePrediction(
        model,
        [0.85, 90],
        { buyerOverdueRatioPreT0: 0.85, creditPeriodDays: 90 },
        "HIGH"
      );

      expect(localExpl.riskBand).toBe("HIGH");
      expect(localExpl.topContributingFactors.length).toBeGreaterThanOrEqual(1);
      expect(
        localExpl.topContributingFactors.some((f) => f.explanationText.includes("Buyer historical overdue ratio"))
      ).toBe(true);
    });
  });

  // 8. Multi-Tenant Model Registry
  describe("8. Multi-Tenant Model Registry & Lifecycle Governance", () => {
    it("enforces tenant boundary isolation between ORG-TEST-A and ORG-TEST-B", () => {
      const modelA = MultiTenantModelRegistry.registerModel("ORG-TEST-A", {
        version: "1.0",
        modelType: "LOGISTIC_REGRESSION",
        targetId: "PAYMENT_DELAY_RISK",
        targetVersion: "1.0",
        datasetId: "DS-A-01",
        datasetVersion: "1.0",
        featureVersion: "2.0",
        trainingMetadata: {
          trainedAt: new Date().toISOString(),
          trainingRecordCount: 100,
          validationRecordCount: 20,
          testRecordCount: 20,
          trainWindow: { start: "2026-01-01", end: "2026-06-01" },
          validationStrategy: "OUT_OF_TIME_CHRONOLOGICAL",
          hyperparameters: {},
        },
        evaluationMetrics: {
          validation: {} as any,
          outOfTimeTest: {} as any,
        },
        calibration: {} as any,
        globalImportance: [],
      });

      const listA = MultiTenantModelRegistry.listModelsForTenant("ORG-TEST-A");
      const listB = MultiTenantModelRegistry.listModelsForTenant("ORG-TEST-B");

      expect(listA.length).toBe(1);
      expect(listB.length).toBe(0); // Tenant B cannot see Tenant A's models

      // Accessing A's model using B's tenant context throws an unauthorized exception
      expect(() => MultiTenantModelRegistry.getModel("ORG-TEST-B", modelA.modelId)).toThrow(
        /Unauthorized access/
      );
    });

    it("enforces governed lifecycle transitions (EXPERIMENTAL -> APPROVED -> DEPLOYED)", () => {
      const model = MultiTenantModelRegistry.registerModel("ORG-TEST-A", {
        version: "1.0",
        modelType: "LOGISTIC_REGRESSION",
        targetId: "PAYMENT_DELAY_RISK",
        targetVersion: "1.0",
        datasetId: "DS-A-01",
        datasetVersion: "1.0",
        featureVersion: "2.0",
        trainingMetadata: {} as any,
        evaluationMetrics: {} as any,
        calibration: {} as any,
        globalImportance: [],
      });

      expect(model.lifecycleState).toBe("EXPERIMENTAL");

      // Cannot deploy an EXPERIMENTAL (unapproved) model directly
      expect(() =>
        MultiTenantModelRegistry.transitionLifecycle("ORG-TEST-A", model.modelId, "DEPLOYED", "ADMIN")
      ).toThrow(/Cannot deploy an unapproved model/);

      // Non-admin cannot approve
      expect(() =>
        MultiTenantModelRegistry.transitionLifecycle("ORG-TEST-A", model.modelId, "APPROVED", "VIEWER")
      ).toThrow(/Governance policy violation/);

      // Admin approves
      MultiTenantModelRegistry.transitionLifecycle("ORG-TEST-A", model.modelId, "APPROVED", "ADMIN");
      expect(model.lifecycleState).toBe("APPROVED");
      expect(model.governance.complianceAttestation).toBe(true);

      // Admin deploys approved model
      MultiTenantModelRegistry.transitionLifecycle("ORG-TEST-A", model.modelId, "DEPLOYED", "ADMIN");
      expect(model.lifecycleState).toBe("DEPLOYED");
      expect(model.isProductionDeployed).toBe(true);

      const deployed = MultiTenantModelRegistry.getDeployedModel("ORG-TEST-A", "PAYMENT_DELAY_RISK");
      expect(deployed?.modelId).toBe(model.modelId);
    });
  });

  // 9. 20-Point ML Readiness Gate
  describe("9. 20-Point ML Readiness Gate & Objective Lock Status", () => {
    it("locks ML when dataset is SIMULATED or underpowered, providing explicit blockers", () => {
      const report = MLReadinessGate.evaluateDataset({
        organizationId: "ORG-003",
        sourceClassification: "SIMULATED_BENCHMARK",
        isEnterpriseAuthorized: false,
        hasActiveLegalConsent: false,
        totalTransactions: 50,
        completedTransactions: 37,
        openTransactions: 13,
        uniqueBuyers: 4,
        uniqueSuppliers: 12,
        earliestDate: new Date("2026-01-01"),
        latestDate: new Date("2026-05-01"),
        missingDueDatesCount: 0,
        missingAmountsCount: 0,
        duplicateTransactionsCount: 0,
        observedDelayedCount: 8,
        detectedLeakageFields: [],
        governanceApproved: false,
      });

      expect(report.overallStatus).toBe("LOCKED");
      expect(report.blockerCount).toBeGreaterThanOrEqual(4);
      expect(report.exactBlockers.some((b) => b.includes("Simulated/synthetic data cannot be promoted"))).toBe(true);
      expect(report.exactBlockers.some((b) => b.includes("Minimum requirement is 1000"))).toBe(true);
      expect(report.exactBlockers.some((b) => b.includes("unique buyers. Requires >= 50"))).toBe(true);
    });

    it("blocks dataset when target leakage is detected", () => {
      const report = MLReadinessGate.evaluateDataset({
        organizationId: "ORG-REAL",
        sourceClassification: "REAL_OBSERVED_ENTERPRISE",
        isEnterpriseAuthorized: true,
        hasActiveLegalConsent: true,
        totalTransactions: 2000,
        completedTransactions: 1800,
        openTransactions: 200,
        uniqueBuyers: 80,
        uniqueSuppliers: 30,
        earliestDate: new Date("2024-01-01"),
        latestDate: new Date("2026-01-01"),
        missingDueDatesCount: 0,
        missingAmountsCount: 0,
        duplicateTransactionsCount: 0,
        observedDelayedCount: 300,
        detectedLeakageFields: ["paymentDate", "clearing_reference"],
        governanceApproved: true,
      });

      expect(report.overallStatus).toBe("LOCKED");
      const leakageCheck = report.checks.find((c) => c.checkId === "CHECK_15_LEAKAGE_SCAN");
      expect(leakageCheck?.status).toBe("BLOCKED");
      expect(leakageCheck?.details).toContain("Fatal target leakage");
    });
  });

  // 10. Network + ML Integration Bridge
  describe("10. Network + ML Integration Bridge", () => {
    it("bridges ML transaction probabilities to node-level risk and cascade scenarios without conflating them", () => {
      const invoices: TransactionMlRiskScore[] = [
        {
          invoiceId: "inv-1",
          supplierId: "FIRM-SME-01",
          buyerId: "CORP-BUYER-01",
          invoiceAmount: 1000000,
          dueDate: "2026-04-01",
          calibratedDelayProbability: 0.82,
          riskBand: "CRITICAL",
          isMlDerived: true,
        },
        {
          invoiceId: "inv-2",
          supplierId: "FIRM-SME-01",
          buyerId: "CORP-BUYER-02",
          invoiceAmount: 500000,
          dueDate: "2026-04-15",
          calibratedDelayProbability: 0.20,
          riskBand: "LOW",
          isMlDerived: true,
        },
      ];

      const firmRisks = NetworkMlBridge.aggregateTransactionRisksToFirms(invoices);
      const smeNode = firmRisks.get("FIRM-SME-01");

      expect(smeNode).toBeDefined();
      expect(smeNode?.totalReceivableExposure).toBe(1500000);
      // Weighted probability: (1M * 0.82 + 0.5M * 0.20) / 1.5M = (820000 + 100000) / 1.5M = 0.6133
      expect(smeNode?.weightedDelayProbability).toBeCloseTo(0.6133, 2);
      expect(smeNode?.firmStressBand).toBe("STRESSED");

      const cascadeInput = NetworkMlBridge.constructCascadeInputFromMl(
        "FIRM-SME-01",
        smeNode!,
        { edges: [{ source: "SUB-SUPPLIER-01", target: "FIRM-SME-01", weight: 300000 }] }
      );

      expect(cascadeInput.originatingFirmId).toBe("FIRM-SME-01");
      expect(cascadeInput.initialMlFailureProbability).toBe(smeNode?.weightedDelayProbability);
      expect(cascadeInput.impactedNodeIds).toContain("SUB-SUPPLIER-01");
      expect(cascadeInput.assumptions.mlSource).toContain("CALIBRATED");
    });
  });

  // 11. Drift Monitoring (PSI)
  describe("11. Production Drift Monitoring (PSI)", () => {
    it("detects no drift on identical distributions and significant drift on shifted distributions", () => {
      const baseline = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
      const identicalCurrent = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
      const shiftedCurrent = [80, 85, 90, 92, 95, 98, 100, 110, 120, 130];

      const stableResult = DriftMonitor.calculatePSI("invoiceAmount", baseline, identicalCurrent);
      expect(stableResult.driftLevel).toBe("NO_DRIFT");
      expect(stableResult.psiValue).toBeLessThan(0.10);

      const shiftedResult = DriftMonitor.calculatePSI("invoiceAmount", baseline, shiftedCurrent);
      expect(shiftedResult.driftLevel).toBe("SIGNIFICANT_DRIFT");
      expect(shiftedResult.psiValue).toBeGreaterThanOrEqual(0.25);
    });
  });
});
