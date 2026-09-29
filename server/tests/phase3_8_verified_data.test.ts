import request from "supertest";
import { describe, expect, it, beforeAll } from "vitest";
import app from "../src/app";
import { prisma } from "../src/config/database";
import { ingestVerifiedB2BDataset } from "../src/pipeline/ingestRealData";

describe("NEXUS-CFR Phase 3.8 — Verified Real Data Acquisition & Research Audit Suite", () => {
  let orgRealAdminToken: string;
  let orgAAdminToken: string;

  beforeAll(async () => {
    const resReal = await request(app)
      .post("/api/auth/login")
      .send({ email: "realadmin@nexuscfr.in", password: "demo1234" });
    orgRealAdminToken = resReal.body.data.token;

    const resA = await request(app)
      .post("/api/auth/login")
      .send({ email: "demo@nexuscfr.in", password: "demo1234" });
    orgAAdminToken = resA.body.data.token;

    const count = await prisma.transaction.count({
      where: { organizationId: "ORG-003" },
    });
    if (count === 0) {
      await ingestVerifiedB2BDataset("ORG-003", "realadmin@nexuscfr.in");
    }
  });

  it("1. ML Gate explicitly states: 'ML BLOCKED — VERIFIED REAL DATA INSUFFICIENT'", async () => {
    const res = await request(app)
      .get("/api/governance/audit")
      .set("Authorization", `Bearer ${orgRealAdminToken}`);

    expect(res.status).toBe(200);
    const audit = res.body.data;
    expect(audit.mlGateStatus).toBe("LOCKED");
    expect(audit.mlGateSummary.status).toBe("LOCKED");
    expect(audit.mlGateSummary.verdict).toContain("ML BLOCKED — VERIFIED REAL DATA INSUFFICIENT");
    expect(audit.mlGateSummary.primaryBlocker).toContain("confidential proprietary assets");
    expect(audit.mlGateSummary.actionableRequirement).toContain("Do NOT train models on simulated or unverified data");
  });

  it("2. Four-Domain Architecture rigorously decouples Transaction, Survey, Administrative, and Reference domains", async () => {
    const res = await request(app)
      .get("/api/governance/audit")
      .set("Authorization", `Bearer ${orgRealAdminToken}`);

    const domains = res.body.data.fourDomainArchitecture;
    expect(domains).toBeDefined();
    expect(domains.length).toBe(4);

    const txDomain = domains.find((d: any) => d.domain === "TRANSACTION_DATA");
    expect(txDomain).toBeDefined();
    expect(txDomain.authenticityClassification).toBe("SIMULATED_BENCHMARK");
    expect(txDomain.joinRule).toContain("strictly prohibited");

    const surveyDomain = domains.find((d: any) => d.domain === "SURVEY_MICRODATA");
    expect(surveyDomain).toBeDefined();
    expect(surveyDomain.authenticityClassification).toBe("SURVEY_MICRODATA");
    expect(surveyDomain.joinRule).toContain("prohibited");

    const adminDomain = domains.find((d: any) => d.domain === "ADMINISTRATIVE_AGGREGATE");
    expect(adminDomain).toBeDefined();
    expect(adminDomain.authenticityClassification).toBe("ADMINISTRATIVE_AGGREGATE");

    const refDomain = domains.find((d: any) => d.domain === "EXTERNAL_REFERENCE");
    expect(refDomain).toBeDefined();
    expect(refDomain.authenticityClassification).toBe("EXTERNAL_REFERENCE");
  });

  it("3. Candidate Source Audits correctly classify synthetic and simulated public datasets without false upgrades", async () => {
    const res = await request(app)
      .get("/api/governance/audit")
      .set("Authorization", `Bearer ${orgRealAdminToken}`);

    const candidates = res.body.data.candidateSourceAudits;
    expect(candidates).toBeDefined();
    expect(candidates.length).toBeGreaterThanOrEqual(7);

    // IBM Watson must NOT be upgraded to REAL_OBSERVED
    const ibm = candidates.find((c: any) => c.id === "CAND-01");
    expect(ibm).toBeDefined();
    expect(ibm.authenticityClassification).toBe("SYNTHETIC");
    expect(ibm.integrationStatus).toBe("REJECTED_AS_SIMULATED");

    // HighRadius Internship must NOT be upgraded to REAL_OBSERVED
    const hr = candidates.find((c: any) => c.id === "CAND-02");
    expect(hr).toBeDefined();
    expect(hr.authenticityClassification).toBe("SIMULATED");
    expect(hr.integrationStatus).toBe("REJECTED_AS_SIMULATED");

    // UK DBT must be classified as ADMINISTRATIVE_AGGREGATE
    const ukDbt = candidates.find((c: any) => c.id === "CAND-04");
    expect(ukDbt).toBeDefined();
    expect(ukDbt.authenticityClassification).toBe("ADMINISTRATIVE_AGGREGATE");
    expect(ukDbt.integrationStatus).toBe("INTEGRATED_SEPARATE_DOMAIN");

    // MSME Samadhaan must be classified as ADMINISTRATIVE_AGGREGATE
    const samadhaan = candidates.find((c: any) => c.id === "CAND-05");
    expect(samadhaan).toBeDefined();
    expect(samadhaan.authenticityClassification).toBe("ADMINISTRATIVE_AGGREGATE");
    expect(samadhaan.integrationStatus).toBe("INTEGRATED_SEPARATE_DOMAIN");

    // WBES must be classified as SURVEY_MICRODATA with RESTRICTED_ACCESS
    const wbes = candidates.find((c: any) => c.id === "CAND-06");
    expect(wbes).toBeDefined();
    expect(wbes.authenticityClassification).toBe("SURVEY_MICRODATA");
    expect(wbes.integrationStatus).toBe("RESTRICTED_ACCESS");

    // Primary ERP / TReDS is documented as confidential and non-existent in public open domain
    const primary = candidates.find((c: any) => c.id === "CAND-07");
    expect(primary).toBeDefined();
    expect(primary.accessConditions).toContain("NON-EXISTENT IN OPEN PUBLIC DOMAIN");
  });

  it("4. Zero Fabrication Guarantee: No candidate is falsely tagged as REAL_OBSERVED in open repo", async () => {
    const res = await request(app)
      .get("/api/governance/audit")
      .set("Authorization", `Bearer ${orgRealAdminToken}`);

    const inventory = res.body.data.datasetInventory;
    for (const item of inventory) {
      if (item.id === "REF-MACRO-BENCHMARKS") {
        expect(item.authenticityClassification).toBe("ADMINISTRATIVE_AGGREGATE");
      } else {
        // The transaction benchmark ledger
        expect(item.authenticityClassification).toBe("SIMULATED_BENCHMARK");
      }
    }
  });

  it("5. Tenant Scoping: Governance audit preserves multi-tenant isolation", async () => {
    const resReal = await request(app)
      .get("/api/governance/audit")
      .set("Authorization", `Bearer ${orgRealAdminToken}`);

    const resA = await request(app)
      .get("/api/governance/audit")
      .set("Authorization", `Bearer ${orgAAdminToken}`);

    expect(resReal.body.data.tenant.organizationId).toBe("ORG-003");
    expect(resA.body.data.tenant.organizationId).toBe("ORG-001");
    expect(resReal.body.data.statisticalSufficiencyScorecard.totalTransactions).not.toBe(
      resA.body.data.statisticalSufficiencyScorecard.totalTransactions
    );
  });
});
