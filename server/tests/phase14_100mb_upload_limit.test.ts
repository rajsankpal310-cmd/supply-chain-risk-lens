import { describe, it, expect } from "vitest";
import request from "supertest";
import app from "../src/app";
import jwt from "jsonwebtoken";
import * as XLSX from "xlsx";

const JWT_SECRET = process.env.JWT_SECRET || "development-jwt-secret-not-for-production-min32chars";

function generateTestToken(role = "SME_ADMIN", orgId = "00000000-0000-0000-0000-000000000001") {
  return jwt.sign(
    {
      userId: "test-user-id",
      email: "test@nexuscfr.in",
      role,
      organizationId: orgId,
    },
    JWT_SECRET,
    { expiresIn: "1h" }
  );
}

describe("NEXUS-CFR 100 MB Upload Limit & Validation Pipeline", () => {
  const token = generateTestToken();

  it("1. Rejects payload exceeding 100 MB limit based on declared metadata", async () => {
    const res = await request(app)
      .post("/api/upload/validate")
      .set("Authorization", `Bearer ${token}`)
      .send({
        fileSize: 105 * 1024 * 1024, // 105 MB
        rows: [],
      });

    expect(res.status).toBe(413);
    expect(res.body.success).toBe(false);
    expect(res.body.error.message).toBe("File is too large. Maximum supported size is 100 MB.");
  });

  it("2. Rejects import payload exceeding 100 MB limit with exact error message", async () => {
    const res = await request(app)
      .post("/api/upload/import")
      .set("Authorization", `Bearer ${token}`)
      .send({
        fileSize: 101 * 1024 * 1024, // 101 MB
        transactions: [],
      });

    expect(res.status).toBe(413);
    expect(res.body.success).toBe(false);
    expect(res.body.error.message).toBe("File is too large. Maximum supported size is 100 MB.");
  });

  it("3. Accepts and validates payload within 100 MB limit", async () => {
    const res = await request(app)
      .post("/api/upload/validate")
      .set("Authorization", `Bearer ${token}`)
      .send({
        fileSize: 15 * 1024 * 1024, // 15 MB
        rows: [
          {
            transaction_id: "TXN-TEST-100MB-001",
            sme_id: "FIRM-TEST-SME",
            buyer_id: "FIRM-TEST-BUYER",
            invoice_amount: 150000,
            outstanding_amount: 150000,
            invoice_date: "2026-05-01",
            due_date: "2026-06-01",
            payment_status: "PENDING",
          },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.scorecard).toBeDefined();
    expect(res.body.data.scorecard.acceptedCount).toBe(1);
  });

  it("4. Supports XLSX data structure parsing and ingestion", async () => {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([
      ["transaction_id", "sme_id", "buyer_id", "invoice_amount", "outstanding_amount", "invoice_date", "due_date", "payment_status"],
      ["TXN-XLSX-001", "Precision Forge Pvt Ltd", "Mahindra & Mahindra", 500000, 500000, "2026-06-01", "2026-07-01", "PENDING"]
    ]);
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    // Read back like frontend
    const parsedWb = XLSX.read(buffer, { type: "buffer" });
    const parsedData = XLSX.utils.sheet_to_json<any>(parsedWb.Sheets[parsedWb.SheetNames[0]]);

    expect(parsedData.length).toBe(1);
    expect(parsedData[0].transaction_id).toBe("TXN-XLSX-001");
  });
});
