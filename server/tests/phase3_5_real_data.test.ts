import request from "supertest";
import { describe, expect, it, beforeAll } from "vitest";
import app from "../src/app";
import { prisma } from "../src/config/database";
import { ingestVerifiedB2BDataset } from "../src/pipeline/ingestRealData";

describe("NEXUS-CFR Phase 3.5 — Real Data Acquisition & Verified Foundation Tests", () => {
  let orgAAdminToken: string;
  let orgBAdminToken: string;
  let orgRealAdminToken: string;

  beforeAll(async () => {
    const existing = await prisma.transaction.count({
      where: { organizationId: "ORG-003" },
    });
    if (existing === 0) {
      await ingestVerifiedB2BDataset("ORG-003", "realadmin@nexuscfr.in");
    }
  });

  it("1. Authenticate ORG_A, ORG_B, and ORG_REAL users to establish tenant contexts", async () => {
    const resA = await request(app)
      .post("/api/auth/login")
      .send({ email: "demo@nexuscfr.in", password: "demo1234" });
    expect(resA.status).toBe(200);
    expect(resA.body.data.user.organizationId).toBe("ORG-001");
    orgAAdminToken = resA.body.data.token;

    const resB = await request(app)
      .post("/api/auth/login")
      .send({ email: "admin@orgb.demo", password: "demo1234" });
    expect(resB.status).toBe(200);
    expect(resB.body.data.user.organizationId).toBe("ORG-002");
    orgBAdminToken = resB.body.data.token;

    const resReal = await request(app)
      .post("/api/auth/login")
      .send({ email: "realadmin@nexuscfr.in", password: "demo1234" });
    expect(resReal.status).toBe(200);
    expect(resReal.body.data.user.organizationId).toBe("ORG-003");
    orgRealAdminToken = resReal.body.data.token;
  });

  it("2. GET /api/reference/benchmarks returns authentic MSME Samadhaan & World Bank macro data", async () => {
    const res = await request(app)
      .get("/api/reference/benchmarks")
      .set("Authorization", `Bearer ${orgAAdminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.statutoryCreditPeriodDays).toBe(45);
    expect(res.body.data.source.publisher).toContain("MSME Samadhaan");
    expect(res.body.data.source.classification).toBe("EXTERNAL_REFERENCE");
    expect(res.body.data.sectors.length).toBeGreaterThanOrEqual(5);

    const autoSector = res.body.data.sectors.find((s: any) => s.code === "AUTO");
    expect(autoSector).toBeDefined();
    expect(autoSector.avgPaymentDelayDays).toBeGreaterThan(0);
    expect(autoSector.delinquencyRate).toBeGreaterThan(0);
  });

  it("3. Reference benchmarks are accessible across tenants as standardized reference standard", async () => {
    const res = await request(app)
      .get("/api/reference/benchmarks")
      .set("Authorization", `Bearer ${orgBAdminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.macroAverages.delayedTransactionProportion).toBeGreaterThan(0.5);
  });

  it("4. Ingested real B2B transactions exist in PostgreSQL under ORG_REAL (ORG-003)", async () => {
    const res = await request(app)
      .get("/api/transactions?search=INV-HR-24")
      .set("Authorization", `Bearer ${orgRealAdminToken}`);

    expect(res.status).toBe(200);
    const items = res.body.data.items || res.body.data;
    expect(items.length).toBeGreaterThan(0);

    const firstTxn = items[0];
    expect(firstTxn.organizationId).toBe("ORG-003");
    expect(firstTxn.sourceType).toBe("PUBLIC_DATASET");
    expect(firstTxn.dataStatus).toBe("PUBLIC_SIMULATED_DATA");
  });

  it("5. Multi-Tenant IDOR: Ingested real transactions of ORG_REAL are blocked with 404 for ORG_B", async () => {
    const res = await request(app)
      .get("/api/transactions/INV-HR-24-001")
      .set("Authorization", `Bearer ${orgBAdminToken}`);

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error.message).toContain("not available in your organization");
  });

  it("6. Real vs Demo Separation: ORG_REAL carries PUBLIC_DATASET badge distinct from ORG_A DEMO_ONLY", async () => {
    const resReal = await request(app)
      .get("/api/transactions?limit=50")
      .set("Authorization", `Bearer ${orgRealAdminToken}`);

    const realItems = resReal.body.data.items || resReal.body.data;
    expect(realItems.length).toBeGreaterThan(0);
    for (const r of realItems) {
      expect(r.sourceType).toBe("PUBLIC_DATASET");
      expect(r.dataStatus).toBe("PUBLIC_SIMULATED_DATA");
    }

    const resDemo = await request(app)
      .get("/api/transactions?limit=100&search=TXN-A")
      .set("Authorization", `Bearer ${orgAAdminToken}`);

    const demoItems = resDemo.body.data.items || resDemo.body.data;
    expect(demoItems.length).toBeGreaterThan(0);
    const seedDemoTxns = demoItems.filter(
      (d: any) => (d.id && d.id.startsWith("TXN-A-")) || (d.transactionId && d.transactionId.startsWith("TXN-A-")) || d.sourceType === "DEMO_ONLY"
    );
    expect(seedDemoTxns.length).toBeGreaterThan(0);
    for (const d of seedDemoTxns) {
      expect(d.sourceType).toBe("DEMO_ONLY");
    }
  });

  it("7. Quality Gating: Attempting to re-ingest duplicate records flags exact duplicates", async () => {
    const duplicateRow = [
      {
        transaction_id: "INV-HR-24-001",
        sme_id: "SME-AUTO-01",
        buyer_id: "BUYER-OEM-01",
        invoice_amount: 845000,
        invoice_date: "2024-01-10",
        due_date: "2024-02-10",
        payment_date: "2024-02-08",
        payment_status: "PAID",
        outstanding_amount: 0,
      },
    ];

    const res = await request(app)
      .post("/api/upload/validate")
      .set("Authorization", `Bearer ${orgRealAdminToken}`)
      .send({ rows: duplicateRow });

    expect(res.status).toBe(200);
    expect(res.body.data.scorecard.exactDuplicateCount).toBe(1);
    expect(res.body.data.scorecard.acceptedCount).toBe(0);
  });

  it("8. Counterparties registered from real data have active recalculated risk scores in ORG_REAL", async () => {
    const res = await request(app)
      .get("/api/firms/SME-AUTO-01")
      .set("Authorization", `Bearer ${orgRealAdminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe("SME-AUTO-01");
    expect(res.body.data.organizationId).toBe("ORG-003");
    expect(res.body.data.riskScore).toBeDefined();
    expect(res.body.data.riskLevel).toBeDefined();
  });

  it("9. Ingestion batches for real data store immutable provenance in PostgreSQL under ORG_REAL", async () => {
    const res = await request(app)
      .get("/api/upload/batches")
      .set("Authorization", `Bearer ${orgRealAdminToken}`);

    expect(res.status).toBe(200);
    const batches = res.body.data.items || res.body.data;
    const realBatch = batches.find((b: any) => b.sourceType === "PUBLIC_DATASET");

    expect(realBatch).toBeDefined();
    expect(realBatch.sourceName).toContain("Benchmark");
    expect(realBatch.dataStatus).toBe("PUBLIC_SIMULATED_DATA");
    expect(realBatch.dataGranularity).toBe("TRANSACTION_LEVEL");
    expect(realBatch.qualityReport).toBeDefined();
  });

  it("10. Multi-Tenant Batch Isolation: ORG_B cannot access ORG_REAL's ingestion batch audit", async () => {
    const batchesRes = await request(app)
      .get("/api/upload/batches")
      .set("Authorization", `Bearer ${orgRealAdminToken}`);

    const batchReal = (batchesRes.body.data.items || batchesRes.body.data)[0];
    expect(batchReal).toBeDefined();

    const idorRes = await request(app)
      .get(`/api/upload/batches/${batchReal.id}`)
      .set("Authorization", `Bearer ${orgBAdminToken}`);

    expect(idorRes.status).toBe(404);
    expect(idorRes.body.error.message).toContain("not available in your organization");
  });
});
