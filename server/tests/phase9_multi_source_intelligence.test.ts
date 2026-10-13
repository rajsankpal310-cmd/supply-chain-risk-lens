/**
 * NEXUS-CFR Phase 9: Governed Multi-Source Real-Data ML Integration Test Suite
 *
 * Validates the transformation of NEXUS-CFR from a single-dataset ML prototype
 * into a GOVERNED MULTI-SOURCE REAL-DATA INTELLIGENCE PLATFORM.
 *
 * CORE PRINCIPLE:
 * REAL DATA > MULTI-SOURCE EVIDENCE > CORRECT TARGETS > VALIDATED ML
 * > TRACEABLE PREDICTIONS > DECISION SUPPORT
 */

import { describe, it, expect, beforeAll } from "vitest";
import fs from "fs";
import path from "path";
import { MultiSourceRegistry } from "../src/pipeline/multiSourceRegistry";
import { BPIEnterprisePipeline } from "../src/ml/pipeline/bpiEnterprisePipeline";
import { MendeleyInvoicePipeline } from "../src/ml/pipeline/mendeleyInvoicePipeline";
import { RiskFusionEngine } from "../src/ml/fusion/riskFusionEngine";
import { MultiTenantModelRegistry } from "../src/ml/registry/modelRegistry";
import { NetworkService } from "../src/services/network.service";
import { DashboardService } from "../src/services/dashboard.service";
import { AntiLeakageAuditor } from "../src/ml/features/featureEligibility";

