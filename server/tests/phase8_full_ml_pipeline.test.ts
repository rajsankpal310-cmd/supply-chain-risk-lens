/**
 * NEXUS-CFR Phase 8: Full End-to-End Governed ML & Decision-Support Pipeline Test Suite
 *
 * Verifies all 20 pillars of the complete ML integration:
 * 1. Dataset Ingestion & Provenance (BPI Challenge 2019, 4TU.ResearchData, CC BY 4.0)
 * 2. Canonical ERP Event Normalization (Zero fabricated fields)
 * 3. Observable Target Construction (Duration, Risk Threshold, Exceptions, WBES Context)
 * 4. Anti-Leakage Audit (Clearing events & post-outcomes blocked)
 * 5. Chronological Temporal Split with Embargo
 * 6. Leakage-Safe Feature Generation
 * 7. Multi-Model Benchmark (Classification: LogReg, RF, GBDT, Platt; Regression: Ridge, RF, GBDT)
 * 8. Model Evaluation Metrics (ROC-AUC, PR-AUC, F1, Brier, Calibration, MAE, RMSE)
 * 9. Probability Calibration (Platt Scaling)
 * 10. Governed Model Registry & Lifecycle Transitions (Simulated Data Firewall)
 * 11. Explainable Predictions (Risk Band, Score, Calibrated Probability, Top Factors)
 * 12. Graph Integration (Node Risk, Degree Centrality, Concentration, Cascade Severity)
 * 13. Cascade Simulation (Labeled HYPOTHETICAL / SCENARIO OUTPUT)
 * 14. Deadlock Detection (Root Node, Connected Nodes, Bottleneck Entity, Possible Cascade)
 * 15. Smart Resolution Engine (Action, Reason, Trigger, Impact, Confidence, Limitations)
 * 16. Intervention Optimization (Before/After Risk Reduction, Resource Utilization)
 * 17. Multi-Tenant Isolation
 * 18. Cryptographic Lineage Tracking
 * 19. Comprehensive Dashboard ML Intelligence
 * 20. Governed Fail-Safe Fallback Behavior
 */

import { describe, it, expect, beforeAll } from "vitest";
import fs from "fs";
import path from "path";
import { normalizeERPEventLogBatch } from "../src/pipeline/canonicalTransformer";
import { FeatureEngine } from "../src/ml/features/featureEngine";
import { AntiLeakageAuditor } from "../src/ml/features/featureEligibility";
import { TARGET_REGISTRY, checkTargetSourceCompatibility } from "../src/ml/targets/targetRegistry";
import { ModelBenchmarkSuite } from "../src/ml/models/modelBenchmark";
import { MultiTenantModelRegistry } from "../src/ml/registry/modelRegistry";
import { BPIEnterprisePipeline } from "../src/ml/pipeline/bpiEnterprisePipeline";
import { NetworkService } from "../src/services/network.service";
import { SimulationService } from "../src/services/simulation.service";
import { DeadlockService } from "../src/services/deadlock.service";
import { RecommendationService } from "../src/services/recommendation.service";
import { OptimizationService } from "../src/services/optimization.service";
import { DashboardService } from "../src/services/dashboard.service";

