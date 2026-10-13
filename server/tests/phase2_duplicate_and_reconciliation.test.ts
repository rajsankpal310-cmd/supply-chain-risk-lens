import { describe, it, expect, beforeAll, vi } from "vitest";
import request from "supertest";
import app from "../src/app";
import { prisma } from "../src/config/database";
import { PipelineOrchestrator, generateContentFingerprint } from "../src/pipeline/pipelineOrchestrator";
import { QualityAnalyzer } from "../src/pipeline/qualityAnalyzer";

describe("Phase 2 — Duplicate-Import Protection & Count Reconciliation", () => {
  let org1Token: string;
  let org1Id: string;
  let org2Token: string;
  let org2Id: string;

  const testMapping = {
    transaction_id: "txn_id",
    sme_id: "vendor_code",
    sme_name: "vendor_name",
    buyer_id: "client_code",
    buyer_name: "client_name",
    invoice_amount: "amount",
    invoice_date: "inv_date",
    due_date: "due_date",
    payment_date: "pay_date",
    payment_status: "status",
  };

  const sampleDataset = [
    {
      txn_id: "PH2-TXN-101",
      vendor_code: "PH2-VEND-A",
      vendor_name: "Alpha Supplies Ltd",
      client_code: "PH2-CLIENT-X",
      client_name: "Apex Retail",
      amount: "150000",
      inv_date: "2026-03-01",
      due_date: "2026-04-01",
      pay_date: "2026-03-25",
      status: "PAID",
    },
    {
      txn_id: "PH2-TXN-102",
      vendor_code: "PH2-VEND-B",
      vendor_name: "Beta Components",
      client_code: "PH2-CLIENT-Y",
      client_name: "Apex Retail",
      amount: "275000",
      inv_date: "2026-03-05",
      due_date: "2026-04-05",
      pay_date: "",
      status: "PENDING",
    },
    {
      txn_id: "PH2-TXN-103",
      vendor_code: "PH2-VEND-C",
      vendor_name: "Gamma Logistics",
      client_code: "PH2-CLIENT-Z",
      client_name: "Zenith Corp",
      amount: "98000",
      inv_date: "2026-03-10",
      due_date: "2026-04-10",
      pay_date: "2026-03-28",
      status: "PAID",
    },
  ];

  beforeAll(async () => {
    // 1. Register clean test organization 1
    const ts1 = Date.now();
    const res1 = await request(app)
      .post("/api/auth/register")
      .send({
        fullName: "Phase2 Org1 Admin",
        email: `phase2_org1_${ts1}@testcorp.in`,
        password: "Password123!",
        companyName: `Phase2 Tenant Org 1 ${ts1}`,
        industry: "Manufacturing",
      });
    expect(res1.status).toBe(201);
    org1Token = res1.body.data.token;
    org1Id = res1.body.data.user.organizationId;

    // 2. Register clean test organization 2
    const ts2 = Date.now() + 1;
    const res2 = await request(app)
      .post("/api/auth/register")
      .send({
        fullName: "Phase2 Org2 Admin",
        email: `phase2_org2_${ts2}@testcorp.in`,
        password: "Password123!",
        companyName: `Phase2 Tenant Org 2 ${ts2}`,
        industry: "Retail",
      });
    expect(res2.status).toBe(201);
    org2Token = res2.body.data.token;
    org2Id = res2.body.data.user.organizationId;
  }, 45000);

  // ---------------------------------------------------------------------------
  // 1. CANONICAL CONTENT FINGERPRINTING UNIT TESTS
  // ---------------------------------------------------------------------------
  describe("1. Canonical Content Fingerprinting", () => {
    it("generates identical fingerprint regardless of object key order", () => {
      const rowsA = [
        { a: "1", b: "2", c: "3" },
        { a: "4", b: "5", c: "6" },
      ];
      const rowsB = [
        { c: "3", a: "1", b: "2" },
        { b: "5", c: "6", a: "4" },
      ];

      const hashA = generateContentFingerprint("ORG-TEST", rowsA);
      const hashB = generateContentFingerprint("ORG-TEST", rowsB);
      expect(hashA).toBe(hashB);
    });

    it("generates different fingerprints for different organizations (tenant isolation)", () => {
      const rows = [{ txn: "101", amount: "500" }];
      const hashOrg1 = generateContentFingerprint("ORG-AAA", rows);
      const hashOrg2 = generateContentFingerprint("ORG-BBB", rows);

      expect(hashOrg1).not.toBe(hashOrg2);
      expect(hashOrg1.length).toBe(64);
      expect(hashOrg2.length).toBe(64);
    });

    it("generates different fingerprints when content is modified", () => {
      const rows1 = [{ txn: "101", amount: "500" }];
      const rows2 = [{ txn: "101", amount: "501" }];

      const hash1 = generateContentFingerprint("ORG-TEST", rows1);
      const hash2 = generateContentFingerprint("ORG-TEST", rows2);
      expect(hash1).not.toBe(hash2);
    });
  });

  // ---------------------------------------------------------------------------
  // 2. DUPLICATE-IMPORT PROTECTION (DIFFERENT FILENAMES / LABELS IN SAME ORG)
  // ---------------------------------------------------------------------------
  describe("2. Deterministic Duplicate-Import Protection in Same Organization", () => {
    let firstBatchId: string;

    it("accepts first upload with sourceName 'Vendor_Payments_Original.csv'", async () => {
      const res = await request(app)
        .post("/api/upload/import")
        .set("Authorization", `Bearer ${org1Token}`)
        .send({
          rows: sampleDataset,
          mapping: testMapping,
          sourceName: "Vendor_Payments_Original.csv",
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.imported).toBe(3);
      expect(res.body.data.batchId).toBeDefined();
      firstBatchId = res.body.data.batchId;

      // Verify batch is recorded in database
      const batchInDb = await prisma.importBatch.findUnique({
        where: { id: firstBatchId },
      });
      expect(batchInDb).not.toBeNull();
      expect(batchInDb?.recordCount).toBe(3);
      expect(batchInDb?.acceptedCount).toBe(3);
    });

    it("blocks second upload of identical content with different filename 'Renamed_Payments_Copy.csv' with 409 Conflict", async () => {
      const res = await request(app)
        .post("/api/upload/import")
        .set("Authorization", `Bearer ${org1Token}`)
        .send({
          rows: sampleDataset,
          mapping: testMapping,
          sourceName: "Renamed_Payments_Copy.csv", // Renamed filename!
        });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("CONFLICT");
      expect(res.body.error.message).toContain("Deterministic duplicate import detected");
      expect(res.body.error.message).toContain(firstBatchId);
    });

    it("blocks second upload when sourceName defaults to Direct CSV Ingestion with 409 Conflict", async () => {
      const res = await request(app)
        .post("/api/upload/import")
        .set("Authorization", `Bearer ${org1Token}`)
        .send({
          rows: sampleDataset,
          mapping: testMapping,
        });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe("CONFLICT");
      expect(res.body.error.message).toContain(firstBatchId);
    });
  });

  // ---------------------------------------------------------------------------
  // 3. MULTI-TENANT ISOLATION: IDENTICAL CONTENT IN DIFFERENT ORGANIZATIONS
  // ---------------------------------------------------------------------------
  describe("3. Multi-Tenant Organization Isolation", () => {
    it("allows second organization to upload identical content without conflict", async () => {
      const res = await request(app)
        .post("/api/upload/import")
        .set("Authorization", `Bearer ${org2Token}`)
        .send({
          rows: sampleDataset,
          mapping: testMapping,
          sourceName: "Vendor_Payments_Original.csv",
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.imported).toBe(3);

      const org2BatchId = res.body.data.batchId;
      expect(org2BatchId).toBeDefined();

      // Verify Org 2 has its own isolated batch and transactions in database
      const org2Batches = await prisma.importBatch.findMany({
        where: { organizationId: org2Id },
      });
      expect(org2Batches.length).toBe(1);
      expect(org2Batches[0].id).toBe(org2BatchId);

      const org2Txns = await prisma.transaction.findMany({
        where: { organizationId: org2Id },
      });
      expect(org2Txns.length).toBe(3);
      expect(org2Txns.every((t) => t.organizationId === org2Id)).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // 4. ATOMIC DATABASE TRANSACTION ROLLBACK
  // ---------------------------------------------------------------------------
  describe("4. Atomic Batch & Transaction Persistence via prisma.$transaction", () => {
    it("rolls back ImportBatch creation if transaction insertion fails", async () => {
      const newDataset = [
        {
          txn_id: "ROLLBACK-TXN-001",
          vendor_code: "ROLLBACK-VEND-1",
          vendor_name: "Rollback Vendor",
          client_code: "ROLLBACK-CLIENT-1",
          client_name: "Rollback Client",
          amount: "100000",
          inv_date: "2026-03-01",
          due_date: "2026-04-01",
          pay_date: "2026-03-20",
          status: "PAID",
        },
      ];

      // Count batches before simulated failure
      const initialBatchCount = await prisma.importBatch.count({
        where: { organizationId: org1Id },
      });

      // Wrap prisma.$transaction to simulate a failure during row insertion
      const originalTransaction = prisma.$transaction;
      (prisma as any).$transaction = async (callback: any, options: any) => {
        return originalTransaction.call(prisma, async (tx: any) => {
          const proxiedTx = new Proxy(tx, {
            get(target, prop) {
              if (prop === "transaction") {
                return new Proxy(target.transaction, {
                  get(txTarget, txProp) {
                    if (txProp === "createMany") {
                      return async () => {
                        throw new Error("Simulated Partial Database Failure during transaction.createMany");
                      };
                    }
                    return (txTarget as any)[txProp];
                  },
                });
              }
              return (target as any)[prop];
            },
          });
          return callback(proxiedTx);
        }, options);
      };

      let thrownError: any = null;
      try {
        await PipelineOrchestrator.executeImport(
          org1Id,
          "test-user",
          newDataset,
          testMapping,
          { sourceName: "Rollback_Test.csv" }
        );
      } catch (err) {
        thrownError = err;
      } finally {
        (prisma as any).$transaction = originalTransaction;
      }

      expect(thrownError).not.toBeNull();
      expect(thrownError.message).toContain("Simulated Partial Database Failure");

      // Verify that NO new ImportBatch was committed (it was rolled back)
      const afterBatchCount = await prisma.importBatch.count({
        where: { organizationId: org1Id },
      });
      expect(afterBatchCount).toBe(initialBatchCount);

      // Verify no orphan transaction was created
      const orphanTxn = await prisma.transaction.findFirst({
        where: { transactionId: "ROLLBACK-TXN-001" },
      });
      expect(orphanTxn).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // 5. COUNT RECONCILIATION & REJECTION TRANSPARENCY
  // ---------------------------------------------------------------------------
  describe("5. Count Reconciliation (total = accepted + rejected)", () => {
    it("guarantees total = accepted + rejected and distinguishes invalid vs duplicate rows", async () => {
      // Dataset with 6 rows:
      // Row 1: Valid
      // Row 2: Valid
      // Row 3: Valid
      // Row 4: Exact duplicate of Row 1 (valid business fields, duplicate transactionId)
      // Row 5: Invalid (missing SME & Supplier ID)
      // Row 6: Invalid (negative invoice amount)
      const mixedRows = [
        {
          txn_id: "RC-TXN-001",
          vendor_code: "RC-VEND-1",
          vendor_name: "Valid Firm 1",
          client_code: "RC-CLIENT-1",
          client_name: "Valid Client 1",
          amount: "10000",
          inv_date: "2026-02-01",
          due_date: "2026-03-01",
          pay_date: "2026-02-28",
          status: "PAID",
        },
        {
          txn_id: "RC-TXN-002",
          vendor_code: "RC-VEND-2",
          vendor_name: "Valid Firm 2",
          client_code: "RC-CLIENT-2",
          client_name: "Valid Client 2",
          amount: "20000",
          inv_date: "2026-02-05",
          due_date: "2026-03-05",
          pay_date: "",
          status: "PENDING",
        },
        {
          txn_id: "RC-TXN-003",
          vendor_code: "RC-VEND-3",
          vendor_name: "Valid Firm 3",
          client_code: "RC-CLIENT-3",
          client_name: "Valid Client 3",
          amount: "30000",
          inv_date: "2026-02-10",
          due_date: "2026-03-10",
          pay_date: "2026-02-28",
          status: "PAID",
        },
        {
          // EXACT DUPLICATE of Row 1 within batch
          txn_id: "RC-TXN-001",
          vendor_code: "RC-VEND-1",
          vendor_name: "Valid Firm 1",
          client_code: "RC-CLIENT-1",
          client_name: "Valid Client 1",
          amount: "10000",
          inv_date: "2026-02-01",
          due_date: "2026-03-01",
          pay_date: "2026-02-28",
          status: "PAID",
        },
        {
          // INVALID: Missing vendor and client identifiers
          txn_id: "RC-TXN-005",
          vendor_code: "",
          vendor_name: "",
          client_code: "",
          client_name: "",
          amount: "50000",
          inv_date: "2026-02-15",
          due_date: "2026-03-15",
          pay_date: "2026-02-28",
          status: "PAID",
        },
        {
          // INVALID: Negative invoice amount
          txn_id: "RC-TXN-006",
          vendor_code: "RC-VEND-6",
          vendor_name: "Valid Firm 6",
          client_code: "RC-CLIENT-6",
          client_name: "Valid Client 6",
          amount: "-500",
          inv_date: "2026-02-20",
          due_date: "2026-03-20",
          pay_date: "2026-02-28",
          status: "PAID",
        },
      ];

      // 1. Test validation endpoint
      const valRes = await request(app)
        .post("/api/upload/validate")
        .set("Authorization", `Bearer ${org1Token}`)
        .send({
          rows: mixedRows,
          mapping: testMapping,
        });

      expect(valRes.status).toBe(200);
      expect(valRes.body.success).toBe(true);

      const scorecard = valRes.body.data.scorecard;
      expect(scorecard.totalRecords).toBe(6);
      expect(scorecard.acceptedCount).toBe(3);
      expect(scorecard.rejectedCount).toBe(3);
      expect(scorecard.invalidCount).toBe(2);
      expect(scorecard.exactDuplicateOnValidCount).toBe(1);
      expect(scorecard.exactDuplicateCount).toBe(1);

      // Core mathematical guarantee: total = accepted + rejected
      expect(scorecard.acceptedCount + scorecard.rejectedCount).toBe(scorecard.totalRecords);
      expect(scorecard.rejectedCount).toBe(scorecard.invalidCount + scorecard.exactDuplicateOnValidCount);

      // Check rejection reasons distinguish invalid vs exact duplicate
      const duplicateErrors = scorecard.rejectionReasons.filter((r: any) => r.rule === "EXACT_DUPLICATE");
      expect(duplicateErrors.length).toBe(1);
      expect(duplicateErrors[0].row).toBe(4);

      const invalidErrors = scorecard.rejectionReasons.filter((r: any) => r.rule !== "EXACT_DUPLICATE");
      expect(invalidErrors.length).toBeGreaterThanOrEqual(2);

      // 2. Test import execution
      const importRes = await request(app)
        .post("/api/upload/import")
        .set("Authorization", `Bearer ${org1Token}`)
        .send({
          rows: mixedRows,
          mapping: testMapping,
          sourceName: "Reconciliation_Dataset.csv",
        });

      expect(importRes.status).toBe(201);
      expect(importRes.body.data.imported).toBe(3);
      expect(importRes.body.data.rejected).toBe(3);
      expect(importRes.body.data.duplicates).toBe(1);

      const batchId = importRes.body.data.batchId;

      // 3. Verify database persistence matches accepted count
      const persistedTxns = await prisma.transaction.findMany({
        where: {
          organizationId: org1Id,
          batchId: batchId,
        },
      });

      expect(persistedTxns.length).toBe(3);
      const insertedIds = persistedTxns.map((t) => t.transactionId);
      expect(insertedIds).toContain("RC-TXN-001");
      expect(insertedIds).toContain("RC-TXN-002");
      expect(insertedIds).toContain("RC-TXN-003");
      expect(insertedIds).not.toContain("RC-TXN-005");
      expect(insertedIds).not.toContain("RC-TXN-006");
    });
  });
});
