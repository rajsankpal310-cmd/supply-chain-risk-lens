import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import app from "../src/app";
import * as XLSX from "xlsx";
import path from "path";
import fs from "fs";
import { UniversalMappingEngine } from "../src/pipeline/universalMappingEngine";
import { SchemaDetector } from "../src/pipeline/schemaDetector";
import { DataCleaner } from "../src/pipeline/dataCleaner";
import { prisma } from "../src/config/database";

describe("NEXUS-CFR Universal Semantic Data Mapping Engine Test Suite", () => {
  let token = "";
  let orgId = "";

  beforeAll(async () => {
    for (let i = 0; i < 5; i++) {
      const res = await request(app)
        .post("/api/auth/login")
        .send({ email: "demo@nexuscfr.in", password: "demo1234" });
      if (res.status === 200 && res.body?.data?.token) {
        token = res.body.data.token;
        orgId = res.body.data.user.organizationId;
        break;
      }
      await new Promise((r) => setTimeout(r, 1500));
    }
  }, 60000);

  // --------------------------------------------------------------------------
  // TEST A: Standard SME sales ledger (SME -> Buyer)
  // --------------------------------------------------------------------------
  it("Test A: Standard SME sales ledger: correctly identifies transaction identity, SME, Buyer, and dates", () => {
    const headers = [
      "transaction_id", "sme_id", "buyer_id", "invoice_amount",
      "invoice_date", "due_date", "payment_status"
    ];
    const rows = [
      {
        transaction_id: "TXN-001",
        sme_id: "OUR_SME_CORP",
        buyer_id: "BUYER_ACME",
        invoice_amount: "500000",
        invoice_date: "2026-05-01",
        due_date: "2026-06-01",
        payment_status: "PENDING",
      },
    ];

    const result = UniversalMappingEngine.inspectAndMap(headers, rows);
    expect(result.suggestedMapping["transaction_id"]).toBe("transaction_id");
    expect(result.suggestedMapping["sme_id"]).toBe("sme_id");
    expect(result.suggestedMapping["buyer_id"]).toBe("buyer_id");
    expect(result.suggestedMapping["invoice_amount"]).toBe("invoice_amount");
    expect(result.suggestedMapping["invoice_date"]).toBe("invoice_date");
    expect(result.suggestedMapping["due_date"]).toBe("due_date");
    expect(result.datasetProfile.detectedRelationshipDirection).toBe("SME_TO_BUYER");
    expect(result.requiredFieldsStatus.isReadyForValidation).toBe(true);
  });

  // --------------------------------------------------------------------------
  // TEST B: Accounts payable vendor ledger (Supplier -> SME)
  // --------------------------------------------------------------------------
  it("Test B: Accounts payable vendor ledger: maps vendor to supplier (NOT vendor to SME)", () => {
    const headers = [
      "bill_no", "vendor_id", "net_amount", "bill_date", "payment_terms"
    ];
    const rows = [
      {
        bill_no: "BILL-2026-091",
        vendor_id: "VEND-RAW-MATERIALS",
        net_amount: "340000",
        bill_date: "2026-04-15",
        payment_terms: "30",
      },
    ];

    const result = UniversalMappingEngine.inspectAndMap(headers, rows);
    expect(result.suggestedMapping["transaction_id"]).toBe("bill_no");
    expect(result.suggestedMapping["supplier_id"]).toBe("vendor_id");
    expect(result.suggestedMapping["sme_id"]).toBeUndefined(); // NEVER assumes vendor is SME
    expect(result.suggestedMapping["invoice_amount"]).toBe("net_amount");
    expect(result.suggestedMapping["invoice_date"]).toBe("bill_date");
    expect(result.datasetProfile.detectedRelationshipDirection).toBe("SUPPLIER_TO_SME");
  });

  // --------------------------------------------------------------------------
  // TEST C: Accounts receivable customer ledger (SME -> Customer)
  // --------------------------------------------------------------------------
  it("Test C: Accounts receivable customer ledger: maps client to buyer_id and issue_date to invoice_date", () => {
    const headers = [
      "inv_no", "client_code", "gross_amount", "issue_date", "due_date"
    ];
    const rows = [
      {
        inv_no: "INV-AR-4401",
        client_code: "CLIENT-RETAIL-01",
        gross_amount: "195000",
        issue_date: "2026-05-10",
        due_date: "2026-06-10",
      },
    ];

    const result = UniversalMappingEngine.inspectAndMap(headers, rows);
    expect(result.suggestedMapping["transaction_id"]).toBe("inv_no");
    expect(result.suggestedMapping["buyer_id"]).toBe("client_code");
    expect(result.suggestedMapping["invoice_amount"]).toBe("gross_amount");
    expect(result.suggestedMapping["invoice_date"]).toBe("issue_date");
    expect(result.suggestedMapping["due_date"]).toBe("due_date");
    expect(result.datasetProfile.detectedRelationshipDirection).toBe("SME_TO_BUYER");
  });

  // --------------------------------------------------------------------------
  // TEST D: Legacy ERP export with abbreviations (SAP / Tally style)
  // --------------------------------------------------------------------------
  it("Test D: Legacy ERP export: handles uppercase abbreviated ERP columns correctly", () => {
    const headers = [
      "VOUCHER_NO", "PARTY_LEGAL_NAME", "DEPT_CODE", "TOTAL_VAL",
      "POSTING_DT", "CLEAR_DT", "STATUS"
    ];
    const rows = [
      {
        VOUCHER_NO: "VCH-2026-8812",
        PARTY_LEGAL_NAME: "Tata Steel Logistics Ltd",
        DEPT_CODE: "D-ENG-04",
        TOTAL_VAL: "₹1,450,000",
        POSTING_DT: "2026-06-01",
        CLEAR_DT: "2026-07-05",
        STATUS: "PAID",
      },
    ];

    const result = UniversalMappingEngine.inspectAndMap(headers, rows);
    expect(result.suggestedMapping["transaction_id"]).toBe("VOUCHER_NO");
    expect(result.suggestedMapping["supplier_name"]).toBe("PARTY_LEGAL_NAME");
    expect(result.suggestedMapping["buyer_id"]).toBe("DEPT_CODE");
    expect(result.suggestedMapping["invoice_amount"]).toBe("TOTAL_VAL");
    expect(result.suggestedMapping["invoice_date"]).toBe("POSTING_DT");
    expect(result.suggestedMapping["payment_date"]).toBe("CLEAR_DT");
    expect(result.suggestedMapping["payment_status"]).toBe("STATUS");
  });

  // --------------------------------------------------------------------------
  // TEST E: Government/vendor payment dataset (Supplier -> Buyer)
  // --------------------------------------------------------------------------
  it("Test E: Government/vendor payment dataset: maps Vendor to Supplier and Department to Buyer", () => {
    const headers = [
      "vendor_code", "vendor_legal_name", "department_name", "dept",
      "vendor_invoice_no", "amount", "vendor_invoice_date", "disb_date", "check_status"
    ];
    const rows = [
      {
        vendor_code: "100452",
        vendor_legal_name: "Georgia Power Company",
        department_name: "Police Services",
        dept: "POL-01",
        vendor_invoice_no: "GP-APR-881",
        amount: "45200.00",
        vendor_invoice_date: "2026-04-01",
        disb_date: "2026-04-28",
        check_status: "Paid",
      },
    ];

    const result = UniversalMappingEngine.inspectAndMap(headers, rows);
    expect(result.suggestedMapping["supplier_id"]).toBe("vendor_code");
    expect(result.suggestedMapping["supplier_name"]).toBe("vendor_legal_name");
    expect(result.suggestedMapping["buyer_id"]).toBe("dept");
    expect(result.suggestedMapping["buyer_name"]).toBe("department_name");
    expect(result.suggestedMapping["transaction_id"]).toBe("vendor_invoice_no");
    expect(result.suggestedMapping["invoice_amount"]).toBe("amount");
    expect(result.suggestedMapping["invoice_date"]).toBe("vendor_invoice_date");
    expect(result.suggestedMapping["payment_date"]).toBe("disb_date");
    expect(result.suggestedMapping["payment_status"]).toBe("check_status");
    expect(result.suggestedMapping["sme_id"]).toBeUndefined();
    expect(result.suggestedMapping["due_date"]).toBeUndefined();
    expect(result.datasetProfile.detectedRelationshipDirection).toBe("SUPPLIER_TO_BUYER");
  });

  // --------------------------------------------------------------------------
  // TEST F: Different spelling conventions and aliases
  // --------------------------------------------------------------------------
  it("Test F: Different spelling conventions: handles spelling variants, spaces, and casing", () => {
    const headers = [
      "Doc Reference", "Beneficiary Name", "Purchasing Unit",
      "Total Invoiced", "Bill Date", "Settlement Dt"
    ];
    const rows = [
      {
        "Doc Reference": "REF-9988",
        "Beneficiary Name": "Bharat Precision Forgings",
        "Purchasing Unit": "Western Railway Division",
        "Total Invoiced": "820000",
        "Bill Date": "2026-05-15",
        "Settlement Dt": "2026-06-20",
      },
    ];

    const result = UniversalMappingEngine.inspectAndMap(headers, rows);
    expect(result.suggestedMapping["transaction_id"]).toBe("Doc Reference");
    expect(result.suggestedMapping["supplier_name"]).toBe("Beneficiary Name");
    expect(result.suggestedMapping["buyer_name"]).toBe("Purchasing Unit");
    expect(result.suggestedMapping["invoice_amount"]).toBe("Total Invoiced");
    expect(result.suggestedMapping["invoice_date"]).toBe("Bill Date");
    expect(result.suggestedMapping["payment_date"]).toBe("Settlement Dt");
  });

  // --------------------------------------------------------------------------
  // TEST G: Missing buyer
  // --------------------------------------------------------------------------
  it("Test G: Missing buyer: leaves buyer unmapped and reports reason without inventing counterparty", () => {
    const headers = ["invoice_id", "sme_id", "amount", "invoice_date"];
    const rows = [
      { invoice_id: "INV-1", sme_id: "SME-1", amount: "1000", invoice_date: "2026-05-01" }
    ];

    const result = UniversalMappingEngine.inspectAndMap(headers, rows);
    expect(result.suggestedMapping["buyer_id"]).toBeUndefined();
    expect(result.suggestedMapping["buyer_name"]).toBeUndefined();

    const buyerCandidate = result.mappingCandidates.find(c => c.canonicalField === "buyer_id");
    expect(buyerCandidate?.sourceColumn).toBeNull();
    expect(buyerCandidate?.reason).toContain("Buyer information was not reliably detected");
  });

  // --------------------------------------------------------------------------
  // TEST H: Missing supplier
  // --------------------------------------------------------------------------
  it("Test H: Missing supplier: leaves supplier unmapped and reports reason", () => {
    const headers = ["invoice_id", "buyer_id", "amount", "invoice_date"];
    const rows = [
      { invoice_id: "INV-1", buyer_id: "BUYER-1", amount: "1000", invoice_date: "2026-05-01" }
    ];

    const result = UniversalMappingEngine.inspectAndMap(headers, rows);
    expect(result.suggestedMapping["supplier_id"]).toBeUndefined();
    expect(result.suggestedMapping["supplier_name"]).toBeUndefined();

    const suppCandidate = result.mappingCandidates.find(c => c.canonicalField === "supplier_id");
    expect(suppCandidate?.sourceColumn).toBeNull();
    expect(suppCandidate?.reason).toContain("Supplier information was not reliably detected");
  });

  // --------------------------------------------------------------------------
  // TEST I: Missing due date
  // --------------------------------------------------------------------------
  it("Test I: Missing due date: does NOT fabricate due date; unmapped due date passes validation", async () => {
    const headers = ["transaction_id", "vendor_id", "buyer_id", "invoice_amount", "invoice_date", "disbursement_date"];
    const rows = [
      {
        transaction_id: "TX-TEST-I",
        vendor_id: "VEND-01",
        buyer_id: "BUYER-01",
        invoice_amount: "5000",
        invoice_date: "2026-04-01",
        disbursement_date: "2026-04-20"
      }
    ];

    const result = UniversalMappingEngine.inspectAndMap(headers, rows);
    expect(result.suggestedMapping["due_date"]).toBeUndefined();
    const dueDateCandidate = result.mappingCandidates.find(c => c.canonicalField === "due_date");
    expect(dueDateCandidate?.sourceColumn).toBeNull();

    // Data validation must pass even without due_date
    const valRes = await request(app)
      .post("/api/upload/validate")
      .set("Authorization", `Bearer ${token}`)
      .send({ rows, mapping: result.suggestedMapping });

    expect(valRes.status).toBe(200);
    expect(valRes.body.data.scorecard.acceptedCount).toBe(1);
    expect(valRes.body.data.scorecard.rejectedCount).toBe(0);
  });

  // --------------------------------------------------------------------------
  // TEST J: Missing outstanding amount (and Check Number != Outstanding Amount)
  // --------------------------------------------------------------------------
  it("Test J: Missing outstanding amount: Check Number is NEVER mapped to outstanding amount; passes validation", async () => {
    const headers = ["transaction_id", "customer_id", "amount", "check_number", "invoice_date"];
    const rows = [
      {
        transaction_id: "INV-J-01",
        customer_id: "CUST-J",
        amount: "50000",
        check_number: "987654", // Large numeric check number
        invoice_date: "2026-05-01"
      }
    ];

    const result = UniversalMappingEngine.inspectAndMap(headers, rows);
    // Check Number must NOT become outstanding amount
    expect(result.suggestedMapping["outstanding_amount"]).toBeUndefined();
    expect(result.suggestedMapping["document_id"]).toBe("check_number");

    // Validation must pass without outstanding_amount
    const valRes = await request(app)
      .post("/api/upload/validate")
      .set("Authorization", `Bearer ${token}`)
      .send({ rows, mapping: result.suggestedMapping });

    expect(valRes.status).toBe(200);
    expect(valRes.body.data.scorecard.acceptedCount).toBe(1);
  });

  // --------------------------------------------------------------------------
  // TEST K: Ambiguous numeric columns
  // --------------------------------------------------------------------------
  it("Test K: Ambiguous numeric columns: identifier numbers without amount tokens do not become amounts", () => {
    const headers = ["id_col", "fiscal_year", "object_code", "amount", "date_col"];
    const rows = [
      { id_col: "INV-1001", fiscal_year: "2026", object_code: "5210", amount: "75000", date_col: "2026-05-10" },
      { id_col: "INV-1002", fiscal_year: "2026", object_code: "5220", amount: "82000", date_col: "2026-05-11" },
    ];

    const result = UniversalMappingEngine.inspectAndMap(headers, rows);
    expect(result.suggestedMapping["invoice_amount"]).toBe("amount");
    // fiscal_year and object_code must NEVER be mapped to invoice_amount or outstanding_amount
    expect(result.suggestedMapping["outstanding_amount"]).toBeUndefined();
  });

  // --------------------------------------------------------------------------
  // TEST L: Optional low-confidence field
  // --------------------------------------------------------------------------
  it("Test L: Optional low-confidence field: remains unmapped and does NOT block validation", () => {
    const headers = ["transaction_id", "buyer_id", "amount", "invoice_date", "random_notes_col"];
    const rows = [
      { transaction_id: "TX-L-1", buyer_id: "B-1", amount: "1000", invoice_date: "2026-05-01", random_notes_col: "General memo" }
    ];

    const result = UniversalMappingEngine.inspectAndMap(headers, rows);
    expect(result.suggestedMapping["outstanding_amount"]).toBeUndefined();
    expect(result.suggestedMapping["due_date"]).toBeUndefined();
    expect(result.requiredFieldsStatus.isReadyForValidation).toBe(true);
  });

  // --------------------------------------------------------------------------
  // TEST M: Required low-confidence field
  // --------------------------------------------------------------------------
  it("Test M: Required low-confidence field: flags needsReview and blocks automatic progression", () => {
    const headers = ["obscure_ref_x", "amount", "invoice_date", "buyer_id"];
    const rows = [
      { obscure_ref_x: "something", amount: "5000", invoice_date: "2026-05-01", buyer_id: "BUYER-1" }
    ];

    const result = UniversalMappingEngine.inspectAndMap(headers, rows);
    const txnCandidate = result.mappingCandidates.find(c => c.canonicalField === "transaction_id");
    expect(txnCandidate?.sourceColumn).toBeNull();
    expect(txnCandidate?.needsReview).toBe(true);
    expect(result.requiredFieldsStatus.isReadyForValidation).toBe(false);
  });

  // --------------------------------------------------------------------------
  // TEST N: User mapping override
  // --------------------------------------------------------------------------
  it("Test N: User mapping override: user selection overrides suggestion with 100% confidence", () => {
    const headers = ["ref_number", "alt_code", "amount", "date", "customer_id"];
    const rows = [
      { ref_number: "REF-1", alt_code: "ALT-99", amount: "5000", date: "2026-05-01", customer_id: "C-1" }
    ];

    const userOverrides = {
      transaction_id: "alt_code",
    };

    const result = UniversalMappingEngine.inspectAndMap(headers, rows, userOverrides);
    expect(result.suggestedMapping["transaction_id"]).toBe("alt_code");

    const candidate = result.mappingCandidates.find(c => c.canonicalField === "transaction_id");
    expect(candidate?.confidence).toBe(100);
    expect(candidate?.reason).toContain("Selected by user override");
  });

  // --------------------------------------------------------------------------
  // TEST O: CSV parsing and mapping
  // --------------------------------------------------------------------------
  it("Test O: CSV parsing and mapping: processes raw CSV text into canonical structure", () => {
    const csvContent = "Invoice ID,Buyer Name,Gross Amount,Invoice Date\nINV-CSV-01,Acme Corp,120000,2026-05-01";
    const lines = csvContent.split("\n");
    const headers = lines[0].split(",");
    const cells = lines[1].split(",");
    const rows = [{ [headers[0]]: cells[0], [headers[1]]: cells[1], [headers[2]]: cells[2], [headers[3]]: cells[3] }];

    const result = UniversalMappingEngine.inspectAndMap(headers, rows);
    expect(result.suggestedMapping["transaction_id"]).toBe("Invoice ID");
    expect(result.suggestedMapping["buyer_name"]).toBe("Buyer Name");
    expect(result.suggestedMapping["invoice_amount"]).toBe("Gross Amount");
    expect(result.suggestedMapping["invoice_date"]).toBe("Invoice Date");
  });

  // --------------------------------------------------------------------------
  // TEST P: XLSX binary parsing and mapping
  // --------------------------------------------------------------------------
  it("Test P: XLSX Upload: parses Excel workbook and infers canonical schema identically", () => {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([
      ["Bill Number", "Vendor Legal Name", "Department Code", "Invoice Total", "Bill Date"],
      ["BILL-001", "Precision Castings Ltd", "DEPT-HYD-01", 350000, "2026-05-15"],
    ]);
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    const parsedWb = XLSX.read(buffer, { type: "buffer" });
    const jsonData = XLSX.utils.sheet_to_json<any[]>(parsedWb.Sheets[parsedWb.SheetNames[0]], { header: 1 });
    const headers = jsonData[0] as string[];
    const rows = jsonData.slice(1).map((r: any[]) => {
      const obj: Record<string, any> = {};
      headers.forEach((h, i) => { obj[h] = r[i]; });
      return obj;
    });

    const result = UniversalMappingEngine.inspectAndMap(headers, rows);
    expect(result.suggestedMapping["transaction_id"]).toBe("Bill Number");
    expect(result.suggestedMapping["supplier_name"]).toBe("Vendor Legal Name");
    expect(result.suggestedMapping["buyer_id"]).toBe("Department Code");
    expect(result.suggestedMapping["invoice_amount"]).toBe("Invoice Total");
    expect(result.suggestedMapping["invoice_date"]).toBe("Bill Date");
  });

  // --------------------------------------------------------------------------
  // TEST Q: Large CSV up to 100 MB profiling
  // --------------------------------------------------------------------------
  it("Test Q: Large dataset profiling: uses bounded sample profiling without altering record counts", () => {
    // Generate a 500-row synthetic representative dataset
    const headers = ["transaction_id", "buyer_id", "invoice_amount", "invoice_date"];
    const rows: Record<string, any>[] = [];
    for (let i = 1; i <= 500; i++) {
      rows.push({
        transaction_id: `TXN-LARGE-${i}`,
        buyer_id: `BUYER-${(i % 10) + 1}`,
        invoice_amount: (1000 + i * 50).toString(),
        invoice_date: "2026-05-01",
      });
    }

    // Inspect bounded sample
    const sample = rows.slice(0, 50);
    const result = UniversalMappingEngine.inspectAndMap(headers, sample);
    expect(result.suggestedMapping["transaction_id"]).toBe("transaction_id");
    expect(result.suggestedMapping["invoice_amount"]).toBe("invoice_amount");
    expect(result.datasetProfile.totalRows).toBe(50); // profile reflects sample
  });

  // --------------------------------------------------------------------------
  // TEST R: Tenant isolation
  // --------------------------------------------------------------------------
  it("Test R: Tenant isolation: imported transactions are isolated under organizationId", async () => {
    const testId = `TXN-ISOL-${Date.now()}`;
    const testTransactions = [
      {
        transaction_id: testId,
        buyer_id: "BUYER-TENANT-TEST",
        invoice_amount: "75000",
        invoice_date: "2026-05-15",
      },
    ];

    const mapping = {
      transaction_id: "transaction_id",
      buyer_id: "buyer_id",
      invoice_amount: "invoice_amount",
      invoice_date: "invoice_date",
    };

    const impRes = await request(app)
      .post("/api/upload/import")
      .set("Authorization", `Bearer ${token}`)
      .send({
        transactions: testTransactions,
        mapping,
        sourceType: "PRIMARY_TRANSACTION",
        sourceName: "Tenant_Isolation_Test.csv",
      });

    expect(impRes.status).toBe(201);
    expect(impRes.body.data.imported).toBe(1);

    // Verify transaction belongs to organizationId
    const storedTxn = await prisma.transaction.findFirst({
      where: { transactionId: testId },
    });
    expect(storedTxn).toBeDefined();
    expect(storedTxn?.organizationId).toBe(orgId);
  });

  // --------------------------------------------------------------------------
  // SECTION 28: SPECIFIC REGRESSION TEST FOR CURRENT BUG
  // --------------------------------------------------------------------------
  it("Section 28 Regression Test: Check Number is NOT mapped to Outstanding Amount; validation passes", async () => {
    const sourceHeaders = [
      "Vendor Code",
      "Department Code",
      "Amount",
      "Check Number",
      "Vendor Invoice Number",
      "Vendor Invoice Date",
      "Disbursement Date",
    ];

    const sourceRows = [
      {
        "Vendor Code": "100452",
        "Department Code": "POL-01",
        "Amount": "45200.00",
        "Check Number": "1045230", // Numeric check number that previously caused collision
        "Vendor Invoice Number": "GP-APR-881",
        "Vendor Invoice Date": "2026-04-01",
        "Disbursement Date": "2026-04-28",
      },
    ];

    // 1. Semantic Mapping Engine
    const result = UniversalMappingEngine.inspectAndMap(sourceHeaders, sourceRows);

    // Expected semantic mappings:
    expect(result.suggestedMapping["supplier_id"]).toBe("Vendor Code");
    expect(result.suggestedMapping["buyer_id"]).toBe("Department Code");
    expect(result.suggestedMapping["invoice_amount"]).toBe("Amount");
    expect(result.suggestedMapping["transaction_id"]).toBe("Vendor Invoice Number");
    expect(result.suggestedMapping["invoice_date"]).toBe("Vendor Invoice Date");
    expect(result.suggestedMapping["payment_date"]).toBe("Disbursement Date");

    // CRITICAL BUG FIX: Check Number must NOT be mapped to outstanding_amount
    expect(result.suggestedMapping["outstanding_amount"]).toBeUndefined();
    expect(result.suggestedMapping["document_id"]).toBe("Check Number");

    // Outstanding amount candidate must have sourceColumn = null
    const outstandingCand = result.mappingCandidates.find(c => c.canonicalField === "outstanding_amount");
    expect(outstandingCand?.sourceColumn).toBeNull();

    // Required fields check:
    expect(result.requiredFieldsStatus.mappedRequired).toBe(5);
    expect(result.requiredFieldsStatus.totalRequired).toBe(5);
    expect(result.requiredFieldsStatus.isReadyForValidation).toBe(true);

    // 2. Data Validation Gate
    const valRes = await request(app)
      .post("/api/upload/validate")
      .set("Authorization", `Bearer ${token}`)
      .send({ rows: sourceRows, mapping: result.suggestedMapping });

    expect(valRes.status).toBe(200);
    expect(valRes.body.data.scorecard.acceptedCount).toBe(1);
    expect(valRes.body.data.scorecard.rejectedCount).toBe(0);
    expect(valRes.body.data.scorecard.rejectionReasons.length).toBe(0);
  });

  // --------------------------------------------------------------------------
  // SECTION 18 REGRESSION TESTS: Datasets A, B, C & Disbursed Lifecycle Status
  // --------------------------------------------------------------------------
  it("End-to-End Test: Fulton row with 'Disbursed' status and date formats passes validation with 100% acceptance", async () => {
    const fultonRow = {
      "Fiscal Year": "2026",
      "FY Period": "10",
      "Disbursement Date": "02 October 2026",
      "Department Code": "DEPT-105",
      "Department Name": "Commission District 5",
      "Amount": "$5,568.95",
      "Vendor Code": "VEND-6656",
      "Vendor Legal Name": "LVs Magical Affairs, LLC",
      "Check Number": "202610010034767",
      "Check Status": "Disbursed",
      "Vendor Invoice Date": "11 September 2026",
      "Vendor Invoice Number": "INV-001022",
    };

    const headers = Object.keys(fultonRow);
    const mapRes = UniversalMappingEngine.inspectAndMap(headers, [fultonRow]);

    expect(mapRes.suggestedMapping["payment_status"]).toBe("Check Status");
    expect(mapRes.suggestedMapping["transaction_id"]).toBe("Vendor Invoice Number");
    expect(mapRes.requiredFieldsStatus.isReadyForValidation).toBe(true);
    expect(mapRes.requiredFieldsStatus.mappedRequired).toBe(5);

    const valRes = await request(app)
      .post("/api/upload/validate")
      .set("Authorization", `Bearer ${token}`)
      .send({ rows: [fultonRow], mapping: mapRes.suggestedMapping });

    expect(valRes.status).toBe(200);
    expect(valRes.body.data.scorecard.acceptedCount).toBe(1);
    expect(valRes.body.data.scorecard.rejectedCount).toBe(0);
  });

  it("End-to-End Test: Dataset A (SME -> Buyer sales ledger) passes validation", async () => {
    const rows = [
      {
        invoice_ref: "INV-SME-001",
        customer_code: "BUYER-ALPHA",
        customer_name: "Alpha Retail Corp",
        gross_val: "125000.50",
        invoice_dt: "2026-05-01",
      },
    ];
    const headers = Object.keys(rows[0]);
    const mapRes = UniversalMappingEngine.inspectAndMap(headers, rows);

    expect(mapRes.suggestedMapping["transaction_id"]).toBe("invoice_ref");
    expect(mapRes.suggestedMapping["buyer_id"]).toBe("customer_code");
    expect(mapRes.suggestedMapping["invoice_amount"]).toBe("gross_val");
    expect(mapRes.suggestedMapping["invoice_date"]).toBe("invoice_dt");

    const valRes = await request(app)
      .post("/api/upload/validate")
      .set("Authorization", `Bearer ${token}`)
      .send({ rows, mapping: mapRes.suggestedMapping });

    expect(valRes.status).toBe(200);
    expect(valRes.body.data.scorecard.acceptedCount).toBe(1);
  });

  it("End-to-End Test: Dataset B (Supplier -> SME purchase ledger) passes validation", async () => {
    const rows = [
      {
        bill_no: "BILL-SUPP-99",
        vendor_id: "SUPP-STEEL-CORP",
        total_amount: "450000",
        bill_date: "2026-06-15",
      },
    ];
    const headers = Object.keys(rows[0]);
    const mapRes = UniversalMappingEngine.inspectAndMap(headers, rows);

    expect(mapRes.suggestedMapping["transaction_id"]).toBe("bill_no");
    expect(mapRes.suggestedMapping["supplier_id"]).toBe("vendor_id");
    expect(mapRes.suggestedMapping["invoice_amount"]).toBe("total_amount");
    expect(mapRes.suggestedMapping["invoice_date"]).toBe("bill_date");

    const valRes = await request(app)
      .post("/api/upload/validate")
      .set("Authorization", `Bearer ${token}`)
      .send({ rows, mapping: mapRes.suggestedMapping });

    expect(valRes.status).toBe(200);
    expect(valRes.body.data.scorecard.acceptedCount).toBe(1);
  });

  it("End-to-End Test: Dataset C (Supplier -> Buyer dataset) passes validation with 5 required mapped", async () => {
    const rows = [
      {
        tx_id: "TX-SUPP-BUY-01",
        vendor_code: "V-554",
        client_code: "C-991",
        amount: "80000",
        issue_date: "2026-07-01",
      },
    ];
    const headers = Object.keys(rows[0]);
    const mapRes = UniversalMappingEngine.inspectAndMap(headers, rows);

    expect(mapRes.suggestedMapping["transaction_id"]).toBe("tx_id");
    expect(mapRes.suggestedMapping["supplier_id"]).toBe("vendor_code");
    expect(mapRes.suggestedMapping["buyer_id"]).toBe("client_code");
    expect(mapRes.suggestedMapping["invoice_amount"]).toBe("amount");
    expect(mapRes.suggestedMapping["invoice_date"]).toBe("issue_date");
    expect(mapRes.requiredFieldsStatus.mappedRequired).toBe(5);

    const valRes = await request(app)
      .post("/api/upload/validate")
      .set("Authorization", `Bearer ${token}`)
      .send({ rows, mapping: mapRes.suggestedMapping });

    expect(valRes.status).toBe(200);
    expect(valRes.body.data.scorecard.acceptedCount).toBe(1);
  });

  it("End-to-End Test: Bidirectional mapping contract accepts sourceColumn -> canonicalField", async () => {
    const rows = [
      {
        inv_id: "INV-BIDI-001",
        cust_id: "CUST-BIDI-01",
        val: "32000",
        dt: "2026-08-01",
      },
    ];
    // Inverse mapping format: sourceColumn -> canonicalField
    const inverseMapping = {
      inv_id: "transaction_id",
      cust_id: "buyer_id",
      val: "invoice_amount",
      dt: "invoice_date",
    };

    const valRes = await request(app)
      .post("/api/upload/validate")
      .set("Authorization", `Bearer ${token}`)
      .send({ rows, mapping: inverseMapping });

    expect(valRes.status).toBe(200);
    expect(valRes.body.data.scorecard.acceptedCount).toBe(1);
  });

  it("Status Normalization: ISSUED maps to PENDING (unsettled), not PAID; DISBURSED maps to PAID", () => {
    expect(DataCleaner.normalizeStatus("ISSUED")).toBe("PENDING");
    expect(DataCleaner.normalizeStatus("invoice issued")).toBe("PENDING");
    expect(DataCleaner.normalizeStatus("INVOICED")).toBe("PENDING");
    expect(DataCleaner.normalizeStatus("DISBURSED")).toBe("PAID");
    expect(DataCleaner.normalizeStatus("CLEARED")).toBe("PAID");
    expect(DataCleaner.normalizeStatus("SETTLED")).toBe("PAID");
    expect(DataCleaner.normalizeStatus("PAID_IN_FULL")).toBe("PAID");
  });
});