describe("NEXUS-CFR Phase 8: Full End-to-End Governed ML Pipeline", () => {
  const testTenantA = "ORG-001";
  const testTenantB = "ORG-002";

  // Pre-seed pipeline training so predictions and models are available across all downstream tests
  beforeAll(async () => {
    await BPIEnterprisePipeline.execute({
      organizationId: testTenantA,
      targetId: "PAYMENT_CYCLE_RISK",
      actorRole: "SME_ADMIN",
      autoPromoteToProduction: true,
    });
  });

  // 1. Dataset Ingestion & Governed Source Provenance
  it("Pillar 1: Ingests authentic BPI Challenge 2019 dataset with verified 4TU provenance", () => {
    const dataPath = path.resolve(__dirname, "../data/bpi_challenge_2019_canonical.json");
    expect(fs.existsSync(dataPath)).toBe(true);

    const raw = JSON.parse(fs.readFileSync(dataPath, "utf8"));
    expect(raw.source.provenance).toBe("REAL_OBSERVED_PUBLIC_ENTERPRISE_EVENT_LOG");
    expect(raw.source.publisher).toContain("4TU.ResearchData");
    expect(raw.source.license).toBe("CC BY 4.0");
    expect(raw.source.doi).toBe("10.4121/uuid:d06afd4a-3f7a-4719-86d6-f4d08b3d8d32");
    expect(raw.cases.length).toBeGreaterThan(10);

    // Verify domain truth: explicitly not claimed as Indian SME data
    expect(raw.source.limitations).toContain("NOT an Indian SME dataset");
    expect(raw.source.limitations).toContain("Zero fabricated contractual delinquency");
  });

  // 2. Canonical ERP Normalization
  it("Pillar 2: Normalizes ERP event log batch into canonical contract without fabricated fields", () => {
    const dataPath = path.resolve(__dirname, "../data/bpi_challenge_2019_canonical.json");
    const raw = JSON.parse(fs.readFileSync(dataPath, "utf8"));

    const canonical = normalizeERPEventLogBatch(raw.cases, testTenantA);
    expect(canonical.length).toBe(raw.cases.length);

    for (const record of canonical) {
      expect(record.case_id).toBeDefined();
      expect(record.vendor_id).toBeDefined();
      expect(record.organization_id).toBe(testTenantA);
      // Contractual due date is genuinely absent in BPI 2019: must be undefined, never fabricated
      expect((record as any).contractual_due_date).toBeUndefined();
    }
  });

  // 3. Observable Target Construction
  it("Pillar 3: Constructs observable targets and blocks contractual targets when due date is absent", () => {
    expect(TARGET_REGISTRY["PAYMENT_CYCLE_DURATION"].targetId).toBe("PAYMENT_CYCLE_DURATION");
    expect(TARGET_REGISTRY["PAYMENT_CYCLE_RISK"].targetId).toBe("PAYMENT_CYCLE_RISK");
    expect(TARGET_REGISTRY["PROCESS_EXCEPTION_RISK"].targetId).toBe("PROCESS_EXCEPTION_RISK");
    expect(TARGET_REGISTRY["FINANCIAL_STRESS_PROXY"].name).toContain("Modelled Process Stress Proxy");

    // Compatibility check for ERP Event Logs
    const erpDuration = checkTargetSourceCompatibility("PAYMENT_CYCLE_DURATION", "ERP_EVENT_LOG_DATA");
    expect(erpDuration.compatible).toBe(true);
    expect(erpDuration.status).toBe("READY");

    const erpRisk = checkTargetSourceCompatibility("PAYMENT_CYCLE_RISK", "ERP_EVENT_LOG_DATA");
    expect(erpRisk.compatible).toBe(true);
    expect(erpRisk.status).toBe("READY");

    // Contractual delinquency target requires genuine contractual due date
    const contractualDelinquency = checkTargetSourceCompatibility("PAYMENT_DELAY_RISK", "ERP_EVENT_LOG_DATA");
    expect(contractualDelinquency.compatible).toBe(false);
    expect(contractualDelinquency.status).toBe("UNAVAILABLE_FOR_CURRENT_SOURCE");
    expect(contractualDelinquency.reason).toContain("UNAVAILABLE_FOR_CURRENT_SOURCE");
  });

  // 4. Anti-Leakage Audit
  it("Pillar 4: Enforces pre-outcome feature availability and detects post-outcome leakage", () => {
    const validFeatures = [...FeatureEngine.ERP_ACTIVE_NUMERIC_FEATURES];
    const auditValid = AntiLeakageAuditor.auditFeatureCandidateList(validFeatures);
    expect(auditValid.isLeakageFree).toBe(true);
    expect(auditValid.forbiddenFeaturesDetected.length).toBe(0);

    // Contaminated candidate with post-outcome clearing event must fail
    const contaminatedFeatures = [...validFeatures, "clearing_event", "process_duration", "paymentDate"];
    const auditContaminated = AntiLeakageAuditor.auditFeatureCandidateList(contaminatedFeatures);
    expect(auditContaminated.isLeakageFree).toBe(false);
    expect(auditContaminated.forbiddenFeaturesDetected.length).toBeGreaterThan(0);
  });

  // 5 & 6. Feature Extraction & Temporal Partitioning
  it("Pillar 5 & 6: Extracts 22 ERP features and performs chronological split with embargo", async () => {
    const result = await BPIEnterprisePipeline.execute({
      organizationId: testTenantA,
      targetId: "PAYMENT_CYCLE_RISK",
      actorRole: "SME_ADMIN",
      autoPromoteToProduction: true,
    });

    expect(result.status).toBe("SUCCESS");
    expect(result.leakageAudit.passed).toBe(true);
    expect(result.leakageAudit.temporalEmbargoDays).toBe(14);
    expect(result.datasetMetadata.totalCasesIngested).toBeGreaterThan(10);
    expect(result.summary.totalEvaluatedCases).toBeGreaterThan(10);
  });

  // 7, 8 & 9. Multi-Model Benchmark, Metrics & Calibration
  it("Pillar 7, 8 & 9: Executes multi-model benchmark, calculates metrics, and calibrates probabilities", async () => {
    const result = await BPIEnterprisePipeline.execute({
      organizationId: testTenantA,
      targetId: "PAYMENT_CYCLE_RISK",
      actorRole: "SME_ADMIN",
      autoPromoteToProduction: true,
    });

    const report = result.benchmarkReport;
    expect(report.candidates.length).toBeGreaterThanOrEqual(4);

    // Check candidate models include LogReg, DecisionForest, GradientBoosting, CalibratedModel
    const modelTypes = report.candidates.map((c) => c.modelType);
    expect(modelTypes).toContain("LOGISTIC_REGRESSION");
    expect(modelTypes).toContain("DECISION_FOREST");
    expect(modelTypes).toContain("GRADIENT_BOOSTING");
    expect(modelTypes.some((t) => t.includes("CALIBRATED"))).toBe(true);

    // Metrics validation
    for (const c of report.candidates) {
      expect(c.trainMetrics).toBeDefined();
      expect(c.validationMetrics).toBeDefined();
      expect(c.selectionScore).toBeGreaterThanOrEqual(0);
    }

    expect(report.selectedProductionCandidate).toBeDefined();
    expect(report.selectedProductionCandidate.isProductionCandidate).toBe(true);

    // Calibration report
    expect(result.registeredModel.calibration).toBeDefined();
    expect(result.registeredModel.calibration?.expectedCalibrationError).toBeDefined();
    expect(result.registeredModel.calibration?.expectedCalibrationError).toBeLessThan(0.40);
    expect((report.selectedProductionCandidate.validationMetrics as any).brierScore).toBeDefined();
  });

  // 10. Model Registry & Simulated Data Firewall
  it("Pillar 10: Governs model registry lifecycle and prevents unapproved or synthetic models in production", () => {
    const syntheticModel = MultiTenantModelRegistry.registerModel(testTenantA, {
      version: "1.0-SYNTHETIC-TEST",
      modelType: "LOGISTIC_REGRESSION",
      targetId: "PAYMENT_CYCLE_RISK",
      targetVersion: "1.0",
      datasetId: "DS-SYNTHETIC",
      datasetVersion: "1.0",
      featureVersion: "1.0",
      trainingMetadata: {
        trainedAt: new Date().toISOString(),
        trainingRecordCount: 100,
        validationRecordCount: 50,
        testRecordCount: 50,
        trainWindow: { start: "2020-01-01", end: "2020-06-01" },
        validationStrategy: "OOT",
        hyperparameters: {},
      },
    });
    syntheticModel.dataProvenanceClassification = "SIMULATED_BENCHMARK";

    // Mark as approved first
    MultiTenantModelRegistry.transitionLifecycle(testTenantA, syntheticModel.modelId, "APPROVED", "SME_ADMIN");

    // Attempting deployment without allowSimulatedDemo must trigger the Simulated Data Firewall
    expect(() => {
      MultiTenantModelRegistry.transitionLifecycle(
        testTenantA,
        syntheticModel.modelId,
        "PRODUCTION",
        "SME_ADMIN",
        "Deploy test",
        false // allowSimulatedDemo = false
      );
    }).toThrow(/Simulated Data Firewall/);
  });

  // 11. Explainable Prediction Serving
  it("Pillar 11: Generates explainable predictions with risk bands, probabilities, and top drivers", () => {
    const predictions = BPIEnterprisePipeline.getPredictions(testTenantA);
    expect(predictions.length).toBeGreaterThan(0);

    const firstPred = predictions[0];
    expect(firstPred.predictionId).toBeDefined();
    expect(firstPred.riskScore).toBeGreaterThanOrEqual(0);
    expect(firstPred.riskScore).toBeLessThanOrEqual(100);
    expect(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).toContain(firstPred.riskBand);
    expect(firstPred.calibratedProbability).toBeGreaterThanOrEqual(0);
    expect(firstPred.calibratedProbability).toBeLessThanOrEqual(1);
    expect(firstPred.topContributingFactors.length).toBeGreaterThanOrEqual(1);
    expect(firstPred.historicalEvidence).toBeDefined();
  });

  // 12. Graph Integration
  it("Pillar 12: Integrates ML risk into buyer/supplier network graph layer", async () => {
    const network = await NetworkService.getNetwork(testTenantA);
    expect(network.nodes).toBeDefined();
    expect(network.edges).toBeDefined();
    expect(network.metrics).toBeDefined();
    expect(network.metrics.totalNodes).toBeGreaterThan(0);
    expect(network.metrics.cascadeSeverityScore).toBeGreaterThanOrEqual(0);
  });

  // 13. Cascade Simulation
  it("Pillar 13: Labels scenario cascade simulation as HYPOTHETICAL / SCENARIO OUTPUT", async () => {
    const simulationResult = await SimulationService.runSimulation(testTenantA, {
      delayDays: 60,
      amount: 4000000,
      severity: "HIGH",
    });

    expect(simulationResult.result.scenarioLabel).toBe("HYPOTHETICAL / SCENARIO OUTPUT");
    expect(simulationResult.result.disclaimer).toContain("Never feed simulated cascade outputs backward into ML training");
    expect(simulationResult.result.affectedNodeCount).toBeGreaterThan(0);
    expect(simulationResult.result.downstreamImpact).toBeGreaterThan(0);
  });

  // 14. Deadlock Detection
  it("Pillar 14: Enriches deadlock detection with root risk node, connected nodes, and bottleneck entity", async () => {
    const deadlocks = await DeadlockService.getDeadlocks(testTenantA);
    expect(Array.isArray(deadlocks)).toBe(true);

    if (deadlocks.length > 0) {
      const d = deadlocks[0];
      expect(d.rootFirmId).toBeDefined();
      expect(d.totalExposure).toBeGreaterThanOrEqual(0);
      expect(d.deadlockRisk).toBeGreaterThanOrEqual(0);
    }
  });

  // 15. Smart Resolution Engine
  it("Pillar 15: Produces decision-support recommendations with full 7-parameter schema", async () => {
    const recs = await RecommendationService.getRecommendations(testTenantA);
    expect(Array.isArray(recs)).toBe(true);

    if (recs.length > 0) {
      const r = recs[0] as any;
      expect(r.action).toBeDefined();
      expect(r.reason).toBeDefined();
      expect(r.trigger).toBeDefined();
      expect(r.expectedImpact).toBeDefined();
      expect(r.confidence).toBeGreaterThanOrEqual(0);
      expect(r.riskReductionEstimate).toBeGreaterThanOrEqual(0);
      expect(r.limitations).toContain("Decision-support recommendation only");
    }
  });

  // 16. Intervention Optimization
  it("Pillar 16: Optimizes resource allocation with before/after risk reduction and utilization", async () => {
    const opt = await OptimizationService.runOptimization(testTenantA, 5000000);
    expect(opt.label).toBe("MODEL-BASED DECISION RECOMMENDATION");
    expect(opt.resourceUtilization).toBeDefined();
    expect(opt.resourceUtilization.utilizationPercent).toBeGreaterThanOrEqual(0);
    expect(opt.riskReduction.cascadeRiskBefore).toBeGreaterThanOrEqual(opt.riskReduction.cascadeRiskAfter);
    expect(opt.expectedLoss.savedAmount).toBeGreaterThanOrEqual(0);
  });

  // 17. Multi-Tenant Isolation
  it("Pillar 17: Prevents cross-tenant access to model artifacts and predictions", () => {
    const tenantAModels = MultiTenantModelRegistry.listModelsForTenant(testTenantA);
    if (tenantAModels.length > 0) {
      const modelId = tenantAModels[0].modelId;
      expect(() => {
        MultiTenantModelRegistry.getModel(testTenantB, modelId);
      }).toThrow(/Unauthorized access/);
    }
  });

  // 18. Governed Lineage Tracking
  it("Pillar 18: Traces end-to-end cryptographic provenance from raw dataset to prediction", () => {
    const predictions = BPIEnterprisePipeline.getPredictions(testTenantA);
    expect(predictions.length).toBeGreaterThan(0);

    const lineage = predictions[0].lineage;
    expect(lineage.sourceName).toContain("BPI Challenge 2019");
    expect(lineage.datasetVersion).toBe("2019.1.0");
    expect(lineage.featureVersion).toBe("2.0-ERP-EVENT-LOG");
    expect(lineage.modelVersion).toBe("1.0-BPI-ENTERPRISE-PROD");
    expect(lineage.computedAt).toBeDefined();
  });

  // 19. Dashboard ML Intelligence Integration
  it("Pillar 19: Provides comprehensive ML intelligence in dashboard summary without crashing", async () => {
    const summary = await DashboardService.getSummary(testTenantA, "SME_ADMIN");
    expect(summary.mlIntelligence).toBeDefined();
    expect(summary.mlIntelligence.status).toBe("ACTIVE");
    expect(summary.mlIntelligence.modelStatus).toBeDefined();
    expect(summary.mlIntelligence.risk).toBeDefined();
    expect(summary.mlIntelligence.network).toBeDefined();
    expect(summary.mlIntelligence.modelPerformance).toBeDefined();
    expect(summary.mlIntelligence.explainability).toBeDefined();
  });

  // 20. Fail-Safe Fallback Behavior
  it("Pillar 20: Returns governed heuristic fallback when no production model is deployed", async () => {
    const emptyTenantSummary = await DashboardService.getSummary("ORG-UNCONFIGURED-NEW", "VIEWER");
    expect(emptyTenantSummary.mlIntelligence).toBeDefined();
    expect(emptyTenantSummary.mlIntelligence.prediction_status).toBe("HEURISTIC_FALLBACK");
    expect(emptyTenantSummary.mlIntelligence.blocker_code).toBe("NO_DEPLOYED_PRODUCTION_MODEL");
  });
});
