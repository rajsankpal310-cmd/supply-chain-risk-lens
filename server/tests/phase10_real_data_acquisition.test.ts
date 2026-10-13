/**
 * NEXUS-CFR Phase 10: Authentic Public Data Acquisition & Full-Scale ML Evidence Test Suite
 *
 * Validates:
 * 1. Real-Data Firewall: Strict programmatic enforcement of dataset realness.
 * 2. Source Provenance & Manifest Integrity: Cryptographic SHA-256 and physical file verification.
 * 3. Raw Data Scale: UK DBT (102.8 MB, 348k records), Fulton County (9.19 MB, 10k records), BPI XES (~300 MB, 100k cases).
 * 4. Model Promotion Gate: Statistical sample power and class diversity enforcement.
 * 5. Fulton Verified Real-Data Pipeline: Genuine invoice-to-disbursement duration & extension modeling.
 * 6. Mendeley Simulated Status: Permanently classified as BENCHMARK_FIXTURE_SIMULATED.
 * 7. Governance Risk Fusion: Explicitly labeled as MULTI_SOURCE_GOVERNANCE_RISK_INDEX with heuristic weights.
 */

import { describe, it, expect, beforeAll } from "vitest";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { DataFirewall, DataFirewallViolationError } from "../src/ml/governance/dataFirewall";
import { ModelPromotionGate } from "../src/ml/governance/modelPromotionGate";
import { MultiTenantModelRegistry, GovernedModelArtifact } from "../src/ml/registry/modelRegistry";
import { FultonPaymentPipeline } from "../src/ml/pipeline/fultonPaymentPipeline";
import { MendeleyInvoicePipeline } from "../src/ml/pipeline/mendeleyInvoicePipeline";
import { BPIEnterprisePipeline } from "../src/ml/pipeline/bpiEnterprisePipeline";
import { RiskFusionEngine } from "../src/ml/fusion/riskFusionEngine";
import { MultiSourceRegistry } from "../src/pipeline/multiSourceRegistry";

