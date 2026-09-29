import request from "supertest";
import { describe, expect, it, beforeAll } from "vitest";
import app from "../src/app";
import { prisma } from "../src/config/database";
import { SourceClassifier } from "../src/pipeline/sourceClassifier";
import { ingestVerifiedB2BDataset } from "../src/pipeline/ingestRealData";

describe("NEXUS-CFR Phase 3.6 — Data Authenticity, Provenance & ML-Readiness Audit Suite", () => {
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

  // 1. Authenticity & Provenance Classification
  it("1. SourceClassifier correctly distinguishes SIMULATED vs REAL_OBSERVED vs ADMINISTRATIVE", () => {
    // A: Simulated benchmark
    const simProv = SourceClassifier.classify({
      sourceType: "SIMULATED",
      sourceName: "B2B Payment Benchmark (Simulated)",
    });
    expect(simProv.sourceType).toBe("SIMULATED");
    expect(simProv.dataStatus).toBe("PUBLIC_SIMULATED_DATA");

    // B: Real primary transaction
    const realProv = SourceClassifier.classify({
      sourceType: "PRIMARY_TRANSACTION",
      sourceName: "SAP ERP Ledger Export",
    });
    expect(realProv.sourceType).toBe("PRIMARY_TRANSACTION");
    expect(realProv.dataStatus).toBe("VERIFIED");

    // C: External reference / administrative aggregate
    const refProv = SourceClassifier.classify({
      sourceType: "EXTERNAL_REFERENCE",
      sourceName: "MSME Samadhaan Statistics",
    });
    expect(refProv.sourceType).toBe("EXTERNAL_REFERENCE");
    expect(refProv.dataStatus).toBe("ADMINISTRATIVE_AGGREGATE");

    // D: Demo data
    const demoProv = SourceClassifier.classify({
      sourceType: "DEMO_ONLY",
    });
    expect(demoProv.sourceType).toBe("DEMO_ONLY");
    expect(demoProv.dataStatus).toBe("DEMO");
  });

  // 2. Truthful Metadata Inspection
  it("2. Ingestion metadata for B2B benchmark honestly states simulated origin without fake URLs", async () => {
    const res = await request(app)
      .get("/api/upload/batches")
      .set("Authorization", `Bearer ${orgRealAdminToken}`);

    expect(res.status).toBe(200);
    const batches = res.body.data.items || res.body.data;
    const benchBatch = batches[0];
    expect(benchBatch).toBeDefined();
    expect(benchBatch.sourceName).toContain("Benchmark");
    expect(benchBatch.sourceOrg).toContain("Benchmark Engineering");
    expect(benchBatch.sourceUrl).toBe("UNKNOWN / NOT_PUBLISHED");
    expect(benchBatch.datasetVersion).toBe("1.0-SIM");
  });

  // 3. Domain Separation: Macro Reference vs Transaction Ledger
  it("3. Macro benchmarks remain strictly decoupled from transaction ledger rows", async () => {
    // Fetch macro benchmarks
    const benchRes = await request(app)
      .get("/api/reference/benchmarks")
      .set("Authorization", `Bearer ${orgRealAdminToken}`);

    expect(benchRes.status).toBe(200);
    expect(benchRes.body.data.source.granularity).toBe("ADMINISTRATIVE_AGGREGATE");
    expect(benchRes.body.data.sectors.length).toBeGreaterThan(0);

    // Fetch transactions — confirm transaction rows do not contain synthetic macro survey fields
    const txnRes = await request(app)
      .get("/api/transactions?limit=5")
      .set("Authorization", `Bearer ${orgRealAdminToken}`);

    expect(txnRes.status).toBe(200);
    const txns = txnRes.body.data.items || txnRes.body.data;
    for (const t of txns) {
      expect(t.invoiceAmount).toBeDefined();
      expect(t.dueDate).toBeDefined();
      // No synthetic macro fields injected into transaction schema
      expect((t as any).avgActualPaymentDays).toBeUndefined();
      expect((t as any).cascadeVulnerability).toBeUndefined();
    }
  });

  // 4. ML Readiness: Target Variable Availability & Right-Censoring Check
  it("4. Target variable (paymentDelayDays) is defined for PAID rows and right-censored for open rows", async () => {
    const res = await request(app)
      .get("/api/transactions?limit=100")
      .set("Authorization", `Bearer ${orgRealAdminToken}`);

    expect(res.status).toBe(200);
    const txns = res.body.data.items || res.body.data;
    expect(txns.length).toBe(50);

    const paidTxns = txns.filter((t: any) => t.paymentStatus === "PAID");
    const openTxns = txns.filter((t: any) => t.paymentStatus !== "PAID");

    expect(paidTxns.length).toBe(30);
    expect(openTxns.length).toBe(20);

    // Completed invoices have computed target delay
    for (const p of paidTxns) {
      expect(p.paymentDate).not.toBeNull();
      expect(typeof p.paymentDelayDays).toBe("number");
      expect(p.outstandingAmount).toBe(0);
    }

    // Open invoices have null paymentDate (right-censored, preventing naive regression target leakage)
    for (const o of openTxns) {
      expect(o.paymentDate).toBeNull();
      expect(o.outstandingAmount).toBeGreaterThan(0);
    }
  });

  // 5. ML Readiness: Statistical Sample-Size Assessment
  it("5. Sample size is exactly 50 records across 8 counterparties (statistically insufficient for production ML)", async () => {
    const res = await request(app)
      .get("/api/transactions?limit=100")
      .set("Authorization", `Bearer ${orgRealAdminToken}`);

    const txns = res.body.data.items || res.body.data;
    expect(txns.length).toBe(50);

    const uniqueSMEs = new Set(txns.map((t: any) => t.smeId));
    const uniqueBuyers = new Set(txns.map((t: any) => t.buyerId));

    expect(uniqueSMEs.size).toBe(8);
    expect(uniqueBuyers.size).toBe(8);

    // Formally verify statistical limitation: N < 100 is insufficient for complex ML training
    const isSufficientForProductionML = txns.length >= 500 && uniqueBuyers.size >= 50;
    expect(isSufficientForProductionML).toBe(false);
  });

  // 6. ML Readiness: Temporal Sequence Feasibility for Train/Test Splitting
  it("6. Invoice dates span chronological range enabling strict temporal out-of-time validation", async () => {
    const res = await request(app)
      .get("/api/transactions?limit=100&sortBy=invoiceDate&sortDir=asc")
      .set("Authorization", `Bearer ${orgRealAdminToken}`);

    const txns = res.body.data.items || res.body.data;
    const dates = txns.map((t: any) => new Date(t.invoiceDate).getTime());

    // Verify chronological order
    for (let i = 1; i < dates.length; i++) {
      expect(dates[i]).toBeGreaterThanOrEqual(dates[i - 1]);
    }

    const minDate = new Date(dates[0]);
    const maxDate = new Date(dates[dates.length - 1]);
    const daysSpan = Math.round((maxDate.getTime() - minDate.getTime()) / 86400000);

    // Spans ~248 days (Jan 2024 to Sep 2024)
    expect(daysSpan).toBeGreaterThan(200);
  });

  // 7. Multi-Tenant Organization Isolation Verification
  it("7. Benchmark dataset in ORG-003 is completely isolated from ORG-001 and ORG-002", async () => {
    // ORG-001 querying INV-HR-24-001 receives 404
    const resA = await request(app)
      .get("/api/transactions/INV-HR-24-001")
      .set("Authorization", `Bearer ${orgAAdminToken}`);
    expect(resA.status).toBe(404);

    // ORG-002 querying INV-HR-24-001 receives 404
    const resB = await request(app)
      .get("/api/transactions/INV-HR-24-001")
      .set("Authorization", `Bearer ${orgBAdminToken}`);
    expect(resB.status).toBe(404);

    // ORG-003 querying INV-HR-24-001 succeeds
    const resReal = await request(app)
      .get("/api/transactions/INV-HR-24-001")
      .set("Authorization", `Bearer ${orgRealAdminToken}`);
    expect(resReal.status).toBe(200);
    expect(resReal.body.data.organizationId).toBe("ORG-003");
  });
});
