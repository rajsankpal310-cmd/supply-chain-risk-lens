import "../src/config/env";
import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import app from "../src/app";
import { prisma } from "../src/config/database";
import { restoreDemoData } from "../src/utils/restoreDemoData";

describe("NEXUS-CFR — Demo Dataset & Complete Dashboard Verification", () => {
  let demoToken: string;
  let demoUser: any;

  beforeAll(async () => {
    // 1. Restore the canonical demo dataset for ORG-001
    const restoreResult = await restoreDemoData(prisma, "ORG-001");
    expect(restoreResult.transactionsCount).toBe(120);
    expect(restoreResult.firmsCount).toBe(12);

    // 2. Perform authentic demo login
    const loginRes = await request(app).post("/api/auth/login").send({
      email: "demo@nexuscfr.in",
      password: "demo1234",
    });

    expect(loginRes.status).toBe(200);
    const authData = loginRes.body.data || loginRes.body;
    demoToken = authData.token;
    demoUser = authData.user;

    expect(demoToken).toBeDefined();
    expect(demoUser.email).toBe("demo@nexuscfr.in");
    expect(demoUser.organizationId).toBe("ORG-001");
  }, 45000);

  it("1. Demo login resolves to ORG-001 and returns valid authenticated session", () => {
    expect(demoUser).toBeDefined();
    expect(demoUser.role).toBe("SME_ADMIN");
    expect(demoUser.organizationId).toBe("ORG-001");
  });

  it("2. Complete Dashboard KPI suite contains genuine metrics without 'Not enough data'", async () => {
    const res = await request(app)
      .get("/api/dashboard/summary")
      .set("Authorization", `Bearer ${demoToken}`);

    expect(res.status).toBe(200);
    const summary = res.body.data;
    expect(summary).toBeDefined();

    const kpis: any[] = summary.kpis;
    expect(kpis).toBeDefined();
    expect(kpis.length).toBeGreaterThanOrEqual(6);

    const overallKpi = kpis.find((k) => k.key === "overall");
    const delayKpi = kpis.find((k) => k.key === "delay");
    const stressKpi = kpis.find((k) => k.key === "stress");
    const firmsKpi = kpis.find((k) => k.key === "firms");
    const cascadeKpi = kpis.find((k) => k.key === "cascade");
    const outstandingKpi = kpis.find((k) => k.key === "outstanding");

    expect(overallKpi).toBeDefined();
    expect(overallKpi.value).not.toBe("Not enough data");
    expect(overallKpi.value).toMatch(/\d+\s*\/\s*100/);

    expect(delayKpi).toBeDefined();
    expect(delayKpi.value).not.toBe("Not enough data");
    expect(delayKpi.value).toMatch(/\d+%/);

    expect(stressKpi).toBeDefined();
    expect(stressKpi.value).not.toBe("Not enough data");
    expect(stressKpi.value).toMatch(/\d+%/);

    expect(firmsKpi).toBeDefined();
    expect(firmsKpi.value).not.toBe("Not enough data");
    expect(Number(firmsKpi.value)).toBeGreaterThanOrEqual(1);

    expect(cascadeKpi).toBeDefined();
    expect(cascadeKpi.value).not.toBe("Not enough data");
    expect(cascadeKpi.value).toMatch(/\d+%/);

    expect(outstandingKpi).toBeDefined();
    expect(outstandingKpi.value).not.toBe("Not enough data");
    expect(outstandingKpi.value).toMatch(/₹/);

    // Verify monthly trends
    expect(summary.paymentDelayTrend).toBeDefined();
    expect(summary.paymentDelayTrend.length).toBeGreaterThan(0);
    expect(summary.outstandingTrend).toBeDefined();
    expect(summary.outstandingTrend.length).toBeGreaterThan(0);

    // Verify risk distribution and counterparties
    expect(summary.riskDistribution.length).toBe(4);
    expect(summary.topRiskyBuyers.length).toBeGreaterThan(0);
  });

  it("3. Dashboard alias endpoint /api/dashboard/metrics returns consistent payload", async () => {
    const res = await request(app)
      .get("/api/dashboard/metrics")
      .set("Authorization", `Bearer ${demoToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.kpis).toBeDefined();
  });

  it("4. Transactions module loads 120 populated demo records with counterparties and statuses", async () => {
    const res = await request(app)
      .get("/api/transactions?pageSize=150")
      .set("Authorization", `Bearer ${demoToken}`);

    expect(res.status).toBe(200);
    const txns = res.body.data.items || res.body.data;
    expect(Array.isArray(txns)).toBe(true);
    expect(txns.length).toBe(120);
    expect(res.body.pagination?.total).toBe(120);

    const firstTxn = txns[0];
    expect(firstTxn.invoiceAmount).toBeGreaterThan(0);
    expect(firstTxn.paymentStatus).toBeDefined();
    expect(firstTxn.dueDate).toBeDefined();
    expect(firstTxn.organizationId).toBe("ORG-001");
  });

  it("5. Supply Chain Graph loads multiple firms, company names, and directed relationships", async () => {
    const res = await request(app)
      .get("/api/network/graph")
      .set("Authorization", `Bearer ${demoToken}`);

    expect(res.status).toBe(200);
    const graph = res.body.data;
    expect(graph.nodes.length).toBe(12);
    expect(graph.edges.length).toBeGreaterThanOrEqual(20);

    // Check company name resolution
    const sampleNode = graph.nodes.find((n: any) => n.name === "Sundaram Auto Components");
    expect(sampleNode).toBeDefined();
    expect(sampleNode.industry).toBe("Auto Components");
  });

  it("6. Payment-Risk predictions module returns ML evaluations with contributing factors", async () => {
    const res = await request(app)
      .get("/api/predictions")
      .set("Authorization", `Bearer ${demoToken}`);

    expect(res.status).toBe(200);
    const preds = res.body.data.items || res.body.data;
    expect(Array.isArray(preds)).toBe(true);
    expect(preds.length).toBeGreaterThanOrEqual(5);

    const firstPred = preds[0];
    expect(firstPred.probability).toBeGreaterThan(0);
    expect(firstPred.confidence).toBeGreaterThan(50);
  });

  it("7. Cascade simulation scenario and execution results exist for demo network", async () => {
    const res = await request(app)
      .get("/api/scenarios")
      .set("Authorization", `Bearer ${demoToken}`);

    expect(res.status).toBe(200);
    const scenarios = res.body.data.items || res.body.data;
    expect(Array.isArray(scenarios)).toBe(true);
    expect(scenarios.length).toBeGreaterThanOrEqual(1);

    const demoScn = scenarios.find((s: any) => s.id === "SCN-ORG_A-001");
    expect(demoScn).toBeDefined();
  });

  it("8. Recommendations module displays actionable financial resilience recommendations", async () => {
    const res = await request(app)
      .get("/api/recommendations")
      .set("Authorization", `Bearer ${demoToken}`);

    expect(res.status).toBe(200);
    const recs = res.body.data.items || res.body.data;
    expect(Array.isArray(recs)).toBe(true);
    expect(recs.length).toBeGreaterThanOrEqual(4);

    const firstRec = recs[0];
    expect(firstRec.title).toBeDefined();
    expect(firstRec.priority).toBeDefined();
  });

  it("9. Alerts module contains active operational alerts for demo organization", async () => {
    const res = await request(app)
      .get("/api/alerts")
      .set("Authorization", `Bearer ${demoToken}`);

    expect(res.status).toBe(200);
    const alerts = res.body.data.items || res.body.data;
    expect(Array.isArray(alerts)).toBe(true);
    expect(alerts.length).toBeGreaterThanOrEqual(3);
  });

  it("10. Deadlocks module identifies circular payment dependency chain", async () => {
    const res = await request(app)
      .get("/api/deadlocks")
      .set("Authorization", `Bearer ${demoToken}`);

    expect(res.status).toBe(200);
    const deadlocks = res.body.data.items || res.body.data;
    expect(Array.isArray(deadlocks)).toBe(true);
    expect(deadlocks.length).toBeGreaterThanOrEqual(1);

    const dlk = deadlocks[0];
    expect(dlk.deadlockRisk).toBeGreaterThan(50);
    expect(dlk.totalExposure).toBeGreaterThan(0);
  });

  it("11. Reports module lists ready analytical reports for demo organization", async () => {
    const res = await request(app)
      .get("/api/reports")
      .set("Authorization", `Bearer ${demoToken}`);

    expect(res.status).toBe(200);
    const reports = res.body.data.items || res.body.data;
    expect(Array.isArray(reports)).toBe(true);
    expect(reports.length).toBeGreaterThanOrEqual(4);
    expect(reports.every((r: any) => r.status === "READY")).toBe(true);
  });

  it("12. Idempotency: Running restoreDemoData twice does not duplicate records", async () => {
    // Second execution
    const secondResult = await restoreDemoData(prisma, "ORG-001");
    expect(secondResult.transactionsCount).toBe(120);
    expect(secondResult.firmsCount).toBe(12);

    const [txnCount, firmCount, relCount] = await Promise.all([
      prisma.transaction.count({ where: { organizationId: "ORG-001" } }),
      prisma.firm.count({ where: { organizationId: "ORG-001" } }),
      prisma.relationship.count({ where: { organizationId: "ORG-001" } }),
    ]);

    expect(txnCount).toBe(120);
    expect(firmCount).toBe(12);
    expect(relCount).toBe(secondResult.relationshipsCount);
  });

  it("13. Tenant Isolation: Newly created empty organization displays genuine empty state without demo data leakage", async () => {
    const isolatedOrg = await prisma.organization.create({
      data: {
        code: `ORG_EMPTY_${Date.now()}`,
        name: "Clean Empty Tenant Co",
        status: "ACTIVE",
      },
    });

    const isolatedUser = await prisma.user.create({
      data: {
        email: `clean_user_${Date.now()}@emptycorp.in`,
        fullName: "Clean Auditor",
        passwordHash: "$2a$10$mpDmOJi1NBWYi6Am5ehBrukWDSwVaMfYgKb6YB0nZevAjWoS8fS.W",
        companyName: "Clean Empty Tenant Co",
        industry: "Retail",
        companySize: "1-10",
        role: "SME_ADMIN",
        organizationId: isolatedOrg.id,
      },
    });

    const loginRes = await request(app).post("/api/auth/login").send({
      email: isolatedUser.email,
      password: "demo1234",
    });

    const isolatedToken = loginRes.body.data.token;

    const res = await request(app)
      .get("/api/dashboard/summary")
      .set("Authorization", `Bearer ${isolatedToken}`);

    expect(res.status).toBe(200);
    const kpis: any[] = res.body.data.kpis;

    // In a genuinely empty organization, delay & outstanding should show "Not enough data"
    const delayKpi = kpis.find((k) => k.key === "delay");
    const outstandingKpi = kpis.find((k) => k.key === "outstanding");
    expect(delayKpi.value).toBe("Not enough data");
    expect(outstandingKpi.value).toBe("Not enough data");

    // Clean up test org
    await prisma.user.delete({ where: { id: isolatedUser.id } });
    await prisma.organization.delete({ where: { id: isolatedOrg.id } });
  });
});
