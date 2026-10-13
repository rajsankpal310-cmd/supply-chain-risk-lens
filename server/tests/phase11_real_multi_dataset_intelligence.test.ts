/**
 * Phase 11 Test Suite: Real Multi-Dataset Intelligence, Model Benchmarking,
 * Network Risk Isolation & Governed Decision Support
 *
 * Validates:
 * 1. Fulton County full model benchmark suite (Baselines vs LogReg vs Ridge vs Tree-based)
 * 2. BPI Challenge 2019 scaled streaming pipeline (5,000 real cases, anti-leakage, OOT split)
 * 3. UK DBT large-scale corporate payment practice intelligence (348k+ filings, 11k+ companies)
 * 4. Cross-domain benchmark layer (Observed transaction vs Process event vs Reported practice)
 * 5. Multi-source network intelligence with strict topological domain isolation
 * 6. Hypothetical cascade simulation with mandatory governance disclaimers
 * 7. Smart resolution engine with actionable, non-transactional decision support
 * 8. Formal dataset-specific model registry with semantic target boundaries
 * 9. Multi-source data quality auditing & statistical drift monitoring (PSI)
 * 10. Model promotion boundary enforcement (Municipal / ERP != Indian MSME credit underwriting)
 */

import { describe, it, expect, beforeAll } from "vitest";
import { FultonBenchmarkRunner } from "../src/ml/benchmark/fultonBenchmark";
import { BPIScaledPipeline } from "../src/ml/pipeline/bpiScaledPipeline";
import { UKDBTAnalyticsEngine } from "../src/ml/analytics/ukDbtAnalytics";
import { DatasetModelRegistry } from "../src/ml/registry/datasetModelRegistry";
import { MultiSourceNetworkEngine } from "../src/ml/network/multiSourceNetworkEngine";
import { CascadeEngine } from "../src/ml/simulation/cascadeEngine";
import { SmartResolutionEngine } from "../src/ml/decision/smartResolutionEngine";
import { MultiSourceQualityMonitor } from "../src/ml/monitoring/multiSourceQualityMonitor";
import { MultiTenantModelRegistry } from "../src/ml/registry/modelRegistry";
import { DataFirewall } from "../src/ml/governance/dataFirewall";

