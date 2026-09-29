import request from "supertest";
import { describe, expect, it, beforeAll } from "vitest";
import app from "../src/app";
import { prisma } from "../src/config/database";
import { ingestVerifiedB2BDataset } from "../src/pipeline/ingestRealData";

describe("NEXUS-CFR Phase 3.7 — Data Foundation & ML Readiness Audit Suite", () => {
  let orgAAdminToken: string;
  let orgBAdminToken: string;
  let orgRealAdminToken: string;

  beforeAll(async () => {
    // Authenticate users
    const resA = await request(app)
      .post("/api/auth/login")
      .send({ email: "demo@nexuscfr.in", password: "demo1234" });
    orgAAdminToken = resA.body.data.token;

    const resB = await request(app)
      .post("/api/auth/login")
      .send({ email: "admin@orgb.demo", password: "demo1234" });
    orgBAdminToken = resB.body.data.token;

    const resReal = await request(app)
      .post("/api/auth/login")
      .send({ email: "realadmin@nexuscfr.in", password: "demo1234" });
    orgRealAdminToken = resReal.body.data.token;

    // Ensure ORG-003 has the benchmark dataset ingested
    const count = await prisma.transaction.count({
      where: { organizationId: "ORG-003" },
    });
    if (count === 0) {
      await ingestVerifiedB2BDataset("ORG-003", "realadmin@nexuscfr.in");
    }
  });

  it("1. GET /api/governance/audit requires authentication (returns 401 when unauthorized)", async () => {
    const res = await request(app).get("/api/governance/audit");
    expect(res.status).toBe(401);
  });

  it("2. GET /api/governance/audit returns locked ML gate with rigorous statistical insufficiency explanation", async () => {
    const res = await request(app)
      .get("/api/governance/audit")
      .set("Authorization", `Bearer ${orgRealAdminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const audit = res.body.data;

    expect(audit.mlGateStatus).toBe("LOCKED");
    expect(audit.mlGateSummary.verdict).toContain("STATISTICALLY CONSTRAINED");
    expect(audit.mlGateSummary.primaryBlocker).toContain("below minimum thresholds");
    expect(audit.mlGateSummary.actionableRequirement).toContain("N >= 1,000");

    const scorecard = audit.statisticalSufficiencyScorecard;
    expect(scorecard.totalTransactions).toBe(50);
    expect(scorecard.distinctSMEs).toBe(8);
    expect(scorecard.distinctBuyers).toBe(8);
    expect(scorecard.thresholds.isSampleSufficient).toBe(false);
    expect(scorecard.thresholds.isBuyerDiversitySufficient).toBe(false);
  });

  it("3. Target variable audit correctly analyzes right-censoring on open invoices", async () => {
    const res = await request(app)
      .get("/api/governance/audit")
      .set("Authorization", `Bearer ${orgRealAdminToken}`);

    const audit = res.body.data;
    const delayTarget = audit.targetVariableAudits.find((t: any) => t.name === "paymentDelayDays");
    expect(delayTarget).toBeDefined();
    expect(delayTarget.availableObservations).toBe(30);
    expect(delayTarget.rightCensoredObservations).toBe(20);
    expect(delayTarget.rightCensoringRatePercent).toBe(40);
    expect(delayTarget.naiveImputationRisk).toContain("FATAL");

    const defaultTarget = audit.targetVariableAudits.find((t: any) => t.name === "isDefault");
    expect(defaultTarget).toBeDefined();
    expect(defaultTarget.formula).toContain("daysPastDue > 90");
  });

  it("4. Feature eligibility matrix flags future payment attributes as fatal leakage risks", async () => {
    const res = await request(app)
      .get("/api/governance/audit")
      .set("Authorization", `Bearer ${orgRealAdminToken}`);

    const features = res.body.data.featureEligibilityMatrix;
    expect(features.length).toBeGreaterThanOrEqual(8);

    const paymentDateFeature = features.find((f: any) => f.fieldName === "paymentDate");
    expect(paymentDateFeature).toBeDefined();
    expect(paymentDateFeature.predictionPointAvailability).toBe("POST_ISSUANCE_ONLY");
    expect(paymentDateFeature.eligibilityStatus).toBe("FORBIDDEN_LEAKAGE");
    expect(paymentDateFeature.leakageRiskLevel).toBe("FATAL");

    const invoiceAmountFeature = features.find((f: any) => f.fieldName === "invoiceAmount");
    expect(invoiceAmountFeature).toBeDefined();
    expect(invoiceAmountFeature.predictionPointAvailability).toBe("AVAILABLE_AT_T0");
    expect(invoiceAmountFeature.eligibilityStatus).toBe("ELIGIBLE");
    expect(invoiceAmountFeature.leakageRiskLevel).toBe("NONE");
  });

  it("5. Dataset inventory explicitly classifies simulated benchmark vs administrative aggregates", async () => {
    const res = await request(app)
      .get("/api/governance/audit")
      .set("Authorization", `Bearer ${orgRealAdminToken}`);

    const inventory = res.body.data.datasetInventory;
    expect(inventory.length).toBeGreaterThanOrEqual(2);

    const benchItem = inventory.find((i: any) => i.id !== "REF-MACRO-BENCHMARKS");
    expect(benchItem).toBeDefined();
    expect(benchItem.authenticityClassification).toBe("SIMULATED_BENCHMARK");
    expect(benchItem.sourceUrl).toBe("UNKNOWN / NOT_PUBLISHED");

    const macroItem = inventory.find((i: any) => i.id === "REF-MACRO-BENCHMARKS");
    expect(macroItem).toBeDefined();
    expect(macroItem.authenticityClassification).toBe("ADMINISTRATIVE_AGGREGATE");
    expect(macroItem.sourceUrl).toContain("samadhaan.msme.gov.in");
  });

  it("6. Multi-tenant isolation: Governance audits are scoped to authenticated organization", async () => {
    const resReal = await request(app)
      .get("/api/governance/audit")
      .set("Authorization", `Bearer ${orgRealAdminToken}`);
    expect(resReal.body.data.tenant.organizationId).toBe("ORG-003");
    expect(resReal.body.data.statisticalSufficiencyScorecard.totalTransactions).toBe(50);

    const resA = await request(app)
      .get("/api/governance/audit")
      .set("Authorization", `Bearer ${orgAAdminToken}`);
    expect(resA.body.data.tenant.organizationId).toBe("ORG-001");
    // ORG-001 has its own separate transactions
    expect(resA.body.data.statisticalSufficiencyScorecard.totalTransactions).toBeGreaterThanOrEqual(120);

    const resB = await request(app)
      .get("/api/governance/audit")
      .set("Authorization", `Bearer ${orgBAdminToken}`);
    expect(resB.body.data.tenant.organizationId).toBe("ORG-002");
    expect(resB.body.data.statisticalSufficiencyScorecard.totalTransactions).toBe(80);
  });
});
