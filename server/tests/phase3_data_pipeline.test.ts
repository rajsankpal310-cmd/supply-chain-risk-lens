import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import app from "../src/app";
import { prisma } from "../src/config/database";

describe("NEXUS-CFR Phase 3 — Real Data Foundation Automated Test Suite", () => {
  let orgAAdminToken: string;
  let orgAAnalystToken: string;
  let orgAViewerToken: string;
  let orgBAdminToken: string;

  const cleanupNonSeedFirmsAndTxns = async () => {
    await prisma.transaction.deleteMany({
      where: {
        organizationId: "ORG-001",
        OR: [
          {
            smeId: {
              notIn: [
                "FIRM-A-01", "FIRM-A-02", "FIRM-A-03", "FIRM-A-04", "FIRM-A-05", "FIRM-A-06",
                "FIRM-A-07", "FIRM-A-08", "FIRM-A-09", "FIRM-A-10", "FIRM-A-11", "FIRM-A-12",
              ],
            },
          },
          {
            buyerId: {
              notIn: [
                "FIRM-A-01", "FIRM-A-02", "FIRM-A-03", "FIRM-A-04", "FIRM-A-05", "FIRM-A-06",
                "FIRM-A-07", "FIRM-A-08", "FIRM-A-09", "FIRM-A-10", "FIRM-A-11", "FIRM-A-12",
              ],
            },
          },
          { transactionId: { contains: "TXN-P3" } },
          { transactionId: { contains: "TXN-TAMPER" } },
          { transactionId: { contains: "TXN-PROV" } },
          { transactionId: { contains: "TXN-PARTIAL" } },
          { transactionId: { contains: "TXN-CP" } },
          { transactionId: { contains: "TXN-DEMO" } },
          { transactionId: { contains: "TXN-DUP" } },
          { transactionId: { contains: "TXN-POT" } },
        ],
      },
    });
    await prisma.firm.deleteMany({
      where: {
        organizationId: "ORG-001",
        id: {
          notIn: [
            "FIRM-A-01", "FIRM-A-02", "FIRM-A-03", "FIRM-A-04", "FIRM-A-05", "FIRM-A-06",
            "FIRM-A-07", "FIRM-A-08", "FIRM-A-09", "FIRM-A-10", "FIRM-A-11", "FIRM-A-12",
          ],
        },
      },
    });
  };

  beforeAll(async () => {
    await cleanupNonSeedFirmsAndTxns();

    // 1. Obtain ORG_A tokens
    const resAAdmin = await request(app)
      .post("/api/auth/login")
      .send({ email: "demo@nexuscfr.in", password: "demo1234" });
    orgAAdminToken = resAAdmin.body.data.token;

    const resAAnalyst = await request(app)
      .post("/api/auth/login")
      .send({ email: "analyst@nexus-cfr.demo", password: "demo1234" });
    orgAAnalystToken = resAAnalyst.body.data.token;

    const resAViewer = await request(app)
      .post("/api/auth/login")
      .send({ email: "viewer@nexus-cfr.demo", password: "demo1234" });
    orgAViewerToken = resAViewer.body.data.token;

    // 2. Obtain ORG_B token
    const resBAdmin = await request(app)
      .post("/api/auth/login")
      .send({ email: "admin@orgb.demo", password: "demo1234" });
    orgBAdminToken = resBAdmin.body.data.token;
  });

  afterAll(async () => {
    await cleanupNonSeedFirmsAndTxns();
  });

  // 1. Valid Dataset & Schema Detection
  it("1. Schema Inspection: detects columns, data types, and suggests canonical mapping", async () => {
    const rawRows = [
      {
        "Invoice No": "INV-REAL-101",
        "SME Code": "FIRM-A-01",
        "Buyer Code": "FIRM-A-02",
        "Total Amount": "450000",
        "Issue Date": "2026-04-10",
        "Due Date": "2026-05-10",
        "Status": "PAID",
        "Paid Date": "2026-05-08",
        "Outstanding": "0",
      },
    ];

    const res = await request(app)
      .post("/api/upload/inspect")
      .set("Authorization", `Bearer ${orgAAdminToken}`)
      .send({ rows: rawRows });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.headers).toBeDefined();
    expect(res.body.data.suggestedMapping).toBeDefined();
  });

  // 2. Full Validation of Valid Dataset
  it("2. Valid Dataset Validation: produces high quality scorecard with zero errors", async () => {
    const rawRows = [
      {
        transaction_id: `TXN-P3-V1-${Date.now()}`,
        sme_id: "FIRM-A-01",
        buyer_id: "FIRM-A-02",
        invoice_amount: 350000,
        invoice_date: "2026-03-01",
        due_date: "2026-03-31",
        payment_date: "2026-03-28",
        payment_status: "PAID",
        outstanding_amount: 0,
        credit_period: 30,
      },
    ];

    const res = await request(app)
      .post("/api/upload/validate")
      .set("Authorization", `Bearer ${orgAAdminToken}`)
      .send({ rows: rawRows });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.scorecard.totalRecords).toBe(1);
    expect(res.body.data.scorecard.acceptedCount).toBe(1);
    expect(res.body.data.scorecard.rejectedCount).toBe(0);
    expect(res.body.data.scorecard.overallQualityScore).toBeGreaterThanOrEqual(90);
  });

  // 3. Missing Required Columns
  it("3. Missing Required Columns: rejects row missing sme_id or buyer_id", async () => {
    const rawRows = [
      {
        transaction_id: `TXN-P3-ERR-${Date.now()}`,
        // Missing sme_id & buyer_id
        invoice_amount: 200000,
        invoice_date: "2026-04-01",
        due_date: "2026-05-01",
        payment_status: "PENDING",
      },
    ];

    const res = await request(app)
      .post("/api/upload/validate")
      .set("Authorization", `Bearer ${orgAAdminToken}`)
      .send({ rows: rawRows });

    expect(res.status).toBe(200);
    expect(res.body.data.scorecard.rejectedCount).toBe(1);
    expect(res.body.data.rowResults[0].isValid).toBe(false);
    expect(res.body.data.rowResults[0].errors.some((e: string) => e.includes("sme_id") || e.includes("buyer_id"))).toBe(true);
  });

  // 4. Invalid Date Format
  it("4. Invalid Date Format: flags unparseable date strings and chronological errors", async () => {
    const rawRows = [
      {
        transaction_id: `TXN-P3-DATE-${Date.now()}`,
        sme_id: "FIRM-A-01",
        buyer_id: "FIRM-A-02",
        invoice_amount: 150000,
        invoice_date: "invalid-date-format",
        due_date: "2026-05-01",
        payment_status: "PENDING",
      },
    ];

    const res = await request(app)
      .post("/api/upload/validate")
      .set("Authorization", `Bearer ${orgAAdminToken}`)
      .send({ rows: rawRows });

    expect(res.status).toBe(200);
    expect(res.body.data.scorecard.rejectedCount).toBe(1);
    expect(res.body.data.rowResults[0].isValid).toBe(false);
    expect(res.body.data.rowResults[0].errors.some((e: string) => e.includes("invoice_date"))).toBe(true);
  });

  // 5. Invalid Amount (Negative or Zero)
  it("5. Invalid Amount: rejects negative and zero invoice amounts", async () => {
    const rawRows = [
      {
        transaction_id: `TXN-P3-AMT-${Date.now()}`,
        sme_id: "FIRM-A-01",
        buyer_id: "FIRM-A-02",
        invoice_amount: -5000,
        invoice_date: "2026-05-01",
        due_date: "2026-06-01",
        payment_status: "PENDING",
      },
    ];

    const res = await request(app)
      .post("/api/upload/validate")
      .set("Authorization", `Bearer ${orgAAdminToken}`)
      .send({ rows: rawRows });

    expect(res.status).toBe(200);
    expect(res.body.data.scorecard.rejectedCount).toBe(1);
    expect(res.body.data.rowResults[0].errors.some((e: string) => e.includes("invoice_amount"))).toBe(true);
  });

  // 6. Invalid Status
  it("6. Invalid Status: identifies unapproved categorical statuses", async () => {
    const rawRows = [
      {
        transaction_id: `TXN-P3-STAT-${Date.now()}`,
        sme_id: "FIRM-A-01",
        buyer_id: "FIRM-A-02",
        invoice_amount: 120000,
        invoice_date: "2026-05-01",
        due_date: "2026-06-01",
        payment_status: "UNKNOWN_BOGUS_STATUS",
      },
    ];

    const res = await request(app)
      .post("/api/upload/validate")
      .set("Authorization", `Bearer ${orgAAdminToken}`)
      .send({ rows: rawRows });

    expect(res.status).toBe(200);
    expect(res.body.data.scorecard.rejectedCount).toBe(1);
    expect(res.body.data.rowResults[0].errors.some((e: string) => e.includes("payment_status"))).toBe(true);
  });

  // 7. Duplicate Transaction Detection
  it("7. Exact Duplicate Detection: flags multiple occurrences of the same transaction_id", async () => {
    const duplicateId = `TXN-DUP-${Date.now()}`;
    const rawRows = [
      {
        transaction_id: duplicateId,
        sme_id: "FIRM-A-01",
        buyer_id: "FIRM-A-02",
        invoice_amount: 100000,
        invoice_date: "2026-05-01",
        due_date: "2026-06-01",
        payment_status: "PENDING",
        outstanding_amount: 100000,
      },
      {
        transaction_id: duplicateId,
        sme_id: "FIRM-A-01",
        buyer_id: "FIRM-A-02",
        invoice_amount: 100000,
        invoice_date: "2026-05-01",
        due_date: "2026-06-01",
        payment_status: "PENDING",
        outstanding_amount: 100000,
      },
    ];

    const res = await request(app)
      .post("/api/upload/validate")
      .set("Authorization", `Bearer ${orgAAdminToken}`)
      .send({ rows: rawRows });

    expect(res.status).toBe(200);
    expect(res.body.data.scorecard.exactDuplicateCount).toBeGreaterThanOrEqual(1);
  });

  // 8. Potential Duplicate Detection
  it("8. Potential Duplicate Detection: flags records with identical counterparties, amount, and dates", async () => {
    const rawRows = [
      {
        transaction_id: `TXN-POT-1-${Date.now()}`,
        sme_id: "FIRM-A-01",
        buyer_id: "FIRM-A-02",
        invoice_amount: 275000,
        invoice_date: "2026-05-15",
        due_date: "2026-06-15",
        payment_status: "PENDING",
        outstanding_amount: 275000,
      },
      {
        transaction_id: `TXN-POT-2-${Date.now()}`,
        sme_id: "FIRM-A-01",
        buyer_id: "FIRM-A-02",
        invoice_amount: 275000,
        invoice_date: "2026-05-15",
        due_date: "2026-06-15",
        payment_status: "PENDING",
        outstanding_amount: 275000,
      },
    ];

    const res = await request(app)
      .post("/api/upload/validate")
      .set("Authorization", `Bearer ${orgAAdminToken}`)
      .send({ rows: rawRows });

    expect(res.status).toBe(200);
    expect(res.body.data.scorecard.potentialDuplicateCount).toBeGreaterThanOrEqual(1);
  });

  // 9. Inconsistent Payment Status (PAID without payment_date)
  it("9. Inconsistent Payment Status: PAID status without payment_date is rejected", async () => {
    const rawRows = [
      {
        transaction_id: `TXN-P3-INCON1-${Date.now()}`,
        sme_id: "FIRM-A-01",
        buyer_id: "FIRM-A-02",
        invoice_amount: 180000,
        invoice_date: "2026-05-01",
        due_date: "2026-06-01",
        payment_status: "PAID",
        payment_date: null,
        outstanding_amount: 0,
      },
    ];

    const res = await request(app)
      .post("/api/upload/validate")
      .set("Authorization", `Bearer ${orgAAdminToken}`)
      .send({ rows: rawRows });

    expect(res.status).toBe(200);
    expect(res.body.data.scorecard.rejectedCount).toBe(1);
    expect(res.body.data.rowResults[0].errors.some((e: string) => e.includes("payment_date"))).toBe(true);
  });

  // 10. Inconsistent Outstanding Amount (PAID with outstanding > 0, or negative outstanding)
  it("10. Inconsistent Outstanding Amount: PAID with remaining outstanding balance is rejected", async () => {
    const rawRows = [
      {
        transaction_id: `TXN-P3-INCON2-${Date.now()}`,
        sme_id: "FIRM-A-01",
        buyer_id: "FIRM-A-02",
        invoice_amount: 180000,
        invoice_date: "2026-05-01",
        due_date: "2026-06-01",
        payment_status: "PAID",
        payment_date: "2026-05-25",
        outstanding_amount: 50000,
      },
    ];

    const res = await request(app)
      .post("/api/upload/validate")
      .set("Authorization", `Bearer ${orgAAdminToken}`)
      .send({ rows: rawRows });

    expect(res.status).toBe(200);
    expect(res.body.data.scorecard.rejectedCount).toBe(1);
    expect(res.body.data.rowResults[0].errors.some((e: string) => e.includes("outstanding_amount"))).toBe(true);
  });

  // 11. Empty Dataset Handling
  it("11. Empty Dataset Handling: returns 400 when empty array is provided", async () => {
    const res = await request(app)
      .post("/api/upload/validate")
      .set("Authorization", `Bearer ${orgAAdminToken}`)
      .send({ rows: [] });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  // 12. OrganizationId Tampering Prevention
  it("12. OrganizationId Tampering Prevention: server overrides client-supplied organizationId", async () => {
    const txnId = `TXN-TAMPER-${Date.now()}`;
    const rawRows = [
      {
        transaction_id: txnId,
        organizationId: "ORG-002", // Malicious client attempt to import into ORG-002
        sme_id: "FIRM-A-01",
        buyer_id: "FIRM-A-02",
        invoice_amount: 320000,
        invoice_date: "2026-05-01",
        due_date: "2026-06-01",
        payment_status: "PENDING",
        outstanding_amount: 320000,
      },
    ];

    const res = await request(app)
      .post("/api/upload/import")
      .set("Authorization", `Bearer ${orgAAdminToken}`)
      .send({
        rows: rawRows,
        sourceType: "PRIMARY_TRANSACTION",
        sourceName: "Tamper Test Ledger",
      });

    expect(res.status).toBe(201);
    expect(res.body.data.imported).toBe(1);

    // Verify in database that it was bound to ORG-001 (ORG_A), NOT ORG-002
    const saved = await prisma.transaction.findFirst({
      where: { transactionId: txnId },
    });
    expect(saved).toBeDefined();
    expect(saved?.organizationId).toBe("ORG-001");
  });

  // 13. Cross-Tenant Record Access Isolation
  it("13. Cross-Tenant Isolation: ORG_B cannot view import batches or records from ORG_A", async () => {
    // Fetch batches as ORG_B
    const resB = await request(app)
      .get("/api/upload/batches")
      .set("Authorization", `Bearer ${orgBAdminToken}`);

    expect(resB.status).toBe(200);
    const items = resB.body.data?.items || resB.body.data || [];
    for (const b of items) {
      expect(b.organizationId).toBe("ORG-002");
    }
  });

  // 14. RBAC Restrictions on Import
  it("14. RBAC Enforcement: VIEWER and ANALYST roles are forbidden from importing data", async () => {
    const rawRows = [
      {
        sme_id: "FIRM-A-01",
        buyer_id: "FIRM-A-02",
        invoice_amount: 100000,
        invoice_date: "2026-05-01",
        due_date: "2026-06-01",
        payment_status: "PENDING",
      },
    ];

    const resViewer = await request(app)
      .post("/api/upload/import")
      .set("Authorization", `Bearer ${orgAViewerToken}`)
      .send({ rows: rawRows });
    expect(resViewer.status).toBe(403);

    const resAnalyst = await request(app)
      .post("/api/upload/import")
      .set("Authorization", `Bearer ${orgAAnalystToken}`)
      .send({ rows: rawRows });
    expect(resAnalyst.status).toBe(403);
  });

  // 15. Provenance Persistence
  it("15. Provenance Persistence: stores dataset name, version, source URL, and license in ImportBatch", async () => {
    const rawRows = [
      {
        transaction_id: `TXN-PROV-${Date.now()}`,
        sme_id: "FIRM-A-01",
        buyer_id: "FIRM-A-02",
        invoice_amount: 400000,
        invoice_date: "2026-05-01",
        due_date: "2026-06-01",
        payment_status: "PENDING",
        outstanding_amount: 400000,
      },
    ];

    const provenanceInput = {
      sourceType: "PUBLIC_DATASET",
      sourceName: "World Bank MSME Benchmark",
      sourceOrg: "World Bank Group",
      sourceUrl: "https://data.worldbank.org/msme-2026",
      datasetVersion: "v2.4",
      license: "CC-BY-4.0",
      dataGranularity: "TRANSACTION_LEVEL",
    };

    const res = await request(app)
      .post("/api/upload/import")
      .set("Authorization", `Bearer ${orgAAdminToken}`)
      .send({
        rows: rawRows,
        ...provenanceInput,
      });

    expect(res.status).toBe(201);
    const batchId = res.body.data.batchId;
    expect(batchId).toBeDefined();

    const batch = await prisma.importBatch.findUnique({
      where: { id: batchId },
    });
    expect(batch).toBeDefined();
    expect(batch?.sourceName).toBe(provenanceInput.sourceName);
    expect(batch?.sourceOrg).toBe(provenanceInput.sourceOrg);
    expect(batch?.sourceUrl).toBe(provenanceInput.sourceUrl);
    expect(batch?.datasetVersion).toBe(provenanceInput.datasetVersion);
    expect(batch?.license).toBe(provenanceInput.license);
    expect(batch?.dataStatus).toBe("PUBLIC_SIMULATED_DATA");
  });

  // 16. Failed Import State Traceability
  it("16. Failed Import: records with 100% invalid rows fail with 422 and do not create false success", async () => {
    const rawRows = [
      {
        transaction_id: "TXN-FAIL-1",
        invoice_amount: -999,
        invoice_date: "not-a-date",
        due_date: "2026-01-01",
      },
    ];

    const res = await request(app)
      .post("/api/upload/import")
      .set("Authorization", `Bearer ${orgAAdminToken}`)
      .send({ rows: rawRows });

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
  });

  // 17. Partial Validation Failure Handling
  it("17. Partial Validation: imports valid rows while isolating and reporting invalid rows", async () => {
    const validTxnId = `TXN-PARTIAL-OK-${Date.now()}`;
    const rawRows = [
      {
        transaction_id: validTxnId,
        sme_id: "FIRM-A-01",
        buyer_id: "FIRM-A-02",
        invoice_amount: 250000,
        invoice_date: "2026-05-01",
        due_date: "2026-06-01",
        payment_status: "PENDING",
        outstanding_amount: 250000,
      },
      {
        transaction_id: "TXN-PARTIAL-BAD",
        sme_id: "FIRM-A-01",
        buyer_id: "FIRM-A-02",
        invoice_amount: -100,
        invoice_date: "2026-05-01",
        due_date: "2026-06-01",
        payment_status: "PENDING",
      },
    ];

    const res = await request(app)
      .post("/api/upload/import")
      .set("Authorization", `Bearer ${orgAAdminToken}`)
      .send({ rows: rawRows });

    expect(res.status).toBe(201);
    expect(res.body.data.imported).toBe(1);
    expect(res.body.data.rejected).toBe(1);

    // Verify valid transaction was stored
    const saved = await prisma.transaction.findFirst({
      where: { transactionId: validTxnId },
    });
    expect(saved).toBeDefined();
  });

  // 18. Counterparty Auto-Resolution under Organization
  it("18. Counterparty Resolution: registers new counterparties under tenant org without fabricating IDs", async () => {
    const newCounterpartyName = `Tata Motors Supply ${Date.now()}`;
    const newBuyerName = `Mahindra Commercial ${Date.now()}`;
    const rawRows = [
      {
        transaction_id: `TXN-CP-${Date.now()}`,
        sme_id: newCounterpartyName,
        buyer_id: newBuyerName,
        invoice_amount: 650000,
        invoice_date: "2026-05-01",
        due_date: "2026-06-01",
        payment_status: "PENDING",
        outstanding_amount: 650000,
      },
    ];

    const res = await request(app)
      .post("/api/upload/import")
      .set("Authorization", `Bearer ${orgAAdminToken}`)
      .send({
        rows: rawRows,
        sourceType: "PRIMARY_TRANSACTION",
      });

    expect(res.status).toBe(201);
    expect(res.body.data.imported).toBe(1);

    // Verify firm counterparty was registered in ORG-001
    const firm = await prisma.firm.findFirst({
      where: { id: newCounterpartyName, organizationId: "ORG-001" },
    });
    expect(firm).toBeDefined();
    expect(firm?.organizationId).toBe("ORG-001");

    // Clean up newly created counterparty firms to preserve pristine seed counts
    await prisma.transaction.deleteMany({
      where: { OR: [{ smeId: newCounterpartyName }, { buyerId: newBuyerName }] },
    });
    await prisma.firm.deleteMany({
      where: { id: { in: [newCounterpartyName, newBuyerName] } },
    });
  });

  // 19. Demo Data vs Real Data Classification Isolation
  it("19. Data Classification: DEMO_ONLY tag sets dataStatus to DEMO and isDemo to true", async () => {
    const rawRows = [
      {
        transaction_id: `TXN-DEMO-${Date.now()}`,
        sme_id: "FIRM-A-01",
        buyer_id: "FIRM-A-02",
        invoice_amount: 110000,
        invoice_date: "2026-05-01",
        due_date: "2026-06-01",
        payment_status: "PENDING",
        outstanding_amount: 110000,
      },
    ];

    const res = await request(app)
      .post("/api/upload/import")
      .set("Authorization", `Bearer ${orgAAdminToken}`)
      .send({
        rows: rawRows,
        sourceType: "DEMO_ONLY",
        sourceName: "Synthetic Sandbox 2026",
      });

    expect(res.status).toBe(201);
    const batchId = res.body.data.batchId;
    const batch = await prisma.importBatch.findUnique({
      where: { id: batchId },
    });
    expect(batch?.sourceType).toBe("DEMO_ONLY");
    expect(batch?.dataStatus).toBe("DEMO");
  });

  // 20. PostgreSQL Persistence & Risk Metric Updates
  it("20. End-to-End PostgreSQL Persistence: transactions are queryable and linked to batch", async () => {
    const txnId = `TXN-P3-E2E-${Date.now()}`;
    const rawRows = [
      {
        transaction_id: txnId,
        sme_id: "FIRM-A-01",
        buyer_id: "FIRM-A-02",
        invoice_amount: 525000,
        invoice_date: "2026-05-01",
        due_date: "2026-06-01",
        payment_status: "PENDING",
        outstanding_amount: 525000,
      },
    ];

    const res = await request(app)
      .post("/api/upload/import")
      .set("Authorization", `Bearer ${orgAAdminToken}`)
      .send({
        rows: rawRows,
        sourceType: "PRIMARY_TRANSACTION",
        sourceName: "ERP Batch E2E",
      });

    expect(res.status).toBe(201);
    const batchId = res.body.data.batchId;

    // Fetch batch detail endpoint
    const batchRes = await request(app)
      .get(`/api/upload/batches/${batchId}`)
      .set("Authorization", `Bearer ${orgAAdminToken}`);

    expect(batchRes.status).toBe(200);
    expect(batchRes.body.data.id).toBe(batchId);
    expect(batchRes.body.data.transactions.length).toBeGreaterThanOrEqual(1);
    expect(batchRes.body.data.transactions.some((t: any) => t.transactionId === txnId || t.id === txnId)).toBe(true);
  });
});