describe("Phase 11: Real Multi-Dataset Intelligence & Governed Decision Support", () => {
  const orgId = "tenant-phase11-test";

  describe("1. Fulton County Full Model Benchmark Suite", () => {
    let fultonResult: any = null;

    it("executes multi-model benchmark on authentic Fulton County payments", async () => {
      fultonResult = await FultonBenchmarkRunner.executeBenchmark({
        organizationId: orgId,
        actorRole: "SME_ADMIN"
      });

      expect(fultonResult.status).toBe("SUCCESS");
      expect(fultonResult.sourceDataset.totalRecords).toBe(10000);
      expect(fultonResult.sourceDataset.vendorCount).toBeGreaterThan(500);
      expect(fultonResult.sourceDataset.buyerCount).toBeGreaterThan(30);
    }, 60000);

    it("verifies classification benchmark candidates and out-of-time evaluation", () => {
      const clsReport = fultonResult.classificationBenchmark;
      expect(clsReport.candidates.length).toBeGreaterThanOrEqual(3);

      // Verify candidates include Regularized Logistic Regression and Decision Forest
      const hasLogReg = clsReport.candidates.some((c: any) => c.modelType === "LOGISTIC_REGRESSION");
      const hasForest = clsReport.candidates.some((c: any) => c.modelType === "DECISION_FOREST");
      expect(hasLogReg).toBe(true);
      expect(hasForest).toBe(true);

      const champ = fultonResult.championClassificationModel;
      expect(champ.validationMetrics.rocAuc).toBeDefined();
      expect(champ.calibrationReport).toBeDefined();
      expect(champ.brierScore ?? (champ.validationMetrics as any).brierScore).toBeLessThan(0.40);
    });

    it("verifies regression benchmark candidates and out-of-time evaluation", () => {
      const regReport = fultonResult.regressionBenchmark;
      expect(regReport.candidates.length).toBeGreaterThanOrEqual(2);

      const hasRidge = regReport.candidates.some((c: any) => c.modelType === "RIDGE_REGRESSION");
      const hasForestReg = regReport.candidates.some((c: any) => c.modelType === "RANDOM_FOREST_REGRESSOR");
      expect(hasRidge).toBe(true);
      expect(hasForestReg).toBe(true);

      const champ = fultonResult.championRegressionModel;
      expect(champ.validationMetrics.mae).toBeDefined();
      expect(champ.validationMetrics.rmse).toBeDefined();
      expect(champ.validationMetrics.mae).toBeGreaterThan(0);
    });

    it("confirms registered model artifact and promotion gate evaluation", () => {
      const artifact = fultonResult.registeredChampionArtifact;
      expect(artifact.modelId).toBeDefined();
      expect(artifact.dataProvenanceClassification).toBe("VERIFIED_REAL");
      expect(fultonResult.promotionStatus).toBe("VALIDATED");

      // Verify retrieved from registry
      const stored = MultiTenantModelRegistry.getArtifact(orgId, artifact.modelId);
      expect(stored).not.toBeNull();
      expect(stored?.lifecycleState).toBe("VALIDATED");
    });
  });

  describe("2. BPI Challenge 2019 Scaled Streaming ML Pipeline", () => {
    let bpiResult: any = null;

    it("executes scaled pipeline on authentic empirical BPI case stream", async () => {
      bpiResult = await BPIScaledPipeline.execute({
        organizationId: orgId,
        actorRole: "SME_ADMIN"
      });

      expect(bpiResult.status).toBe("SUCCESS");
      expect(bpiResult.totalCasesEvaluated).toBeGreaterThanOrEqual(2000);
      expect(bpiResult.datasetProvenance).toBe("VERIFIED_REAL_STREAMING");
    }, 60000);

    it("enforces strict anti-leakage feature protection and pre-t0 guarantees", () => {
      expect(bpiResult.leakageAudit.passed).toBe(true);
      expect(bpiResult.leakageAudit.preT0Guaranteed).toBe(true);
      expect(bpiResult.leakageAudit.forbiddenFeaturesBlocked).toContain("clearing_date");
      expect(bpiResult.leakageAudit.forbiddenFeaturesBlocked).toContain("process_duration_days");
    });

    it("verifies multi-model process clearing benchmarks", () => {
      const clsReport = bpiResult.classificationBenchmark;
      expect(clsReport.candidates.length).toBeGreaterThanOrEqual(2);

      const champCls = bpiResult.championClassificationModel;
      expect(champCls.validationMetrics.rocAuc).toBeDefined();

      const regReport = bpiResult.regressionBenchmark;
      expect(regReport.candidates.length).toBeGreaterThanOrEqual(2);
      const champReg = bpiResult.championRegressionModel;
      expect(champReg.validationMetrics.mae).toBeDefined();
      expect(champReg.validationMetrics.rmse).toBeDefined();
    });

    it("confirms strict enterprise process production boundary", () => {
      expect(bpiResult.productionBoundary.validatedDomain).toBe("ENTERPRISE_ERP_PROCESS_MINING");
      expect(bpiResult.productionBoundary.prohibitedDomain).toBe("INDIAN_SME_CREDIT_UNDERWRITING");
      expect(bpiResult.productionBoundary.attestation).toContain("mathematically and institutionally separate");
    });
  });

  describe("3. UK DBT Large-Scale Corporate Payment Practice Analytics", () => {
    it("retrieves verified population payment statistics over 348k+ filings", () => {
      const pop = UKDBTAnalyticsEngine.getPopulationSummary();
      expect(pop.metadata.source).toContain("UK Department for Business and Trade");
      expect(pop.metadata.status).toBe("VERIFIED_REAL");
      expect(pop.populationAverages.averageTimeDays).toBeGreaterThan(20);
      expect(pop.populationAverages.averageTimeDays).toBeLessThan(60);
      expect(pop.populationAverages.percentWithinAgreedTerms).toBeGreaterThan(60);
      expect(pop.populationAverages.supplyChainFinancingAdoptionPct).toBeGreaterThan(0);
    });

    it("provides sector breakdowns across real economic industries", () => {
      const sectors = UKDBTAnalyticsEngine.getSectorBenchmarks();
      expect(Object.keys(sectors).length).toBeGreaterThanOrEqual(6);

      expect(sectors["MANUFACTURING_METALS"]).toBeDefined();
      expect(sectors["MANUFACTURING_METALS"].averagePaymentTimeDays).toBeGreaterThan(35);
      expect(sectors["ENERGY_UTILITIES"]).toBeDefined();
      expect(sectors["IT_TELECOM"]).toBeDefined();
    });

    it("profiles specific corporate entities with full risk bands", () => {
      const profile = UKDBTAnalyticsEngine.findCompanyProfile("BRS SYSTEMS LTD");
      expect(profile).not.toBeNull();
      if (profile) {
        expect(profile.company).toContain("BRS SYSTEMS");
        expect(profile.meanPaymentTimeDays).toBeGreaterThan(50);
        expect(profile.riskBand).toBe("SEVERE");
      }
    });

    it("provides clean cross-domain benchmark layer without artificial merging", () => {
      const crossDomain = UKDBTAnalyticsEngine.getCrossDomainBenchmark();
      expect(crossDomain.comparisons.length).toBe(4);

      const fultonComp = crossDomain.comparisons.find(c => c.datasetName.includes("Fulton"));
      const bpiComp = crossDomain.comparisons.find(c => c.datasetName.includes("BPI"));
      const dbtComp = crossDomain.comparisons.find(c => c.datasetName.includes("UK DBT"));
      const mendeleyComp = crossDomain.comparisons.find(c => c.datasetName.includes("Mendeley"));

      expect(fultonComp?.semanticNature).toBe("OBSERVED_TRANSACTION");
      expect(bpiComp?.semanticNature).toBe("PROCESS_EVENT");
      expect(dbtComp?.semanticNature).toBe("CORPORATE_REPORTED_PRACTICE");
      expect(mendeleyComp?.semanticNature).toBe("SIMULATED_BENCHMARK");
    });
  });

  describe("4. Multi-Source Network Risk & Strict Domain Isolation", () => {
    it("builds authentic Fulton County municipal procurement network", () => {
      const fultonNet = MultiSourceNetworkEngine.getFultonNetwork();
      expect(fultonNet.domain).toBe("FULTON_MUNICIPAL_PROCUREMENT");
      expect(fultonNet.sourceProvenance).toBe("VERIFIED_REAL");
      expect(fultonNet.totalNodes).toBeGreaterThan(700);
      expect(fultonNet.totalEdges).toBeGreaterThan(500);
      expect(fultonNet.identifiedHubs.length).toBeGreaterThan(0);

      const topNode = fultonNet.topNodesByCentrality[0];
      expect(topNode.weightedDegree).toBeGreaterThan(0);
      expect(topNode.concentrationHHI).toBeGreaterThanOrEqual(0);
      expect(topNode.concentrationHHI).toBeLessThanOrEqual(1.0);
    });

    it("builds authentic BPI enterprise purchasing network in complete isolation", () => {
      const bpiNet = MultiSourceNetworkEngine.getBPINetwork();
      expect(bpiNet.domain).toBe("BPI_ENTERPRISE_ERP");
      expect(bpiNet.sourceProvenance).toBe("VERIFIED_REAL_STREAMING");
      expect(bpiNet.totalNodes).toBeGreaterThan(300);

      // Verify strict isolation: Fulton vendors should not appear in BPI
      const bpiNodeNames = new Set(bpiNet.topNodesByCentrality.map(n => n.nodeName));
      expect(bpiNodeNames.has("FULTON_COUNTY_GOVERNMENT")).toBe(false);
    });
  });

  describe("5. Hypothetical Contagion & Cascade Simulation", () => {
    it("simulates stress contagion across authentic Fulton network topology", () => {
      const sim = CascadeEngine.simulateCascade({
        triggerNodeId: "FULTON_HUB",
        domain: "FULTON_MUNICIPAL",
        initialShockLatencyDays: 30,
        monetaryShockExposure: 100000,
        liquidityBufferRatio: 0.20
      });

      expect(sim.scenarioType).toBe("HYPOTHETICAL_SCENARIO");
      expect(sim.disclaimer).toContain("MATHEMATICAL SIMULATION ONLY");
      expect(sim.totalNetworkEntitiesAtRisk).toBeGreaterThan(1);
      expect(sim.totalSystemicExposureShock).toBeGreaterThan(100000);
      expect(sim.affectedEntities.length).toBeGreaterThan(1);

      // Verify Tier 0 trigger
      expect(sim.affectedEntities[0].tier).toBe(0);
      expect(sim.affectedEntities[0].residualShock).toBe(100000);

      // Verify Tier 1 partners absorbed some buffer
      const tier1 = sim.affectedEntities.find(e => e.tier === 1);
      if (tier1) {
        expect(tier1.bufferAbsorbed).toBeGreaterThan(0);
      }
    });
  });

  describe("6. Smart Resolution Decision Support Engine", () => {
    it("generates actionable non-transactional recommendations for high-risk context", () => {
      const res = SmartResolutionEngine.generateRecommendations({
        entityId: "VENDOR_ALPHA",
        entityName: "Alpha Logistics LLC",
        entityType: "SUPPLIER",
        domain: "FULTON_MUNICIPAL",
        riskScore: 75,
        riskBand: "HIGH",
        predictedLatencyDays: 35,
        concentrationHHI: 0.55
      });

      expect(res.advisoryDisclaimer).toContain("NON-TRANSACTIONAL ADVISORY ONLY");
      expect(res.recommendations.length).toBeGreaterThanOrEqual(2);

      const types = res.recommendations.map(r => r.actionType);
      expect(types).toContain("PAYMENT_PRIORITIZATION");
      expect(types).toContain("SUPPLIER_DIVERSIFICATION");

      for (const rec of res.recommendations) {
        expect(rec.triggerCondition).toBeDefined();
        expect(rec.primaryEvidence).toBeDefined();
        expect(rec.rationale).toBeDefined();
        expect(rec.expectedImpact).toBeDefined();
        expect(rec.confidenceScore).toBeGreaterThan(0.70);
        expect(rec.evidenceSource).toBeDefined();
        expect(rec.operationalLimitation).toBeDefined();
      }
    });
  });

  describe("7. Formal Dataset-Specific Model Registry", () => {
    it("enforces formal mapping and semantic target constraints", () => {
      const reg = DatasetModelRegistry.getRegistry();
      expect(Object.keys(reg)).toContain("FULTON_COUNTY");
      expect(Object.keys(reg)).toContain("BPI_CHALLENGE_2019");
      expect(Object.keys(reg)).toContain("UK_DBT");
      expect(Object.keys(reg)).toContain("MENDELEY_RECEIVABLES");

      // Fulton checks
      const fultonEntry = reg["FULTON_COUNTY"];
      expect(fultonEntry.provenanceStatus).toBe("VERIFIED_REAL");
      expect(fultonEntry.supportedTargets.map(t => t.targetId)).toContain("PAYMENT_CYCLE_DURATION");
      expect(fultonEntry.supportedTargets.map(t => t.targetId)).toContain("PAYMENT_CYCLE_RISK");

      // BPI checks
      const bpiEntry = reg["BPI_CHALLENGE_2019"];
      expect(bpiEntry.provenanceStatus).toBe("VERIFIED_REAL_STREAMING");
      expect(bpiEntry.supportedTargets.map(t => t.targetId)).toContain("PROCESS_PAYMENT_CYCLE_DURATION");

      // UK DBT checks
      const dbtEntry = reg["UK_DBT"];
      expect(dbtEntry.supportedTargets.map(t => t.targetType)).toContain("STATISTICAL_BENCHMARK");
      expect(dbtEntry.strictNegativeConstraints[0]).toContain("Do NOT convert aggregate/company-level fields into fake invoice-level transaction rows");

      // Mendeley simulated fixture checks
      const mendeleyEntry = reg["MENDELEY_RECEIVABLES"];
      expect(mendeleyEntry.provenanceStatus).toBe("BENCHMARK_FIXTURE_SIMULATED");
      expect(mendeleyEntry.candidateModels[0].lifecycleStatus).toBe("DEMO_ONLY");
    });
  });

  describe("8. Multi-Source Quality Auditing & Statistical Drift Monitoring", () => {
    it("computes Population Stability Index (PSI) accurately", () => {
      const baseline = [10, 12, 14, 15, 18, 20, 22, 25, 28, 30];
      const identical = [10, 12, 14, 15, 18, 20, 22, 25, 28, 30];
      const shifted = [50, 52, 54, 55, 58, 60, 62, 65, 68, 70];

      const psiIdentical = MultiSourceQualityMonitor.computePSI(baseline, identical);
      expect(psiIdentical).toBeLessThan(0.05);

      const psiShifted = MultiSourceQualityMonitor.computePSI(baseline, shifted);
      expect(psiShifted).toBeGreaterThan(0.25);
    });

    it("audits Fulton County empirical data quality", () => {
      const report = MultiSourceQualityMonitor.auditFultonQuality();
      expect(report.datasetId).toBe("FULTON_COUNTY_VENDOR_PAYMENTS");
      expect(report.provenance).toBe("VERIFIED_REAL");
      expect(report.totalRecords).toBe(10000);
      expect(report.missingnessRate).toBeLessThan(0.01);
      expect(report.qualityStatus).toBe("EXCELLENT");
      expect(report.schemaIntegrity.schemaCompliant).toBe(true);
    });

    it("audits BPI streaming empirical data quality", () => {
      const report = MultiSourceQualityMonitor.auditBPIQuality();
      expect(report.datasetId).toBe("BPI_CHALLENGE_2019_STREAM");
      expect(report.provenance).toBe("VERIFIED_REAL_STREAMING");
      expect(report.totalRecords).toBeGreaterThanOrEqual(2000);
      expect(report.missingnessRate).toBe(0);
      expect(report.qualityStatus).toBe("EXCELLENT");
    });

    it("evaluates feature drift across temporal splits", () => {
      const train = [[1, 2], [2, 3], [1, 2], [2, 3]];
      const test = [[1, 2], [2, 3], [1, 2], [2, 3]];
      const drift = MultiSourceQualityMonitor.evaluateModelDrift({
        modelId: "MODEL-FULTON-v2",
        datasetId: "FULTON_COUNTY",
        trainFeatures: train,
        testFeatures: test,
        featureNames: ["f1", "f2"]
      });

      expect(drift.driftStatus).toBe("STABLE");
      expect(drift.psiValue).toBeLessThan(0.10);
    });
  });
});