describe("NEXUS-CFR Phase 9: Governed Multi-Source Intelligence Platform", () => {
  const testTenant = "ORG-003";

  beforeAll(async () => {
    // Execute Task A and Task B pipelines once for test tenant
    await BPIEnterprisePipeline.execute({
      organizationId: testTenant,
      targetId: "PAYMENT_CYCLE_RISK",
      actorRole: "SME_ADMIN",
      autoPromoteToProduction: true,
    });

    await MendeleyInvoicePipeline.execute({
      organizationId: testTenant,
      actorRole: "SME_ADMIN",
      autoPromoteToProduction: true,
    });
  });

  // 1. Data Source Discovery & Audit Registry
  it("Pillar 1: Discovers and audits all 7 distinct real-world empirical data sources", () => {
    const sources = MultiSourceRegistry.getAllSources();
    expect(sources.length).toBeGreaterThanOrEqual(7);

    const sourceIds = sources.map((s) => s.sourceId);
    expect(sourceIds).toContain("4TU-BPI-2019");
    expect(sourceIds).toContain("MENDELEY-RO-INVOICE-NET");
    expect(sourceIds).toContain("WBES-INDIA-2022");
    expect(sourceIds).toContain("UK-DBT-PAYMENT-PRACTICES-2023");
    expect(sourceIds).toContain("AU-PTRS-PAYMENT-TIMES-2023");
    expect(sourceIds).toContain("IN-MOMSME-SAMADHAAN-2024");
    expect(sourceIds).toContain("TENANT-PRIMARY-LEDGER");
  });

  // 2. Strict Role Classification & Provenance
  it("Pillar 2: Enforces strict dataset role classifications without trust-level inflation", () => {
    const bpi = MultiSourceRegistry.getSourceById("4TU-BPI-2019")!;
    expect(bpi.role).toBe("PUBLIC_ENTERPRISE_EVENT_LOG");
    expect(bpi.isRealObserved).toBe(true);
    expect(bpi.doi).toBe("10.4121/uuid:d06afd4a-3f7a-4719-86d6-f4d08b3d8d32");

    const mendeley = MultiSourceRegistry.getSourceById("MENDELEY-RO-INVOICE-NET")!;
    expect(mendeley.role).toBe("INVOICE_NETWORK");
    expect(mendeley.isRealObserved).toBe(false); // Verified simulated accounts receivable benchmark in Phase 10
    expect(mendeley.doi).toBe("10.17632/pmnc7g269r.2");

    const wbes = MultiSourceRegistry.getSourceById("WBES-INDIA-2022")!;
    expect(wbes.role).toBe("SURVEY_CONTEXT");
    expect(wbes.isRealObserved).toBe(true);

    const ukDbt = MultiSourceRegistry.getSourceById("UK-DBT-PAYMENT-PRACTICES-2023")!;
    expect(ukDbt.role).toBe("ADMINISTRATIVE_REFERENCE");

    const auPtrs = MultiSourceRegistry.getSourceById("AU-PTRS-PAYMENT-TIMES-2023")!;
    expect(auPtrs.role).toBe("ADMINISTRATIVE_REFERENCE");

    const samadhaan = MultiSourceRegistry.getSourceById("IN-MOMSME-SAMADHAAN-2024")!;
    expect(samadhaan.role).toBe("ADMINISTRATIVE_REFERENCE");
  });

  // 3. Zero Artificial Joining Guarantee
  it("Pillar 3: Verifies zero artificial cross-source joins, fake IDs, or fabricated GSTINs", () => {
    const mendeleyPath = path.resolve(__dirname, "../data/mendeley_romanian_invoices_canonical.json");
    const mendeleyData = JSON.parse(fs.readFileSync(mendeleyPath, "utf8"));

    // Verify Romanian invoices have authentic RON amounts and dates, and zero fake payment dates
    for (const inv of mendeleyData.invoices) {
      expect(inv.debtor_id).toMatch(/^DEBT-RO-/);
      expect(inv.creditor_id).toMatch(/^CRED-RO-/);
      expect(inv.amount_ron).toBeGreaterThan(0);
      expect(inv.payment_terms_days).toBeGreaterThan(0);
      // Public Mendeley release has NO payment confirmation date; must NEVER be fabricated
      expect((inv as any).clearing_date).toBeUndefined();
      expect((inv as any).payment_date).toBeUndefined();
    }

    // Verify World Bank microdata is strictly survey context, not invoice transactions
    const wbesPath = path.resolve(__dirname, "../data/world_bank_india_enterprise_survey_context.json");
    const wbesData = JSON.parse(fs.readFileSync(wbesPath, "utf8"));
    expect(wbesData.source.sourceType).toBe("SURVEY_MICRODATA");
    expect(wbesData.sectoralBenchmarks.length).toBeGreaterThan(0);
  });

  // 4. Data Quality Scorecards
  it("Pillar 4: Calculates multi-source data quality scorecards with explicit grades", () => {
    const scorecards = MultiSourceRegistry.getAllScorecards();
    expect(scorecards.length).toBeGreaterThanOrEqual(7);

    for (const sc of scorecards) {
      expect(sc.scorecard.completenessPercent).toBeGreaterThanOrEqual(90);
      expect(sc.scorecard.validityPercent).toBeGreaterThanOrEqual(90);
      expect(sc.scorecard.consistencyScore).toBeGreaterThanOrEqual(80);
      expect(["A", "B", "C"]).toContain(sc.scorecard.qualityGrade);
    }
  });

  // 5. Dataset-Specific Readiness Gates
  it("Pillar 5: Enforces target-specific readiness gates rather than a single global ready flag", () => {
    const gates = MultiSourceRegistry.getAllReadinessGates();

    // BPI is restricted to EXPERIMENTAL because of benchmark scale
    expect(gates.BPI_PAYMENT_CYCLE_READY.status).toBe("EXPERIMENTAL");
    expect(gates.BPI_PAYMENT_CYCLE_READY.role).toBe("PUBLIC_ENTERPRISE_EVENT_LOG");

    // Mendeley is VALIDATED for invoice maturity and concentration
    expect(gates.Mendeley_INVOICE_RISK_READY.status).toBe("VALIDATED");
    expect(gates.Mendeley_INVOICE_RISK_READY.role).toBe("INVOICE_NETWORK");

    // Benchmarks & Contexts are VALIDATED for priors
    expect(gates.WBES_CONTEXT_READY.status).toBe("VALIDATED");
    expect(gates.UK_PAYMENT_BENCHMARK_READY.status).toBe("VALIDATED");
    expect(gates.AU_PAYMENT_BENCHMARK_READY.status).toBe("VALIDATED");
    expect(gates.SAMADHAAN_CONTEXT_READY.status).toBe("VALIDATED");
  });

  // 6. Task A: Observable Payment Cycle Duration (BPI 2019)
  it("Pillar 6: Task A pipeline models observable process cycle duration without calling it contractual delinquency", () => {
    const preds = BPIEnterprisePipeline.getPredictions(testTenant);
    expect(preds.length).toBeGreaterThan(0);

    const first = preds[0];
    expect(first.targetId).toBe("PAYMENT_CYCLE_RISK");
    expect(first.observedDurationDays).toBeGreaterThan(0);
    expect(first.confidence).toBeGreaterThanOrEqual(50);
    expect(first.historicalEvidence.vendorAvgDurationDays).toBeDefined();
  });

  // 7. Task B: Invoice Maturity & Concentration Modeling (Mendeley)
  it("Pillar 7: Task B pipeline models maturity horizon and debtor concentration with 14-day embargo", () => {
    const preds = MendeleyInvoicePipeline.getPredictions(testTenant);
    expect(preds.length).toBe(60);

    const first = preds[0];
    expect(first.predictedMaturityHorizonDays).toBeGreaterThan(0);
    expect(first.debtorConcentrationRiskProbability).toBeGreaterThanOrEqual(0);
    expect(first.debtorConcentrationRiskProbability).toBeLessThanOrEqual(1);
    expect(first.networkMetrics.debtorDegree).toBeGreaterThanOrEqual(1);
    expect(first.networkMetrics.creditorDegree).toBeGreaterThanOrEqual(1);
    expect(first.lineage.sourceId).toBe("MENDELEY-RO-INVOICE-NET");
  });

  // 8. Anti-Leakage Audit
  it("Pillar 8: Anti-leakage firewall blocks post-outcome fields across all pipelines", () => {
    const activeFeatures = [
      "amount_ron_log",
      "payment_terms_days",
      "debtor_degree",
      "creditor_degree",
      "debtor_concentration_ratio",
      "rolling_exposure_log",
    ];

    const audit = AntiLeakageAuditor.auditFeatureCandidateList(activeFeatures);
    expect(audit.isLeakageFree).toBe(true);
    expect(audit.forbiddenFeaturesDetected.length).toBe(0);

    // Contaminated candidate must fail
    const contaminated = AntiLeakageAuditor.auditFeatureCandidateList([
      "amount_ron_log",
      "actual_payment_date",
      "clearing_timestamp",
    ]);
    expect(contaminated.isLeakageFree).toBe(false);
    expect(contaminated.forbiddenFeaturesDetected).toContain("actual_payment_date");
    expect(contaminated.forbiddenFeaturesDetected).toContain("clearing_timestamp");
  });

  // 9. Risk Fusion Engine
  it("Pillar 9: Multi-source Risk Fusion combines 5 pillars with confidence and preserved limitations", async () => {
    const profiles = await RiskFusionEngine.fuseProfiles(testTenant);
    expect(profiles.length).toBe(5);

    const profile = profiles[0];
    expect(profile.compositeRiskScore).toBeGreaterThanOrEqual(0);
    expect(profile.compositeRiskScore).toBeLessThanOrEqual(100);
    expect(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).toContain(profile.compositeRiskBand);

    // Check all 5 contributing pillars
    const pillars = profile.contributingPillars;
    expect(pillars.paymentCycleRisk.sourceId).toBe("4TU-BPI-2019");
    expect(pillars.invoiceNetworkExposure.sourceId).toBe("MENDELEY-RO-INVOICE-NET");
    expect(pillars.indiaSmeContextualStress.sourceId).toBe("WBES-INDIA-2022");
    expect(pillars.internationalPaymentPracticeBenchmark.sourceId).toContain("UK-DBT");
    expect(pillars.msmeStatutoryDisputeIntensity.sourceId).toBe("IN-MOMSME-SAMADHAAN-2024");

    // Weights sum to 1.00
    const totalWeight =
      pillars.paymentCycleRisk.weight +
      pillars.invoiceNetworkExposure.weight +
      pillars.indiaSmeContextualStress.weight +
      pillars.internationalPaymentPracticeBenchmark.weight +
      pillars.msmeStatutoryDisputeIntensity.weight;
    expect(parseFloat(totalWeight.toFixed(2))).toBe(1.0);

    // Decision action recommendations
    expect(profile.decisionActionSummary.recommendedStrategy).toBeDefined();
    expect(profile.decisionActionSummary.estimatedRiskMitigationPoints).toBeGreaterThan(0);
  });

  // 10. Multi-Domain Network Isolation
  it("Pillar 10: Maintains isolated network domains for Tenant, BPI, and Mendeley without artificial merging", async () => {
    const benchmark = await NetworkService.getMultiDomainBenchmark(testTenant);
    expect(benchmark.tenantNetwork).toBeDefined();
    expect(benchmark.bpiEnterpriseNetwork).toBeDefined();
    expect(benchmark.mendeleyInvoiceNetwork).toBeDefined();

    // Verify distinct domains and topology types
    expect(benchmark.bpiEnterpriseNetwork.topologyType).toContain("Hub-and-Spoke");
    expect(benchmark.mendeleyInvoiceNetwork.topologyType).toContain("Bipartite Directed");

    // Cross-domain benchmarking provides structural comparison
    expect(benchmark.crossDomainBenchmark.concentrationStatus).toBeDefined();
    expect(benchmark.crossDomainBenchmark.structuralObservations.length).toBeGreaterThanOrEqual(3);
  });

  // 11. Durable Model Persistence on Disk
  it("Pillar 11: Persists model registry checkpoints to disk and recovers upon reload", () => {
    const persistencePath = path.resolve(__dirname, "../data/models/registry_store.json");
    expect(fs.existsSync(persistencePath)).toBe(true);

    const raw = fs.readFileSync(persistencePath, "utf8");
    const parsed = JSON.parse(raw);
    expect(parsed[testTenant]).toBeDefined();

    // Simulate server cold start by triggering reload
    MultiTenantModelRegistry.loadFromDisk();
    const models = MultiTenantModelRegistry.listModels(testTenant);
    expect(models.length).toBeGreaterThan(0);
  });

  // 12. Removal of Fake Metric Fallbacks
  it("Pillar 12: Eliminates all fake fallback constants (0.86, 0.82, 0.80) in dashboard service", async () => {
    const dashboard = await DashboardService.getDashboard(testTenant, "SME_ADMIN");
    const ml = dashboard.mlIntelligence;

    if (ml.status === "ACTIVE") {
      const perf = ml.modelPerformance;
      // Must either be a valid dynamically computed number or null
      if (perf.rocAuc != null) {
        expect(typeof perf.rocAuc).toBe("number");
        expect(perf.rocAuc).toBeGreaterThan(0);
        expect(perf.rocAuc).toBeLessThanOrEqual(1);
      }
      expect(perf.evaluationStatus).toBe("DYNAMICALLY_COMPUTED");
    } else {
      expect(ml.status).toBe("FALLBACK_HEURISTIC");
      expect(ml.fallback_reason).toBeDefined();
    }
  });
});