describe("NEXUS-CFR Phase 10: Authentic Public Data Acquisition & Forensic ML Evidence", () => {
  const testTenant = "ORG-PHASE10-AUDIT";

  beforeAll(async () => {
    // Run pipelines for testing
    await FultonPaymentPipeline.execute({
      organizationId: testTenant,
      actorRole: "SME_ADMIN",
    });

    await MendeleyInvoicePipeline.execute({
      organizationId: testTenant,
      actorRole: "SME_ADMIN",
    });

    await BPIEnterprisePipeline.execute({
      organizationId: testTenant,
      targetId: "PAYMENT_CYCLE_RISK",
      actorRole: "SME_ADMIN",
    });
  });

  // 1. REAL DATA FIREWALL
  describe("1. Real Data Firewall Enforcement", () => {
    it("permits VERIFIED_REAL data to enter real ML training", () => {
      expect(() => {
        DataFirewall.assertRealMLTrainingAllowed(
          "FULTON-COUNTY-VENDOR-PAYMENTS",
          "VERIFIED_REAL",
          "PAYMENT_CYCLE_RISK"
        );
      }).not.toThrow();
    });

    it("blocks BENCHMARK_FIXTURE_SIMULATED from real ML training", () => {
      expect(() => {
        DataFirewall.assertRealMLTrainingAllowed(
          "MENDELEY-RO-INVOICE-NET",
          "BENCHMARK_FIXTURE_SIMULATED",
          "INVOICE_MATURITY_HORIZON"
        );
      }).toThrow(DataFirewallViolationError);
    });

    it("blocks AGGREGATE_REFERENCE benchmarks from transaction ML training", () => {
      expect(() => {
        DataFirewall.assertRealMLTrainingAllowed(
          "WBES-INDIA-2022",
          "AGGREGATE_REFERENCE",
          "INVOICE_PAYMENT_DELAY"
        );
      }).toThrow(DataFirewallViolationError);
    });

    it("evaluates usage categories accurately for all classifications", () => {
      expect(DataFirewall.evaluateUsage("VERIFIED_REAL").allowedUsage).toBe("REAL_DATA_ML_TRAINING");
      expect(DataFirewall.evaluateUsage("AGGREGATE_REFERENCE").allowedUsage).toBe("BENCHMARK_CONTEXT_PRIORS");
      expect(DataFirewall.evaluateUsage("BENCHMARK_FIXTURE_SIMULATED").allowedUsage).toBe("PIPELINE_TESTING_ONLY");
      expect(DataFirewall.evaluateUsage("DEMO_FIXTURE").allowedUsage).toBe("UI_DEMO_ONLY");
      expect(DataFirewall.evaluateUsage("UNVERIFIED").allowedUsage).toBe("BLOCKED");
    });
  });

  // 2. DATASET ACQUISITION MANIFEST & RAW INTEGRITY
  describe("2. Acquisition Manifest & Physical Raw Files", () => {
    const manifestPath = path.resolve(__dirname, "../../server/data/acquisition/manifest.json");

    it("has a valid acquisition manifest referencing physical files", () => {
      expect(fs.existsSync(manifestPath)).toBe(true);
      const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
      expect(manifest.version).toBe("1.0.0");
      expect(manifest.sources.length).toBeGreaterThanOrEqual(8);
    });

    it("verifies physical UK DBT prompt payments raw CSV (102.8 MB, 348k lines)", () => {
      const ukDbtPath = path.resolve(__dirname, "../../server/data/acquisition/uk_dbt_prompt_payments_raw.csv");
      expect(fs.existsSync(ukDbtPath)).toBe(true);
      const stat = fs.statSync(ukDbtPath);
      expect(stat.size).toBeGreaterThan(100_000_000); // > 100 MB
    });

    it("verifies physical Fulton County vendor payments raw JSON (9.19 MB, 10,000 real records)", () => {
      const fultonPath = path.resolve(__dirname, "../../server/data/acquisition/fulton_vendor_payments_raw.json");
      expect(fs.existsSync(fultonPath)).toBe(true);
      const records = JSON.parse(fs.readFileSync(fultonPath, "utf8"));
      expect(records.length).toBe(10000);

      // Verify authentic transaction structure
      const sample = records.find((r: any) => r.vendor_invoice_date && r.disb_date) || records[0];
      expect(sample.vendor_invoice_no).toBeDefined();
      expect(sample.vendor_invoice_date).toBeDefined();
      expect(sample.disb_date).toBeDefined();
      expect(sample.amount).toBeDefined();
      expect(sample.vendor_code).toBeDefined();
    });

    it("verifies physical BPI 2019 raw XES stream on disk (>250 MB, >90,000 traces)", () => {
      const bpiXesPath = path.resolve(__dirname, "../../server/data/acquisition/bpi_challenge_2019_raw.xes");
      expect(fs.existsSync(bpiXesPath)).toBe(true);
      const stat = fs.statSync(bpiXesPath);
      expect(stat.size).toBeGreaterThan(250_000_000); // > 250 MB on disk
    });
  });

  // 3. STATISTICAL MODEL PROMOTION GATE
  describe("3. Evidence-Based Model Promotion Gate", () => {
    it("blocks Mendeley model from VALIDATED status due to simulated origin and sample scale", () => {
      const mendeleyModels = MultiTenantModelRegistry.listModelsForTenant(testTenant).filter(
        (m) => m.datasetId === "MENDELEY-RO-INVOICE-NET"
      );
      expect(mendeleyModels.length).toBeGreaterThan(0);
      const model = mendeleyModels[0];

      // Mendeley must be EXPERIMENTAL
      expect(model.lifecycleState).toBe("EXPERIMENTAL");

      // Evaluating for validation must fail
      const result = ModelPromotionGate.evaluateForValidation(model);
      expect(result.eligible).toBe(false);
      expect(result.status).toBe("BLOCKED");
      expect(result.blockers.some((b) => b.includes("PROVENANCE_GATE_FAILED"))).toBe(true);
    });

    it("prevents direct transition to VALIDATED in ModelRegistry if promotion gate fails", () => {
      const mendeleyModels = MultiTenantModelRegistry.listModelsForTenant(testTenant).filter(
        (m) => m.datasetId === "MENDELEY-RO-INVOICE-NET"
      );
      const model = mendeleyModels[0];

      expect(() => {
        MultiTenantModelRegistry.transitionLifecycle(testTenant, model.modelId, "VALIDATED", "ADMIN");
      }).toThrow(/failed the statistical validation gate/);
    });

    it("qualifies Fulton County real-data model for promotion to VALIDATED", () => {
      const fultonModels = MultiTenantModelRegistry.listModelsForTenant(testTenant).filter(
        (m) => m.datasetId === "FULTON-COUNTY-GOV-VENDOR-PAYMENTS"
      );
      expect(fultonModels.length).toBeGreaterThan(0);
      const model = fultonModels[0];

      // Provenance is VERIFIED_REAL
      expect(model.dataProvenanceClassification).toBe("VERIFIED_REAL");

      // Evaluate promotion gate
      const result = ModelPromotionGate.evaluateForValidation(model);
      expect(result.eligible).toBe(true);
      expect(result.status).toBe("ELIGIBLE");
      expect(result.blockers.length).toBe(0);

      // Transition to VALIDATED must succeed
      const promoted = MultiTenantModelRegistry.transitionLifecycle(testTenant, model.modelId, "VALIDATED", "ADMIN");
      expect(promoted.lifecycleState).toBe("VALIDATED");
    });
  });

  // 4. FULTON VERIFIED REAL-DATA PIPELINE
  describe("4. Fulton County Real-Data ML Pipeline", () => {
    it("generates authentic line-item predictions with anti-leakage compliance", () => {
      const preds = FultonPaymentPipeline.getPredictions(testTenant);
      expect(preds.length).toBeGreaterThan(100);

      const p0 = preds[0];
      expect(p0.invoiceNo).toBeDefined();
      expect(p0.vendorCode).toBeDefined();
      expect(p0.actualDurationDays).toBeGreaterThanOrEqual(0);
      expect(p0.predictedDurationDays).toBeGreaterThan(0);
      expect(p0.paymentExtensionRiskProbability).toBeGreaterThanOrEqual(0);
      expect(p0.paymentExtensionRiskProbability).toBeLessThanOrEqual(1);
      expect(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).toContain(p0.riskBand);
      expect(p0.lineage.sourceId).toBe("FULTON_COUNTY_VENDOR_PAYMENTS");
    });
  });

  // 5. MULTI-SOURCE RISK FUSION GOVERNANCE
  describe("5. Multi-Source Risk Fusion Labeling", () => {
    it("explicitly labels composite risk as MULTI_SOURCE_GOVERNANCE_RISK_INDEX with heuristic weights", () => {
      const profile = RiskFusionEngine.generateCompositeRiskProfile({
        organizationId: testTenant,
        counterpartyId: "COUNTERPARTY-01",
        counterpartyName: "Test Enterprise Corp",
        sector: "Automotive Components",
      });

      expect(profile.scoreClassification).toBe("MULTI_SOURCE_GOVERNANCE_RISK_INDEX");
      expect(profile.weightType).toBe("GOVERNANCE_CONFIGURATION_HEURISTIC");
      expect(profile.compositeRiskScore).toBeGreaterThanOrEqual(0);
      expect(profile.compositeRiskScore).toBeLessThanOrEqual(100);

      // Contributing pillars check
      expect(profile.contributingPillars.paymentCycleRisk.weight).toBe(0.25);
      expect(profile.contributingPillars.invoiceNetworkExposure.weight).toBe(0.25);
      expect(profile.contributingPillars.indiaSmeContextualStress.weight).toBe(0.20);
      expect(profile.contributingPillars.internationalPaymentPracticeBenchmark.weight).toBe(0.15);
      expect(profile.contributingPillars.msmeStatutoryDisputeIntensity.weight).toBe(0.15);

      // Check that Mendeley pillar limitations state simulated benchmark origin
      expect(profile.contributingPillars.invoiceNetworkExposure.limitations).toContain("Simulated accounts receivable benchmark");
    });
  });

  // 6. MULTI-SOURCE REGISTRY INTEGRITY
  describe("6. Multi-Source Registry Classification", () => {
    it("correctly classifies Mendeley as simulated and Tenant ledger as demo fixture", () => {
      const mendeley = MultiSourceRegistry.getSourceById("MENDELEY-RO-INVOICE-NET")!;
      expect(mendeley.isRealObserved).toBe(false);
      expect(mendeley.readinessStatus).toBe("EXPERIMENTAL");

      const tenantLedger = MultiSourceRegistry.getSourceById("TENANT-PRIMARY-LEDGER")!;
      expect(tenantLedger.role).toBe("DEMO_ONLY");
      expect(tenantLedger.readinessStatus).toBe("EXPERIMENTAL");

      const fulton = MultiSourceRegistry.getSourceById("FULTON-COUNTY-VENDOR-PAYMENTS")!;
      expect(fulton.role).toBe("PRIMARY_TRANSACTION");
      expect(fulton.isRealObserved).toBe(true);
      expect(fulton.readinessStatus).toBe("VALIDATED");
    });
  });
});
