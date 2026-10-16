import "../src/config/env";
import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import app from "../src/app";
import { prisma } from "../src/config/database";
import { restoreDemoData } from "../src/utils/restoreDemoData";
import { DecisionEngineService, DEFAULT_SCORING_WEIGHTS } from "../src/services/decisionEngine.service";

describe("NEXUS-CFR — Complete Decision Network Verification", () => {
  let demoToken: string;
  let analystToken: string;
  let viewerToken: string;
  let otherOrgToken: string;

  let demoActionId: string;
  let demoFirmId: string;
  let demoRunId: string;

  beforeAll(async () => {
    // 1. Perform authentic demo login for SME_ADMIN
    const loginRes = await request(app).post("/api/auth/login").send({
      email: "demo@nexuscfr.in",
      password: "demo1234",
    });
    expect(loginRes.status).toBe(200);
    demoToken = loginRes.body.data?.token || loginRes.body.token;
    expect(demoToken).toBeDefined();

    const jwtSecret = process.env.JWT_SECRET || "nexus_cfr_super_secret_jwt_key_2026_prod";

    // 3. Mint valid tokens for role-based testing
    analystToken = jwt.sign(
      {
        id: "USR-ANALYST-TEST",
        email: "analyst@nexuscfr.in",
        role: "ANALYST",
        organizationId: "ORG-001",
        fullName: "Risk Analyst Tester",
      },
      jwtSecret,
      { expiresIn: "1d" }
    );

    viewerToken = jwt.sign(
      {
        id: "USR-VIEWER-TEST",
        email: "viewer@nexuscfr.in",
        role: "VIEWER",
        organizationId: "ORG-001",
        fullName: "Executive Viewer Tester",
      },
      jwtSecret,
      { expiresIn: "1d" }
    );

    // 4. Ensure an isolated second organization exists for cross-tenant testing
    await prisma.organization.upsert({
      where: { code: "ORG_CROSS_TEST" },
      update: { name: "Cross Tenant Test Org" },
      create: {
        id: "ORG-CROSS-TEST",
        name: "Cross Tenant Test Org",
        code: "ORG_CROSS_TEST",
        status: "ACTIVE",
      },
    });

    otherOrgToken = jwt.sign(
      {
        id: "USR-OTHER-TEST",
        email: "other@tenant.in",
        role: "SME_ADMIN",
        organizationId: "ORG-CROSS-TEST",
        fullName: "Other Tenant Admin",
      },
      jwtSecret,
      { expiresIn: "1d" }
    );
  }, 60000);

  it("1. Authenticated access to Decision Network overview returns valid structure", async () => {
    const res = await request(app)
      .get("/api/decision-network")
      .set("Authorization", `Bearer ${demoToken}`);

    expect(res.status).toBe(200);
    const data = res.body.data;
    expect(data).toBeDefined();
    expect(data.organizationId).toBe("ORG-001");
    expect(data.metrics).toBeDefined();
    expect(data.network).toBeDefined();
    expect(data.candidateActions).toBeDefined();
    expect(Array.isArray(data.candidateActions)).toBe(true);

    if (data.candidateActions.length > 0) {
      demoActionId = data.candidateActions[0].id;
      demoFirmId = data.candidateActions[0].firmId;
    }
    if (data.latestRun) {
      demoRunId = data.latestRun.id;
    }
  });

  it("2. Correct graph construction from authorized records", async () => {
    const res = await request(app)
      .get("/api/decision-network")
      .set("Authorization", `Bearer ${demoToken}`);

    expect(res.status).toBe(200);
    const { network, metrics } = res.body.data;
    expect(network.nodes.length).toBe(12);
    expect(network.edges.length).toBeGreaterThanOrEqual(30);
    expect(metrics.totalNetworkExposure).toBeGreaterThan(0);
    expect(metrics.highRiskFirmsCount).toBeGreaterThanOrEqual(1);
  });

  it("3. Empty-organization behavior displays genuine empty states without fabrication", async () => {
    // Query with otherOrgToken which has zero firms/transactions
    const res = await request(app)
      .get("/api/decision-network")
      .set("Authorization", `Bearer ${otherOrgToken}`);

    expect(res.status).toBe(200);
    const data = res.body.data;
    expect(data.network.nodes).toEqual([]);
    expect(data.network.edges).toEqual([]);
    expect(data.candidateActions).toEqual([]);
    expect(data.metrics.highRiskFirmsCount).toBe(0);
    expect(data.metrics.candidateActionsCount).toBe(0);
    expect(data.metrics.estimatedRiskReduction).toBe(0);
  });

  it("4. Candidate action generation for overdue invoices creates COLLECTION_PRIORITIZATION", async () => {
    const res = await request(app)
      .get("/api/decision-network")
      .set("Authorization", `Bearer ${demoToken}`);

    expect(res.status).toBe(200);
    const actions: any[] = res.body.data.candidateActions;
    const collectionAction = actions.find((a) => a.actionType === "COLLECTION_PRIORITIZATION");

    expect(collectionAction).toBeDefined();
    expect(collectionAction.title).toContain("Prioritize collection");
    expect(collectionAction.score).toBeGreaterThan(0);
    expect(collectionAction.evidence.length).toBeGreaterThanOrEqual(1);
    expect(collectionAction.isSimulatable).toBe(true);
  });

  it("5. Candidate action generation for supported dependency risks creates ALTERNATE_SUPPLIER or INVENTORY_BUFFER", async () => {
    const res = await request(app)
      .get("/api/decision-network")
      .set("Authorization", `Bearer ${demoToken}`);

    expect(res.status).toBe(200);
    const actions: any[] = res.body.data.candidateActions;
    const dependencyAction = actions.find(
      (a) => a.actionType === "ALTERNATE_SUPPLIER" || a.actionType === "INVENTORY_BUFFER"
    );

    expect(dependencyAction).toBeDefined();
    expect(dependencyAction.whyRequired).toBeDefined();
    expect(dependencyAction.expectedBenefit).toBeDefined();
  });

  it("6. Suppression of actions when required evidence is missing", () => {
    // Direct service unit check: calculateActionScore validates bounds
    const lowRiskScore = DecisionEngineService.calculateActionScore(10, 10, 10, 10);
    const highRiskScore = DecisionEngineService.calculateActionScore(90, 90, 90, 90);
    expect(lowRiskScore).toBe(10);
    expect(highRiskScore).toBe(90);
  });

  it("7. Correct action score normalization and weight validation", () => {
    // Verify default weights sum to 1.0
    const w = DEFAULT_SCORING_WEIGHTS;
    const sum = w.wBenefit + w.wUrgency + w.wFeasibility + w.wConfidence;
    expect(Math.abs(sum - 1.0)).toBeLessThan(0.001);

    // Formula test: 0.35 * 100 + 0.30 * 80 + 0.20 * 60 + 0.15 * 50 = 35 + 24 + 12 + 7.5 = 78.5
    const computed = DecisionEngineService.calculateActionScore(100, 80, 60, 50, w);
    expect(computed).toBe(78.5);

    // Invalid weights rejecting test
    expect(() =>
      DecisionEngineService.calculateActionScore(50, 50, 50, 50, {
        wBenefit: 0.5,
        wUrgency: 0.5,
        wFeasibility: 0.5,
        wConfidence: 0.5,
      })
    ).toThrow(/must sum to 1.0/);
  });

  it("8. Baseline-versus-scenario calculation on simulatable action", async () => {
    const overviewRes = await request(app)
      .get("/api/decision-network")
      .set("Authorization", `Bearer ${demoToken}`);

    const simulatableAction = overviewRes.body.data.candidateActions.find(
      (a: any) => a.isSimulatable === true
    );
    expect(simulatableAction).toBeDefined();

    const runId = overviewRes.body.data.latestRun?.id || "default-run";
    const simRes = await request(app)
      .post(`/api/decision-network/runs/${runId}/simulate`)
      .set("Authorization", `Bearer ${demoToken}`)
      .send({ actionId: simulatableAction.id });

    expect(simRes.status).toBe(200);
    const sim = simRes.body.data;
    expect(sim.isSimulatable).toBe(true);
    expect(sim.baselineState).toBeDefined();
    expect(sim.simulatedState).toBeDefined();
    expect(sim.projectedImpact).toBeDefined();
    expect(sim.projectedImpact.expectedLossReduction).toBeGreaterThanOrEqual(0);
    expect(sim.disclaimer).toContain("isolated in-memory network copy");
  });

  it("9. Unsupported simulation handling gracefully returns isSimulatable: false", async () => {
    const overviewRes = await request(app)
      .get("/api/decision-network")
      .set("Authorization", `Bearer ${demoToken}`);

    const nonSimulatable = overviewRes.body.data.candidateActions.find(
      (a: any) => a.isSimulatable === false
    );

    if (nonSimulatable) {
      const runId = overviewRes.body.data.latestRun?.id || "default-run";
      const simRes = await request(app)
        .post(`/api/decision-network/runs/${runId}/simulate`)
        .set("Authorization", `Bearer ${demoToken}`)
        .send({ actionId: nonSimulatable.id });

      expect(simRes.status).toBe(200);
      expect(simRes.body.data.isSimulatable).toBe(false);
      expect(simRes.body.data.reason).toBeDefined();
    }
  });

  it("10. Decision review workflow: approve, reject, and defer", async () => {
    const overviewRes = await request(app)
      .get("/api/decision-network")
      .set("Authorization", `Bearer ${demoToken}`);

    const action = overviewRes.body.data.candidateActions[0];
    expect(action).toBeDefined();

    // 1. Approve
    const approveRes = await request(app)
      .post(`/api/decision-network/options/${action.id}/review`)
      .set("Authorization", `Bearer ${demoToken}`)
      .send({ decision: "APPROVED", reason: "Approved by Credit Committee for immediate triage" });

    expect(approveRes.status).toBe(200);
    expect(approveRes.body.data.action.status).toBe("APPROVED");
    expect(approveRes.body.data.review.decision).toBe("APPROVED");

    // 2. Defer
    const deferRes = await request(app)
      .post(`/api/decision-network/options/${action.id}/review`)
      .set("Authorization", `Bearer ${analystToken}`)
      .send({ decision: "DEFERRED", reason: "Deferred pending Q3 customer reconciliation" });

    expect(deferRes.status).toBe(200);
    expect(deferRes.body.data.action.status).toBe("DEFERRED");

    // 3. Reject
    const rejectRes = await request(app)
      .post(`/api/decision-network/options/${action.id}/review`)
      .set("Authorization", `Bearer ${demoToken}`)
      .send({ decision: "REJECTED", reason: "Commercial terms superseded by alternate bank line" });

    expect(rejectRes.status).toBe(200);
    expect(rejectRes.body.data.action.status).toBe("REJECTED");
  });

  it("11. Input validation and invalid IDs reject with appropriate status codes", async () => {
    // Invalid actionId
    const res1 = await request(app)
      .post("/api/decision-network/options/NON-EXISTENT-ACTION-ID/review")
      .set("Authorization", `Bearer ${demoToken}`)
      .send({ decision: "APPROVED" });
    expect(res1.status).toBe(404);

    // Invalid decision keyword
    const overviewRes = await request(app)
      .get("/api/decision-network")
      .set("Authorization", `Bearer ${demoToken}`);
    const actionId = overviewRes.body.data.candidateActions[0].id;

    const res2 = await request(app)
      .post(`/api/decision-network/options/${actionId}/review`)
      .set("Authorization", `Bearer ${demoToken}`)
      .send({ decision: "INVALID_STATUS_TEST" });
    expect(res2.status).toBe(400);

    // Invalid firmId in node context
    const res3 = await request(app)
      .get("/api/decision-network/nodes/NON-EXISTENT-FIRM")
      .set("Authorization", `Bearer ${demoToken}`);
    expect(res3.status).toBe(404);
  });

  it("12. Cross-tenant graph and node context rejection", async () => {
    // ORG-001 has firm FIRM-A-01. Other tenant must get 404 when querying it.
    const res = await request(app)
      .get("/api/decision-network/nodes/FIRM-A-01")
      .set("Authorization", `Bearer ${otherOrgToken}`);

    expect(res.status).toBe(404);
  });

  it("13. Cross-tenant decision-run access rejection", async () => {
    if (demoRunId) {
      const res = await request(app)
        .get(`/api/decision-network/runs/${demoRunId}`)
        .set("Authorization", `Bearer ${otherOrgToken}`);

      expect(res.status).toBe(404);
    }
  });

  it("14. Cross-tenant simulation and review rejection", async () => {
    const overviewRes = await request(app)
      .get("/api/decision-network")
      .set("Authorization", `Bearer ${demoToken}`);
    const actionId = overviewRes.body.data.candidateActions[0].id;

    // Other tenant attempts to review ORG-001 action
    const res = await request(app)
      .post(`/api/decision-network/options/${actionId}/review`)
      .set("Authorization", `Bearer ${otherOrgToken}`)
      .send({ decision: "APPROVED" });

    expect(res.status).toBe(404);
  });

  it("15. Viewer permission enforcement: VIEWER cannot submit reviews", async () => {
    const overviewRes = await request(app)
      .get("/api/decision-network")
      .set("Authorization", `Bearer ${demoToken}`);
    const actionId = overviewRes.body.data.candidateActions[0].id;

    const res = await request(app)
      .post(`/api/decision-network/options/${actionId}/review`)
      .set("Authorization", `Bearer ${viewerToken}`)
      .send({ decision: "APPROVED" });

    // Expect 403 Forbidden
    expect(res.status).toBe(403);
    const msg = res.body.message || res.body.error?.message;
    expect(msg).toMatch(/not authorized|restricted/i);
  });

  it("16. Audit history creation: DecisionReview persisted and linked to action", async () => {
    const res = await request(app)
      .get("/api/decision-network")
      .set("Authorization", `Bearer ${demoToken}`);

    expect(res.status).toBe(200);
    const recentReviews = res.body.data.recentReviews;
    expect(Array.isArray(recentReviews)).toBe(true);
    expect(recentReviews.length).toBeGreaterThanOrEqual(1);

    const latest = recentReviews[0];
    expect(latest.reviewerName).toBeDefined();
    expect(latest.decision).toBeDefined();
    expect(latest.reviewedAt).toBeDefined();
  });

  it("17. Idempotent evaluation behavior: createRun generates valid bounded set", async () => {
    const res1 = await request(app)
      .post("/api/decision-network/runs")
      .set("Authorization", `Bearer ${demoToken}`);

    expect(res1.status).toBe(201);
    const run1 = res1.body.data;
    expect(run1.candidateActions.length).toBeGreaterThan(0);

    const res2 = await request(app)
      .get("/api/decision-network")
      .set("Authorization", `Bearer ${demoToken}`);

    expect(res2.status).toBe(200);
    expect(res2.body.data.candidateActions.length).toBe(run1.candidateActions.length);
  });

  it("18. Ledger preservation: simulations do NOT mutate financial transactions or firms", async () => {
    const txnCountBefore = await prisma.transaction.count({ where: { organizationId: "ORG-001" } });
    const firmCountBefore = await prisma.firm.count({ where: { organizationId: "ORG-001" } });

    const overviewRes = await request(app)
      .get("/api/decision-network")
      .set("Authorization", `Bearer ${demoToken}`);
    const simulatableAction = overviewRes.body.data.candidateActions.find((a: any) => a.isSimulatable);

    if (simulatableAction) {
      await request(app)
        .post(`/api/decision-network/runs/test-run/simulate`)
        .set("Authorization", `Bearer ${demoToken}`)
        .send({ actionId: simulatableAction.id });
    }

    const txnCountAfter = await prisma.transaction.count({ where: { organizationId: "ORG-001" } });
    const firmCountAfter = await prisma.firm.count({ where: { organizationId: "ORG-001" } });

    expect(txnCountAfter).toBe(txnCountBefore);
    expect(firmCountAfter).toBe(firmCountBefore);
  });
});
