import { describe, it, expect, beforeAll } from "vitest";
import { DatasetModelRegistry } from "../src/ml/registry/datasetModelRegistry";
import { CollegeLaunchService } from "../src/ml/services/collegeLaunchService";
import { UploadValidationEngine } from "../src/ml/governance/uploadValidationEngine";
import { ModelAdaptationEngine } from "../src/ml/adaptation/modelAdaptationEngine";
import { CanonicalInvoiceContract } from "../src/pipeline/canonicalContract";
import { FultonBenchmarkRunner } from "../src/ml/benchmark/fultonBenchmark";
import { BPIScaledPipeline } from "../src/ml/pipeline/bpiScaledPipeline";
import { MultiSourceNetworkEngine } from "../src/ml/network/multiSourceNetworkEngine";
import { SmartResolutionEngine } from "../src/ml/decision/smartResolutionEngine";

describe("Phase 13: College Launch Public Real Data ML & Strict Upload Validation", () => {
  // 1. Public real dataset training
  it("Area 1: Validates that Fulton County authentic dataset is registered and trainable", () => {
    const fulton = DatasetModelRegistry.getEntry("FULTON_COUNTY");
    expect(fulton).toBeDefined();
    expect(fulton?.provenanceStatus).toBe("VERIFIED_REAL");
    expect(fulton?.semanticNature).toContain("Municipal Transaction Payments");
  });

  // 2. Dataset-specific target
  it("Area 2: Confirms dataset-specific target definitions without artificial target forcing", () => {
    const fultonTargets = DatasetModelRegistry.getSupportedTargetsForDataset("FULTON_COUNTY");
    const bpiTargets = DatasetModelRegistry.getSupportedTargetsForDataset("BPI_CHALLENGE_2019");
    const ukTargets = DatasetModelRegistry.getSupportedTargetsForDataset("UK_DBT");

    expect(fultonTargets.some((t) => t.targetId === "PAYMENT_CYCLE_DURATION")).toBe(true);
    expect(fultonTargets.some((t) => t.targetId === "PAYMENT_CYCLE_RISK")).toBe(true);

    expect(bpiTargets.some((t) => t.targetId === "PROCESS_CLEARING_RISK")).toBe(true);
    expect(bpiTargets.some((t) => t.targetId === "PROCESS_PAYMENT_CYCLE_DURATION")).toBe(true);

    expect(ukTargets.some((t) => t.targetId === "PAYMENT_PRACTICE_BENCHMARK")).toBe(true);
  });

  // 3. Actual metric generation
  it("Area 3: Generates actual observed metrics from CollegeLaunchService for public models", () => {
    const status = CollegeLaunchService.getLaunchStatus();
    expect(status.operationalStage).toBe("STAGE_1_COLLEGE_LAUNCH_PUBLIC_REAL_DATA_ACTIVE");

    const fultonModel = status.stage1PublicModels.find((m) => m.datasetKey === "FULTON_COUNTY")!;
    expect(fultonModel.primaryMetrics.classification?.rocAuc).toBeCloseTo(0.6213, 2);
    expect(fultonModel.primaryMetrics.classification?.prAuc).toBeCloseTo(0.3990, 2);
    expect(fultonModel.primaryMetrics.regression?.mae).toBeCloseTo(8.31, 1);

    const bpiModel = status.stage1PublicModels.find((m) => m.datasetKey === "BPI_CHALLENGE_2019")!;
    expect(bpiModel.primaryMetrics.classification?.rocAuc).toBeCloseTo(0.9352, 2);
    expect(bpiModel.primaryMetrics.classification?.prAuc).toBeCloseTo(0.8648, 2);
    expect(bpiModel.primaryMetrics.regression?.mae).toBeCloseTo(15.15, 1);
  });

  // 4. Model persistence
  it("Area 4: Verifies model registry entries are defined with explicit production boundaries", () => {
    const fulton = DatasetModelRegistry.getEntry("FULTON_COUNTY")!;
    const logRegModel = fulton.candidateModels.find((m) => m.targetId === "PAYMENT_CYCLE_RISK")!;
    expect(logRegModel.lifecycleStatus).toBe("VALIDATED");
    expect(logRegModel.productionBoundary).toContain("Validated on US municipal procurement");
  });

  // 5. Upload validation engine execution
  it("Area 5: Executes 18-step upload validation pipeline on input datasets", () => {
    const report = UploadValidationEngine.validateUpload([], "Test Batch", "REAL_OBSERVED");
    expect(report.records).toBe(0);
    expect(report.mlReadinessVerdict).toBe("NOT_READY_FOR_ML");
    expect(report.verdictSymbol).toBe("⚠ NOT READY FOR ML");
    expect(report.blockingReasons.length).toBeGreaterThan(0);
  });

  // 6. Invalid schema rejection
  it("Area 6: Rejects datasets with missing amounts or unparseable dates", () => {
    const invalidRecords: any[] = [];
    for (let i = 0; i < 35; i++) {
      invalidRecords.push({
        transaction_id: `TXN-${i + 1}`,
        invoice_amount: i === 5 ? null : 10000, // Missing amount
        invoice_date: i === 10 ? "not-a-date" : "2026-01-01", // Unparseable date
        due_date: "2026-01-30",
        payment_date: "2026-02-05",
      });
    }

    const report = UploadValidationEngine.validateUpload(invalidRecords, "Schema Test");
    expect(report.mlReadinessVerdict).toBe("NOT_READY_FOR_ML");
    expect(report.blockingReasons.some((r) => r.includes("missing amounts") || r.includes("Critical missing"))).toBe(true);
  });

  // 7. Missing target rejection
  it("Area 7: Rejects datasets where payment date is missing for > 60% of records", () => {
    const records: any[] = [];
    for (let i = 0; i < 40; i++) {
      records.push({
        transaction_id: `TXN-UNSETTLED-${i + 1}`,
        sme_id: "SME-1",
        buyer_id: "B-1",
        invoice_amount: 50000,
        invoice_date: "2026-01-01",
        due_date: "2026-01-31",
        payment_date: i < 5 ? "2026-02-05" : null, // 35 / 40 = 87.5% missing!
      });
    }

    const report = UploadValidationEngine.validateUpload(records, "Target Test");
    expect(report.mlReadinessVerdict).toBe("NOT_READY_FOR_ML");
    expect(report.blockingReasons.some((r) => r.includes("Payment date is missing for"))).toBe(true);
  });

  // 8. Leakage rejection
  it("Area 8: Rejects datasets with post-outcome features or inverted dates", () => {
    const records: any[] = [];
    for (let i = 0; i < 35; i++) {
      records.push({
        transaction_id: `TXN-LEAK-${i + 1}`,
        sme_id: "SME-1",
        buyer_id: "B-1",
        invoice_amount: 50000,
        invoice_date: "2026-02-15",
        due_date: "2026-01-15", // Inverted date!
        payment_date: "2026-02-20",
        raw_payload: { future_default: 1 }, // Target leakage
      });
    }

    const report = UploadValidationEngine.validateUpload(records, "Leakage Test");
    expect(report.leakageDetected).toBe(true);
    expect(report.mlReadinessVerdict).toBe("NOT_READY_FOR_ML");
    expect(report.blockingReasons.some((r) => r.includes("Temporal sequence violation") || r.includes("Post-outcome"))).toBe(true);
  });

  // 9. Duplicate contamination rejection
  it("Area 9: Rejects datasets with duplicate transaction IDs", () => {
    const records: any[] = [];
    for (let i = 0; i < 35; i++) {
      records.push({
        transaction_id: i === 3 ? "TXN-1" : `TXN-${i + 1}`, // Duplicate ID TXN-1
        sme_id: "SME-1",
        buyer_id: "B-1",
        invoice_amount: 50000,
        invoice_date: "2026-01-01",
        due_date: "2026-01-30",
        payment_date: "2026-02-05",
      });
    }

    const report = UploadValidationEngine.validateUpload(records, "Duplicate Test");
    expect(report.duplicates.duplicateTxnIdCount).toBeGreaterThan(0);
    expect(report.mlReadinessVerdict).toBe("NOT_READY_FOR_ML");
    expect(report.blockingReasons.some((r) => r.includes("Duplicate contamination"))).toBe(true);
  });

  // 10. Temporal split verification
  it("Area 10: Ensures temporal coverage duration requirement is verified", () => {
    const records: any[] = [];
    // Only 10 days of observations
    for (let i = 0; i < 35; i++) {
      records.push({
        transaction_id: `TXN-SHORT-${i + 1}`,
        sme_id: "SME-1",
        buyer_id: "B-1",
        invoice_amount: 50000,
        invoice_date: "2026-01-01",
        due_date: "2026-01-10",
        payment_date: "2026-01-08",
      });
    }

    const report = UploadValidationEngine.validateUpload(records, "Short Duration Test");
    expect(report.temporalCoverage.sufficient).toBe(false);
    expect(report.blockingReasons.some((r) => r.includes("Temporal history is too short"))).toBe(true);
  });

  // 11. One-class dataset rejection
  it("Area 11: Rejects datasets containing only one class (100% on-time)", () => {
    const records: any[] = [];
    for (let i = 0; i < 35; i++) {
      records.push({
        transaction_id: `TXN-ONECLASS-${i + 1}`,
        sme_id: "SME-1",
        buyer_id: `B-${(i % 3) + 1}`,
        invoice_amount: 50000,
        invoice_date: new Date(new Date("2026-01-01").getTime() + i * 86400000 * 2).toISOString().slice(0, 10),
        due_date: new Date(new Date("2026-01-01").getTime() + (i * 2 + 30) * 86400000).toISOString().slice(0, 10),
        payment_date: new Date(new Date("2026-01-01").getTime() + (i * 2 + 25) * 86400000).toISOString().slice(0, 10), // Always 5 days before due date!
      });
    }

    const report = UploadValidationEngine.validateUpload(records, "One Class Test");
    expect(report.positiveEvents).toBe(0);
    expect(report.blockingReasons.some((r) => r.includes("Dataset contains only one class"))).toBe(true);
  });

  // 12. Insufficient sample rejection
  it("Area 12: Rejects datasets with fewer than 30 transactions", () => {
    const smallRecords: any[] = [
      {
        transaction_id: "TXN-1",
        sme_id: "SME-1",
        buyer_id: "B-1",
        invoice_amount: 50000,
        invoice_date: "2026-01-01",
        due_date: "2026-01-30",
        payment_date: "2026-02-05",
      },
    ];

    const report = UploadValidationEngine.validateUpload(smallRecords, "Small Sample");
    expect(report.records).toBe(1);
    expect(report.blockingReasons.some((r) => r.includes("Insufficient sample size"))).toBe(true);
  });

  // 13. Valid upload acceptance
  it("Area 13: Accepts clean, balanced, non-leaked dataset with ✓ SAFE FOR ML", () => {
    const cleanRecords: any[] = [];
    const baseDate = new Date("2026-01-01");

    for (let i = 0; i < 40; i++) {
      const invDate = new Date(baseDate.getTime() + i * 2 * 86400000);
      const dueDate = new Date(invDate.getTime() + 30 * 86400000);
      const payDate = new Date(dueDate.getTime() + (i % 2 === 0 ? 5 : -3) * 86400000);

      cleanRecords.push({
        transaction_id: `TXN-CLEAN-${i + 1}`,
        sme_id: "SME-AUTHENTIC",
        buyer_id: `BUYER-${(i % 4) + 1}`,
        invoice_amount: 75000 + i * 1500,
        invoice_date: invDate.toISOString().slice(0, 10),
        due_date: dueDate.toISOString().slice(0, 10),
        payment_date: payDate.toISOString().slice(0, 10),
      });
    }

    const report = UploadValidationEngine.validateUpload(cleanRecords, "Clean SME Upload", "REAL_OBSERVED");
    expect(report.mlReadinessVerdict).toBe("SAFE_FOR_ML");
    expect(report.verdictSymbol).toBe("✓ SAFE FOR ML");
    expect(report.blockingReasons.length).toBe(0);
    expect(report.targetAvailable).toBe(true);
  });

  // 14. Future SME data workflow
  it("Area 14: Verifies future SME model lineage progression definition", () => {
    const status = CollegeLaunchService.getLaunchStatus();
    expect(status.stage2FutureSmeAdaptation.status).toBe("INDIAN_SME_ADAPTATION_PENDING");
    expect(status.stage2FutureSmeAdaptation.modelLineage).toContain("PUBLIC MODEL -> LOCAL SME DATA ARRIVES");
  });

  // 15. Public model domain boundary enforcement
  it("Area 15: Confirms domain boundaries are explicitly stated and never claim unvalidated domains", () => {
    const status = CollegeLaunchService.getLaunchStatus();
    const fulton = status.stage1PublicModels.find((m) => m.datasetKey === "FULTON_COUNTY")!;
    const bpi = status.stage1PublicModels.find((m) => m.datasetKey === "BPI_CHALLENGE_2019")!;
    const uk = status.stage1PublicModels.find((m) => m.datasetKey === "UK_DBT")!;

    expect(fulton.domainBoundary).toContain("Not validated for Indian SME lending");
    expect(bpi.domainBoundary).toContain("Not a bank-default prediction model");
    expect(uk.domainBoundary).toContain("NOT an invoice-level predictive ML model");
  });

  // 16. Model registry integration
  it("Area 16: Assesses candidate local model against public champion with ModelAdaptationEngine", () => {
    const dummyPublic: any = {
      modelId: "MDL-PUB-FULTON-01",
      targetId: "PAYMENT_CYCLE_RISK",
      metrics: { classificationMetrics: { rocAuc: 0.835, brierScore: 0.168 } },
      provenance: { datasetPopulation: "Fulton County Vendor Payments" },
      productionBoundary: "Validated on Fulton County public municipal payment data.",
    };

    const dummyLocal: any = {
      modelId: "MDL-LOCAL-SME-01",
      targetId: "PAYMENT_DELAY_RISK",
      metrics: { classificationMetrics: { rocAuc: 0.810, brierScore: 0.170 } },
      provenance: { datasetPopulation: "Local Engineering SME Ledger" },
      productionBoundary: "Local SME domain model.",
    };

    const dummyAudit: any = {
      mlReadinessVerdict: "SAFE_FOR_ML",
      provenanceClassification: "REAL_OBSERVED",
      records: 120,
      censoringRatePercent: 20,
    };

    const comparison = ModelAdaptationEngine.compareAndAssessPromotion({
      publicChampion: dummyPublic,
      localCandidate: dummyLocal,
      localDatasetAudit: dummyAudit,
    });

    expect(comparison.recommendation).toBe("PROMOTE_LOCAL_MODEL");
    expect(comparison.governanceRationale).toContain("Approved for domain adaptation");
  });

  // 17. Prediction service
  it("Area 17: Generates explainable predictions from Fulton and BPI public models", () => {
    const fultonPred = CollegeLaunchService.predictFulton({
      invoiceAmount: 45000,
      isCheckDisbursement: true,
      vendorPriorMeanCycleDays: 16,
    });

    expect(fultonPred.datasetOrigin).toBe("FULTON_COUNTY");
    expect(fultonPred.targetId).toBe("PAYMENT_CYCLE_RISK");
    expect(fultonPred.predictedProbability).toBeGreaterThan(0);
    expect(fultonPred.predictedProbability).toBeLessThan(1);
    expect(["LOW", "ELEVATED", "CRITICAL"]).toContain(fultonPred.riskBand);
    expect(fultonPred.topContributingFeatures.length).toBeGreaterThan(0);

    const bpiPred = CollegeLaunchService.predictBPI({
      monetaryValue: 80000,
      hasPreInvoiceBlock: true,
      hasGoodsReceiptPreInvoice: false,
    });

    expect(bpiPred.datasetOrigin).toBe("BPI_CHALLENGE_2019");
    expect(bpiPred.targetId).toBe("PROCESS_CLEARING_RISK");
    expect(bpiPred.predictedProbability).toBeGreaterThan(0.5); // block + missing GR increases risk
    expect(bpiPred.riskBand).toBe("CRITICAL");
  });

  // 18. Network integration
  it("Area 18: Confirms public network graphs reflect genuine relationships without fake SME-buyer joins", () => {
    const fultonGraph = MultiSourceNetworkEngine.getFultonGraph();
    expect(fultonGraph.metadata.vendorCount).toBe(1268);
    expect(fultonGraph.metadata.buyerCount).toBe(51); // 51 County Departments

    // Fulton edges represent Vendor -> Municipal Department, never fake SME -> Buyer -> Supplier
    const edgeTypes = new Set(fultonGraph.edges.map((e) => e.relationshipType));
    expect(edgeTypes.has("SUPPLIES_MUNICIPAL_DEPARTMENT")).toBe(true);

    const bpiGraph = MultiSourceNetworkEngine.getBPIGraph();
    expect(bpiGraph.metadata.vendorCount).toBe(598);
  });

  // 19. Resolution engine
  it("Area 19: Generates decision-support recommendations with strict non-transactional disclaimers", () => {
    const plan = SmartResolutionEngine.generateUnifiedResolution({
      organizationId: "ORG-COLLEGE-DEMO",
      vendorId: "VEND-101",
      counterpartyId: "DEPT-TRANSPORT",
      predictedCycleDays: 28,
      riskBand: "ELEVATED",
      networkExposureINR: 1200000,
      domainContext: "FULTON_COUNTY",
    });

    expect(plan.operationalMode).toBe("DECISION_SUPPORT_ONLY_NO_EXECUTION");
    expect(plan.recommendedInterventions.length).toBeGreaterThan(0);
    expect(plan.governanceNotice).toContain("DECISION SUPPORT ONLY");
  });

  // 20. Full regression verification
  it("Area 20: Ensures Stage 1 and Stage 2 coexistence does not break Indian SME gating", () => {
    const status = CollegeLaunchService.getLaunchStatus();
    expect(status.operationalStage).toBe("STAGE_1_COLLEGE_LAUNCH_PUBLIC_REAL_DATA_ACTIVE");
    expect(status.stage2FutureSmeAdaptation.status).toBe("INDIAN_SME_ADAPTATION_PENDING");
  });
});
