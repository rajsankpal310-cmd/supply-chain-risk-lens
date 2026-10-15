import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import app from "../src/app";
import { prisma } from "../src/config/database";

describe("NEXUS-CFR Full QA Regression Validation Suite", () => {
  let orgAToken: string;
  let orgBToken: string;

  beforeAll(async () => {
    // 1. Authenticate ORG_A SME_ADMIN
    const resA = await request(app)
      .post("/api/auth/login")
      .send({ email: "demo@nexuscfr.in", password: "demo1234" });
    expect(resA.status).toBe(200);
    orgAToken = resA.body.data.token;

    // 2. Authenticate ORG_B SME_ADMIN
    const resB = await request(app)
      .post("/api/auth/login")
      .send({ email: "admin@orgb.demo", password: "demo1234" });
    expect(resB.status).toBe(200);
    orgBToken = resB.body.data.token;
  }, 20000);

  // 1. Graph Endpoints & Company Identity Verification
  it("1. Network Graph endpoints (/api/network and /api/network/graph) return sanitized, valid company names for all nodes", async () => {
    for (const path of ["/api/network", "/api/network/graph"]) {
      const res = await request(app)
        .get(path)
        .set("Authorization", `Bearer ${orgAToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.nodes)).toBe(true);
      expect(Array.isArray(res.body.data.edges)).toBe(true);

      for (const node of res.body.data.nodes) {
        expect(node.id).toBeDefined();
        expect(typeof node.name).toBe("string");
        expect(node.name.trim().length).toBeGreaterThan(0);
        expect(node.name).not.toBe("undefined");
        expect(node.name).not.toBe("null");
        expect(node.name).not.toBe("[object Object]");
        expect(node.riskLevel).toMatch(/^(LOW|MEDIUM|HIGH|CRITICAL)$/);
        expect(typeof node.riskScore).toBe("number");
        expect(typeof node.exposure).toBe("number");
      }
    }
  });

  // 2. Scenario Simulation IDOR & Cross-Tenant Boundary
  it("2. IDOR Prevention: ORG_B is blocked with 404 when attempting to execute simulation on ORG_A scenario", async () => {
    const res = await request(app)
      .post("/api/scenarios/SCN-ORG_A-001/run")
      .set("Authorization", `Bearer ${orgBToken}`)
      .send({ affectedFirmId: "FIRM-A-01", delayDays: 45 });

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it("3. IDOR Prevention: Simulation with cross-tenant affectedFirmId is rejected with 404", async () => {
    const res = await request(app)
      .post("/api/simulations/run")
      .set("Authorization", `Bearer ${orgBToken}`)
      .send({ affectedFirmId: "FIRM-A-01", delayDays: 45, severity: "HIGH" });

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  // 3. Provenance Version Preservation on Import
  it("4. Provenance Fidelity: preserves user-specified datasetVersion and does not overwrite it with raw fingerprint hash", async () => {
    const testVersion = "v4.2-QA-VERIFIED";
    const rawRows = [
      {
        transaction_id: `TXN-QA-PROV-${Date.now()}`,
        sme_id: "FIRM-A-01",
        buyer_id: "FIRM-A-02",
        invoice_amount: 350000,
        invoice_date: "2026-06-01",
        due_date: "2026-07-01",
        payment_status: "PENDING",
        outstanding_amount: 350000,
      },
    ];

    const res = await request(app)
      .post("/api/upload/import")
      .set("Authorization", `Bearer ${orgAToken}`)
      .send({
        rows: rawRows,
        sourceType: "PUBLIC_DATASET",
        sourceName: "QA Provenance Regression Test",
        datasetVersion: testVersion,
        license: "MIT-TEST",
      });

    expect(res.status).toBe(201);
    const batchId = res.body.data.batchId;
    expect(batchId).toBeDefined();

    const batch = await prisma.importBatch.findUnique({
      where: { id: batchId },
    });
    expect(batch).toBeDefined();
    expect(batch?.datasetVersion).toBe(testVersion);

    // Clean up test batch and transactions
    await prisma.transaction.deleteMany({
      where: { batchId },
    });
    await prisma.importBatch.delete({
      where: { id: batchId },
    });
  });

  // 4. Multi-Tenant Dashboard Metric Correctness
  it("5. Dashboard metrics for ORG_A and ORG_B are completely isolated and free from NaN/null errors", async () => {
    const [resA, resB] = await Promise.all([
      request(app).get("/api/dashboard/summary").set("Authorization", `Bearer ${orgAToken}`),
      request(app).get("/api/dashboard/summary").set("Authorization", `Bearer ${orgBToken}`),
    ]);

    expect(resA.status).toBe(200);
    expect(resB.status).toBe(200);

    const execA = resA.body.data.executiveSummary;
    const execB = resB.body.data.executiveSummary;

    expect(execA).toBeDefined();
    expect(execB).toBeDefined();

    // Verify no NaN or Infinity in either summary
    for (const kpi of [...resA.body.data.kpis, ...resB.body.data.kpis]) {
      expect(kpi.value).not.toContain("NaN");
      expect(kpi.value).not.toContain("Infinity");
      expect(kpi.rawValue).not.toBeNaN();
    }

    // Verify overdue transactions belong exclusively to tenant
    for (const t of resA.body.data.overdueTransactions) {
      expect(t.smeId.startsWith("FIRM-A")).toBe(true);
    }
    for (const t of resB.body.data.overdueTransactions) {
      expect(t.smeId.startsWith("FIRM-B")).toBe(true);
    }
  });
});
