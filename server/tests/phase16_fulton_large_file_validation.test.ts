import fs from "fs";
import readline from "readline";
import request from "supertest";
import { describe, it, expect, beforeAll } from "vitest";
import app from "../src/app";

describe("Phase 16 — Universal Payment Status Normalization & Massive Dataset Validation", () => {
  let token: string;
  let allRows: Record<string, string>[] = [];
  const csvPath = "C:\\Users\\rajsa\\Downloads\\Vendor_Payments_20261007.csv";

  const mapping: Record<string, string> = {
    transaction_id: "Vendor Invoice Number",
    supplier_id: "Vendor Code",
    supplier_name: "Vendor Legal Name",
    buyer_id: "Department Code",
    buyer_name: "Department Name",
    invoice_amount: "Amount",
    invoice_date: "Vendor Invoice Date",
    payment_date: "Disbursement Date",
    payment_status: "Check Status",
    document_id: "Check Number",
  };

  function parseCsvLine(line: string): string[] {
    const result: string[] = [];
    let cur = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === "," && !inQuotes) {
        result.push(cur);
        cur = "";
      } else {
        cur += char;
      }
    }
    result.push(cur);
    return result;
  }

  beforeAll(async () => {
    // 1. Authenticate
    const loginRes = await request(app)
      .post("/api/auth/login")
      .send({ email: "demo@nexuscfr.in", password: "demo1234" });

    expect(loginRes.status).toBe(200);
    token = loginRes.body.data.token;

    // 2. Read raw CSV
    if (fs.existsSync(csvPath)) {
      const fileStream = fs.createReadStream(csvPath, { encoding: "utf8" });
      const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

      let headers: string[] | null = null;
      for await (const line of rl) {
        if (!line.trim()) continue;
        if (!headers) {
          headers = parseCsvLine(line).map((h) => h.trim());
        } else {
          const parts = parseCsvLine(line);
          const row: Record<string, string> = {};
          for (let i = 0; i < headers.length; i++) {
            row[headers[i]!] = (parts[i] || "").trim();
          }
          allRows.push(row);
        }
      }
    }
  }, 60000);

  // --------------------------------------------------------------------------
  // TEST A: 100 rows
  // --------------------------------------------------------------------------
  it("Test A: 100 rows succeeds with valid scorecard", async () => {
    const rows = allRows.slice(0, 100);
    expect(rows.length).toBe(100);

    const res = await request(app)
      .post("/api/upload/validate")
      .set("Authorization", `Bearer ${token}`)
      .send({ rows, mapping });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.scorecard.totalRecords).toBe(100);
    expect(res.body.data.scorecard.acceptedCount).toBeGreaterThan(0);
  });

  // --------------------------------------------------------------------------
  // TEST B: 5,000 rows
  // --------------------------------------------------------------------------
  it("Test B: 5,000 rows succeeds with valid scorecard", async () => {
    const rows = allRows.slice(0, 5000);
    expect(rows.length).toBe(5000);

    const res = await request(app)
      .post("/api/upload/validate")
      .set("Authorization", `Bearer ${token}`)
      .send({ rows, mapping });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.scorecard.totalRecords).toBe(5000);
    expect(res.body.data.scorecard.acceptedCount).toBeGreaterThan(0);
  });

  // --------------------------------------------------------------------------
  // TEST C: 50,000 rows (previously failed with 500 too many bind variables)
  // --------------------------------------------------------------------------
  it("Test C: 50,000 rows succeeds without PostgreSQL bind variable overflow", async () => {
    const rows = allRows.slice(0, 50000);
    expect(rows.length).toBe(50000);

    const res = await request(app)
      .post("/api/upload/validate")
      .set("Authorization", `Bearer ${token}`)
      .send({ rows, mapping });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.scorecard.totalRecords).toBe(50000);
    expect(res.body.data.scorecard.acceptedCount).toBeGreaterThan(0);
  }, 30000);

  // --------------------------------------------------------------------------
  // TEST D: Full 228,425 rows
  // --------------------------------------------------------------------------
  it("Test D: Full 228,425 rows succeeds without truncation or memory overflow", async () => {
    expect(allRows.length).toBe(228425);

    const res = await request(app)
      .post("/api/upload/validate")
      .set("Authorization", `Bearer ${token}`)
      .send({ rows: allRows, mapping });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.scorecard.totalRecords).toBe(228425);
    expect(res.body.data.scorecard.acceptedCount).toBeGreaterThan(150000);
    // Ensure safe serialized payload
    expect(res.body.data.rowResults.length).toBeLessThanOrEqual(500);
  }, 120000);
});
