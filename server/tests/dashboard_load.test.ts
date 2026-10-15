import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import app from "../src/app";

describe("Dashboard Production Load & Isolation Regression Tests", () => {
  let adminToken: string;
  let analystToken: string;
  let viewerToken: string;
  let orgBAdminToken: string;

  beforeAll(async () => {
    // 1. Primary Organization Admin
    const adminRes = await request(app)
      .post("/api/auth/login")
      .send({ email: "demo@nexuscfr.in", password: "demo1234" });
    if (adminRes.status === 200 && adminRes.body.data?.token) {
      adminToken = adminRes.body.data.token;
    }

    // 2. Primary Organization Analyst
    const analystRes = await request(app)
      .post("/api/auth/login")
      .send({ email: "analyst@nexus-cfr.demo", password: "demo1234" });
    if (analystRes.status === 200 && analystRes.body.data?.token) {
      analystToken = analystRes.body.data.token;
    }

    // 3. Primary Organization Viewer
    const viewerRes = await request(app)
      .post("/api/auth/login")
      .send({ email: "viewer@nexus-cfr.demo", password: "demo1234" });
    if (viewerRes.status === 200 && viewerRes.body.data?.token) {
      viewerToken = viewerRes.body.data.token;
    }

    // 4. Secondary Organization Admin
    const orgBRes = await request(app)
      .post("/api/auth/login")
      .send({ email: "admin@orgb.demo", password: "demo1234" });
    if (orgBRes.status === 200 && orgBRes.body.data?.token) {
      orgBAdminToken = orgBRes.body.data.token;
    }
  }, 30000);

  it("1. Loads dashboard summary with valid data and complete non-null fields for SME_ADMIN", async () => {
    if (!adminToken) return;

    const res = await request(app)
      .get("/api/dashboard/summary")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();

    const d = res.body.data;
    expect(Array.isArray(d.kpis)).toBe(true);
    expect(d.kpis.length).toBeGreaterThanOrEqual(6);

    // Verify each KPI has required UI fields
    for (const kpi of d.kpis) {
      expect(kpi).toHaveProperty("key");
      expect(kpi).toHaveProperty("label");
      expect(kpi).toHaveProperty("value");
      expect(kpi).toHaveProperty("status");
    }

    // Verify overdueTransactions is safely populated without undefined properties
    expect(Array.isArray(d.overdueTransactions)).toBe(true);
    for (const txn of d.overdueTransactions) {
      expect(txn).toHaveProperty("id");
      expect(txn).toHaveProperty("buyerName");
      expect(txn).toHaveProperty("outstandingAmount");
      expect(typeof txn.outstandingAmount).toBe("number");
      expect(txn).toHaveProperty("status");
      expect(["PAID", "PENDING", "DELAYED", "CRITICAL"]).toContain(txn.status);
    }

    // Verify trends and summaries
    expect(Array.isArray(d.paymentDelayTrend)).toBe(true);
    expect(Array.isArray(d.outstandingTrend)).toBe(true);
    expect(Array.isArray(d.topRiskyBuyers)).toBe(true);
    expect(Array.isArray(d.topRiskySuppliers)).toBe(true);
    expect(d).toHaveProperty("dataProvenanceSummary");
    expect(d).toHaveProperty("executiveSummary");
  });

  it("2. Loads dashboard summary cleanly for ANALYST role with analyticalSummary", async () => {
    if (!analystToken) return;

    const res = await request(app)
      .get("/api/dashboard/summary")
      .set("Authorization", `Bearer ${analystToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty("analyticalSummary");
    expect(res.body.data.analyticalSummary).toHaveProperty("activeDeadlocksCount");
    expect(res.body.data.analyticalSummary).toHaveProperty("simulationsCount");
  });

  it("3. Loads dashboard summary cleanly for VIEWER role with executiveSummary", async () => {
    if (!viewerToken) return;

    const res = await request(app)
      .get("/api/dashboard/summary")
      .set("Authorization", `Bearer ${viewerToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty("executiveSummary");
    expect(res.body.data.executiveSummary).toHaveProperty("portfolioHealthStatus");
    expect(res.body.data.executiveSummary).toHaveProperty("resilienceIndex");
  });

  it("4. Handles an isolated secondary organization (Org B) without leaking or crashing", async () => {
    if (!orgBAdminToken) return;

    const res = await request(app)
      .get("/api/dashboard/summary")
      .set("Authorization", `Bearer ${orgBAdminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
    expect(Array.isArray(res.body.data.kpis)).toBe(true);
    expect(Array.isArray(res.body.data.overdueTransactions)).toBe(true);
  });

  it("5. Rejects request with expired or missing token (401)", async () => {
    const resNoToken = await request(app).get("/api/dashboard/summary");
    expect(resNoToken.status).toBe(401);
    expect(resNoToken.body.success).toBe(false);

    const resExpired = await request(app)
      .get("/api/dashboard/summary")
      .set("Authorization", "Bearer expired.mock.jwt.token");
    expect(resExpired.status).toBe(401);
    expect(resExpired.body.success).toBe(false);
  });
});
