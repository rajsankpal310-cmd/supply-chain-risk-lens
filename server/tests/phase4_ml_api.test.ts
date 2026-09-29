import request from "supertest";
import { describe, expect, it, beforeAll } from "vitest";
import app from "../src/app";

describe("NEXUS-CFR Phase 4 — Governed ML REST API & Readiness Endpoints", () => {
  let adminToken: string;
  let viewerToken: string;

  beforeAll(async () => {
    const resAdmin = await request(app)
      .post("/api/auth/login")
      .send({ email: "realadmin@nexuscfr.in", password: "demo1234" });
    adminToken = resAdmin.body.data.token;

    const resViewer = await request(app)
      .post("/api/auth/login")
      .send({ email: "viewer@nexus-cfr.demo", password: "demo1234" });
    viewerToken = resViewer.body.data.token;
  });

  it("1. GET /api/ml/targets returns formal registered prediction targets", async () => {
    const res = await request(app)
      .get("/api/ml/targets")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.targets.length).toBeGreaterThanOrEqual(4);

    const delayTarget = res.body.targets.find((t: any) => t.targetId === "PAYMENT_DELAY_RISK");
    expect(delayTarget).toBeDefined();
    expect(delayTarget.problemType).toBe("BINARY_CLASSIFICATION");
    expect(delayTarget.minimumDataRequirements.minimumSampleObservations).toBe(1000);
  });

  it("2. GET /api/ml/features returns feature definitions with anti-leakage classifications", async () => {
    const res = await request(app)
      .get("/api/ml/features")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const features = res.body.features;
    const paymentDateFeat = features.find((f: any) => f.featureName === "paymentDate");
    expect(paymentDateFeat.eligibility).toBe("POST_OUTCOME_FORBIDDEN");

    const invoiceAmtFeat = features.find((f: any) => f.featureName === "invoiceAmount");
    expect(invoiceAmtFeat.eligibility).toBe("SAFE_PRE_PREDICTION");
  });

  it("3. GET /api/ml/readiness returns 20-point scorecard locking simulated ORG-003 dataset", async () => {
    const res = await request(app)
      .get("/api/ml/readiness")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const report = res.body.report;

    expect(report.overallStatus).toBe("LOCKED");
    expect(report.checks.length).toBe(20);
    expect(report.blockerCount).toBeGreaterThan(0);
    expect(report.summary).toContain("ML TRAINING LOCKED");

    // Check specific 20-point checklist entries
    const provenanceCheck = report.checks.find((c: any) => c.checkId === "CHECK_01_PROVENANCE_VALIDITY");
    expect(provenanceCheck.status).toBe("BLOCKED");

    const sampleCheck = report.checks.find((c: any) => c.checkId === "CHECK_06_SAMPLE_SCALE");
    expect(sampleCheck.status).toBe("BLOCKED");

    const leakageCheck = report.checks.find((c: any) => c.checkId === "CHECK_15_LEAKAGE_SCAN");
    expect(leakageCheck.status).toBe("PASS"); // Our feature set is leakage-free
  });

  it("4. POST /api/ml/pipeline/run without real data strictly aborts with LOCKED status", async () => {
    const res = await request(app)
      .post("/api/ml/pipeline/run")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ targetId: "PAYMENT_DELAY_RISK", forceSimulatedSmokeTest: false });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.result.status).toBe("LOCKED");
    expect(res.body.result.message).toContain("ML TRAINING LOCKED");
    expect(res.body.result.modelArtifact).toBeUndefined(); // Zero fake models created
  });

  it("5. POST /api/ml/pipeline/run rejects execution by VIEWER role (403 Forbidden)", async () => {
    const res = await request(app)
      .post("/api/ml/pipeline/run")
      .set("Authorization", `Bearer ${viewerToken}`)
      .send({ targetId: "PAYMENT_DELAY_RISK" });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it("6. POST /api/ml/pipeline/run with explicit forceSimulatedSmokeTest executes and labels artifact NON-PRODUCTION", async () => {
    const res = await request(app)
      .post("/api/ml/pipeline/run")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ targetId: "PAYMENT_DELAY_RISK", forceSimulatedSmokeTest: true });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const result = res.body.result;

    expect(result.status).toBe("COMPLETED_EXPERIMENTAL");
    expect(result.isSimulatedBenchmark).toBe(true);
    expect(result.message).toContain("SMOKE TEST COMPLETE (SIMULATED BENCHMARK / NON-PRODUCTION)");

    const model = result.modelArtifact;
    expect(model).toBeDefined();
    expect(model.lifecycleState).toBe("EXPERIMENTAL");
    expect(model.version).toBe("1.0-SIMULATED-SMOKE-TEST");
    expect(model.checksum).toHaveLength(64);
  });

  it("7. GET /api/ml/models and GET /api/ml/models/:id return registered artifacts", async () => {
    const resList = await request(app)
      .get("/api/ml/models")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(resList.status).toBe(200);
    expect(resList.body.models.length).toBeGreaterThanOrEqual(1);

    const modelId = resList.body.models[0].modelId;
    const resDetail = await request(app)
      .get(`/api/ml/models/${modelId}`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(resDetail.status).toBe(200);
    expect(resDetail.body.model.modelId).toBe(modelId);
    expect(resDetail.body.model.globalImportance.length).toBeGreaterThan(0);
  });

  it("8. POST /api/ml/models/:id/transition enforces approval lifecycle governance", async () => {
    const resList = await request(app)
      .get("/api/ml/models")
      .set("Authorization", `Bearer ${adminToken}`);

    const modelId = resList.body.models[0].modelId;

    // Approve model as Admin
    const resApprove = await request(app)
      .post(`/api/ml/models/${modelId}/transition`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ newState: "APPROVED", notes: "Approved for testing." });

    expect(resApprove.status).toBe(200);
    expect(resApprove.body.model.lifecycleState).toBe("APPROVED");

    // Deploy model as Admin
    const resDeploy = await request(app)
      .post(`/api/ml/models/${modelId}/transition`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ newState: "DEPLOYED" });

    expect(resDeploy.status).toBe(200);
    expect(resDeploy.body.model.lifecycleState).toBe("DEPLOYED");
    expect(resDeploy.body.model.isProductionDeployed).toBe(true);
  });

  it("9. GET /api/ml/risk-bands returns audited threshold policies", async () => {
    const res = await request(app)
      .get("/api/ml/risk-bands")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.policies.length).toBeGreaterThanOrEqual(2);
    expect(res.body.policies[0].thresholds).toBeDefined();
    expect(res.body.policies[0].isProvisional).toBe(true);
  });

  it("10. GET /api/ml/monitoring returns distribution and drift metrics for deployed model", async () => {
    const res = await request(app)
      .get("/api/ml/monitoring")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.monitoringReport).toBeDefined();
    expect(res.body.monitoringReport.featureDriftSummary.overallStatus).toBeDefined();
  });
});
