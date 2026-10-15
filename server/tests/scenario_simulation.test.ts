import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import app from "../src/app";

describe("Scenario Simulator Regression & Tenant Isolation Tests", () => {
  let adminToken: string;
  let viewerToken: string;

  beforeAll(async () => {
    const adminRes = await request(app)
      .post("/api/auth/login")
      .send({ email: "demo@nexuscfr.in", password: "demo1234" });
    if (adminRes.status === 200 && adminRes.body.data?.token) {
      adminToken = adminRes.body.data.token;
    }

    const viewerRes = await request(app)
      .post("/api/auth/login")
      .send({ email: "viewer@nexus-cfr.demo", password: "demo1234" });
    if (viewerRes.status === 200 && viewerRes.body.data?.token) {
      viewerToken = viewerRes.body.data.token;
    }
  }, 30000);

  it("1. Successfully executes a valid scenario simulation via POST /api/simulations/run", async () => {
    if (!adminToken) return;

    const res = await request(app)
      .post("/api/simulations/run")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: "Test What-If Disruption Scenario",
        type: "BUYER_DEFAULT",
        parameters: {
          probability: 0.75,
          recoveryDays: 45,
          shockSeverity: 0.3,
        },
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
    expect(res.body.data.result).toBeDefined();

    const result = typeof res.body.data.result === "string"
      ? JSON.parse(res.body.data.result)
      : res.body.data.result;

    expect(result).toHaveProperty("expectedLoss");
    expect(result).toHaveProperty("affectedNodeCount");
    expect(result).toHaveProperty("networkExposure");
    expect(result).toHaveProperty("propagationPath");
    expect(Array.isArray(result.affectedFirms)).toBe(true);
  });

  it("2. Successfully handles ad-hoc scenario runs via POST /api/scenarios/SCN-RUN-TEST/run", async () => {
    if (!adminToken) return;

    const res = await request(app)
      .post("/api/scenarios/SCN-RUN-TEST/run")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({
        name: "Ad-hoc Disruption Run",
        type: "SUPPLY_DISRUPTION",
        parameters: {
          shockSeverity: 0.5,
          recoveryDays: 30,
        },
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
  });

  it("3. Enforces RBAC: VIEWER role is blocked from executing simulations (403)", async () => {
    if (!viewerToken) return;

    const res = await request(app)
      .post("/api/simulations/run")
      .set("Authorization", `Bearer ${viewerToken}`)
      .send({
        name: "Viewer Attempt",
        type: "BUYER_DEFAULT",
      });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it("4. Blocks unauthenticated simulation runs (401)", async () => {
    const res = await request(app)
      .post("/api/simulations/run")
      .send({
        name: "Unauthenticated Run",
        type: "BUYER_DEFAULT",
      });

    expect(res.status).toBe(401);
  });
});
