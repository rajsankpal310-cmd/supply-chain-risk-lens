import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import app from "../src/app";
import { prisma } from "../src/config/database";
import { DataCleaner } from "../src/pipeline/dataCleaner";
import { BusinessValidator } from "../src/pipeline/businessValidator";
import { QualityAnalyzer } from "../src/pipeline/qualityAnalyzer";
import { DuplicateDetector } from "../src/pipeline/duplicateDetector";
import { SmartResolutionEngine } from "../src/ml/decision/smartResolutionEngine";
import { DeadlockService } from "../src/services/deadlock.service";
import { SimulationService } from "../src/services/simulation.service";
import { formatCompanyName } from "../../src/utils/format";
import { PredictionService } from "../src/ml/prediction/predictionService";
import { LineageTracker } from "../src/ml/lineage/lineageTracker";

describe("NEXUS-CFR — Full Test Case Sheet Execution (TC-001 to TC-020)", () => {
  let authToken: string;
  let testOrgId: string;
  let testUserId: string;

  beforeAll(async () => {
    const orgSuffix = Math.random().toString(36).substring(2, 8);
    const regRes = await request(app)
      .post("/api/auth/register")
      .send({
        email: `tester-${orgSuffix}@nexus-cfr.internal`,
        password: "StrongPassword123!",
        fullName: "QA Sheet Test Officer",
        companyName: `TC Verification Corp ${orgSuffix}`,
      });

    expect(regRes.status).toBe(201);
    const authData = regRes.body.data || regRes.body;
    authToken = authData.token;
    testUserId = authData.user.id;
    testOrgId = authData.user.organizationId;
  });

  afterAll(async () => {
    // Safe cleanup of isolated test entities
    try {
      if (testOrgId) {
        await prisma.alert.deleteMany({ where: { organizationId: testOrgId } });
        await prisma.prediction.deleteMany({ where: { organizationId: testOrgId } });
        await prisma.recommendation.deleteMany({ where: { organizationId: testOrgId } });
        await prisma.deadlock.deleteMany({ where: { organizationId: testOrgId } });
        await prisma.simulationRun.deleteMany({ where: { organizationId: testOrgId } });
        await prisma.scenario.deleteMany({ where: { organizationId: testOrgId } });
        await prisma.transaction.deleteMany({ where: { organizationId: testOrgId } });
        await prisma.relationship.deleteMany({ where: { organizationId: testOrgId } });
        await prisma.firm.deleteMany({ where: { organizationId: testOrgId } });
        await prisma.importBatch.deleteMany({ where: { organizationId: testOrgId } });
        await prisma.user.deleteMany({ where: { organizationId: testOrgId } });
        await prisma.organization.deleteMany({ where: { id: testOrgId } });
      }
    } catch {
      // ignore cleanup errors on test tear-down
    }
  }, 30000);

  // ==========================================
  // SECTION A: DATA INPUT AND VALIDATION
  // ==========================================

  it("TC-001: Data Input & Validation — Standard Valid Format Ingestion", async () => {
    const validRows = [
      {
        transaction_id: "TXN-VALID-001",
        sme_id: "SME-SUPPLIER-ALPHA",
        buyer_id: "BUYER-CORP-BETA",
        invoice_amount: 250000,
        outstanding_amount: 100000,
        invoice_date: "2026-01-10",
        due_date: "2026-02-10",
        payment_status: "PENDING",
      },
      {
        transaction_id: "TXN-VALID-002",
        sme_id: "SME-SUPPLIER-ALPHA",
        buyer_id: "BUYER-CORP-BETA",
        invoice_amount: 150000,
        outstanding_amount: 0,
        invoice_date: "2026-01-15",
        due_date: "2026-02-15",
        payment_date: "2026-02-12",
        payment_status: "PAID",
      },
    ];

    const valRes = await request(app)
      .post("/api/upload/validate")
      .set("Authorization", `Bearer ${authToken}`)
      .send({ rows: validRows, mapping: {} });

    expect(valRes.status).toBe(200);
    const valData = valRes.body.data || valRes.body;
    expect(valData.scorecard.acceptedCount).toBe(2);
    expect(valData.scorecard.rejectedCount).toBe(0);
    expect(valData.scorecard.validityRate).toBe(100);

    const impRes = await request(app)
      .post("/api/upload/import")
      .set("Authorization", `Bearer ${authToken}`)
      .send({
        rows: validRows,
        mapping: {},
        sourceName: "TC001_Valid_Invoices.csv",
        datasetVersion: "v1.0.0",
      });

    expect(impRes.status).toBe(201);
    const impData = impRes.body.data || impRes.body;
    expect(impData.imported).toBe(2);
    expect(impData.rejected).toBe(0);
    expect(impData.scorecard.acceptedCount).toBe(2);
    expect(impData.scorecard.rejectedCount).toBe(0);
  });

  it("TC-002: Data Input & Validation — Missing mandatory fields", async () => {
    const invalidRows = [
      // Missing both SME and Buyer
      {
        transaction_id: "TXN-MISSING-PARTIES",
        invoice_amount: 50000,
        invoice_date: "2026-02-01",
      },
      // Conflict: SME and Buyer are same entity
      {
        transaction_id: "TXN-CONFLICT",
        sme_id: "FIRM-SAME",
        buyer_id: "FIRM-SAME",
        invoice_amount: 60000,
        invoice_date: "2026-02-01",
      },
      // Missing Invoice Amount
      {
        transaction_id: "TXN-MISSING-AMT",
        sme_id: "SME-CORP",
        buyer_id: "BUYER-CORP",
        invoice_date: "2026-02-01",
      },
      // Missing Invoice Date
      {
        transaction_id: "TXN-MISSING-DATE",
        sme_id: "SME-CORP",
        buyer_id: "BUYER-CORP",
        invoice_amount: 70000,
      },
    ];

    const cleaned = invalidRows.map((r) => DataCleaner.cleanRow(r, {}));
    const validation = BusinessValidator.validateRows(cleaned);
    const duplicates = await DuplicateDetector.checkDuplicates(testOrgId, cleaned);
    const scorecard = QualityAnalyzer.analyze(validation, duplicates);

    expect(scorecard.acceptedCount).toBe(0);
    expect(scorecard.rejectedCount).toBe(4);
    expect(scorecard.rejectionReasons.length).toBeGreaterThanOrEqual(4);
    expect(scorecard.rejectionReasons.some((r) => r.field === "sme_id" || r.field === "buyer_id")).toBe(true);
    expect(scorecard.rejectionReasons.some((r) => r.field === "invoice_amount")).toBe(true);
    expect(scorecard.rejectionReasons.some((r) => r.field === "invoice_date")).toBe(true);
  });

  it("TC-003: Data Input & Validation — Invalid amount and date sequence", async () => {
    const invalidRows = [
      // Negative amount
      {
        transaction_id: "TXN-NEG-AMT",
        sme_id: "SME-1",
        buyer_id: "BUYER-1",
        invoice_amount: -50000,
        invoice_date: "2026-01-01",
      },
      // Inverted Due Date (due date before invoice date)
      {
        transaction_id: "TXN-INV-DUE",
        sme_id: "SME-1",
        buyer_id: "BUYER-1",
        invoice_amount: 10000,
        invoice_date: "2026-03-15",
        due_date: "2026-02-15",
      },
      // Inverted Payment Date (payment date before invoice date)
      {
        transaction_id: "TXN-INV-PAY",
        sme_id: "SME-1",
        buyer_id: "BUYER-1",
        invoice_amount: 10000,
        invoice_date: "2026-04-10",
        payment_date: "2026-03-01",
        payment_status: "PAID",
      },
    ];

    const cleaned = invalidRows.map((r) => DataCleaner.cleanRow(r, {}));
    const validation = BusinessValidator.validateRows(cleaned);
    const duplicates = await DuplicateDetector.checkDuplicates(testOrgId, cleaned);
    const scorecard = QualityAnalyzer.analyze(validation, duplicates);

    expect(scorecard.acceptedCount).toBe(0);
    expect(scorecard.rejectedCount).toBe(3);
    expect(scorecard.rejectionReasons.some((r) => r.rule === "POSITIVE_AMOUNT")).toBe(true);
    expect(scorecard.rejectionReasons.some((r) => r.rule === "TEMPORAL_SEQUENCE")).toBe(true);
  });

  it("TC-004: Anonymization & Privacy — Direct identifiers & PII masking", () => {
    const rawRowWithPII = {
      transaction_id: "INV-PII-999",
      sme_id: "SME-ACME",
      buyer_id: "BUYER-GLOBAL",
      invoice_amount: 120000,
      invoice_date: "2026-02-01",
      personal_name: "Rahul Sharma",
      email: "rahul.sharma@enterprise-supplier.com",
      phone: "+919876543210",
      pan: "ABCDE1234F",
      aadhaar: "123456789012",
    };

    const cleaned = DataCleaner.cleanRow(rawRowWithPII, {});

    // Verify commercial fields are extracted cleanly
    expect(cleaned.transactionId).toBe("INV-PII-999");
    expect(cleaned.invoiceAmount).toBe(120000);

    // Verify direct personal identifiers in raw payload are anonymized/masked
    expect(cleaned.raw.email).not.toBe("rahul.sharma@enterprise-supplier.com");
    expect(cleaned.raw.email).toContain("***@");
    expect(cleaned.raw.phone).toBe("******3210");
    expect(cleaned.raw.pan).toBe("******234F");
    expect(cleaned.raw.aadhaar).toBe("******9012");
  });

  it("TC-005: Data Input & Validation — Duplicate and inconsistent records", async () => {
    const duplicateBatch = [
      {
        transaction_id: "TXN-DUP-01",
        sme_id: "SME-ALPHA",
        buyer_id: "BUYER-BETA",
        invoice_amount: 80000,
        invoice_date: "2026-01-01",
      },
      // Identical duplicate row in same payload
      {
        transaction_id: "TXN-DUP-01",
        sme_id: "SME-ALPHA",
        buyer_id: "BUYER-BETA",
        invoice_amount: 80000,
        invoice_date: "2026-01-01",
      },
    ];

    const cleaned = duplicateBatch.map((r) => DataCleaner.cleanRow(r, {}));
    const validation = BusinessValidator.validateRows(cleaned);
    const duplicates = await DuplicateDetector.checkDuplicates(testOrgId, cleaned);
    const scorecard = QualityAnalyzer.analyze(validation, duplicates);

    // One row accepted, one exact duplicate rejected
    expect(scorecard.totalRecords).toBe(2);
    expect(scorecard.acceptedCount).toBe(1);
    expect(scorecard.rejectedCount).toBe(1);
    expect(scorecard.exactDuplicateOnValidCount).toBe(1);
    expect(scorecard.totalRecords).toBe(scorecard.acceptedCount + scorecard.rejectedCount);
  });

  it("TC-018: Data Input & Validation — Empty or unsupported file handling", async () => {
    // 1. Empty payload rejected with HTTP 400
    const emptyRes = await request(app)
      .post("/api/upload/validate")
      .set("Authorization", `Bearer ${authToken}`)
      .send({ rows: [], mapping: {} });

    expect(emptyRes.status).toBe(400);
    const errObj = emptyRes.body.error;
    const errMsg = typeof errObj === "string" ? errObj : (errObj?.message || emptyRes.body.message || JSON.stringify(emptyRes.body));
    expect(errMsg).toContain("No data rows provided");

    // 2. Direct QualityAnalyzer behavior on empty dataset
    const emptyScorecard = QualityAnalyzer.analyze([], []);
    expect(emptyScorecard.totalRecords).toBe(0);
    expect(emptyScorecard.acceptedCount).toBe(0);
    expect(emptyScorecard.summaryMessage).toContain("Empty dataset provided");

    // 3. Importing 0 valid records returns 400
    const emptyImport = await request(app)
      .post("/api/upload/import")
      .set("Authorization", `Bearer ${authToken}`)
      .send({ rows: [], mapping: {} });

    expect(emptyImport.status).toBe(400);
  });

  // ==========================================
  // SECTION B: PAYMENT-RISK PREDICTION
  // ==========================================

  it("TC-006: Payment-Risk Prediction — High-risk pattern", () => {
    // High risk context: chronic overdue delay and high risk score
    const highRiskContext = {
      entityId: "FIRM-HIGH-RISK",
      entityName: "Chronic Late Payers Ltd",
      riskScore: 78,
      riskBand: "HIGH" as const,
      predictedLatencyDays: 48,
      domain: "INDIAN_SME_B2B",
    };

    const result = SmartResolutionEngine.generateRecommendations(highRiskContext);
    expect(result.riskBand).toBe("HIGH");
    expect(result.recommendations.length).toBeGreaterThan(0);
    const paymentPrio = result.recommendations.find((r) => r.actionType === "PAYMENT_PRIORITIZATION");
    expect(paymentPrio).toBeDefined();
    expect(paymentPrio?.triggerCondition).toContain("exceeds critical threshold");
    expect(paymentPrio?.confidenceScore).toBeGreaterThanOrEqual(0.8);
  });

  it("TC-007: Payment-Risk Prediction — Low-risk pattern", () => {
    // Low risk context: on-time settlements, minimal delay
    const lowRiskContext = {
      entityId: "FIRM-LOW-RISK",
      entityName: "Punctual Settlers Pvt Ltd",
      riskScore: 18,
      riskBand: "LOW" as const,
      predictedLatencyDays: 2,
      domain: "INDIAN_SME_B2B",
    };

    const result = SmartResolutionEngine.generateRecommendations(lowRiskContext);
    expect(result.riskBand).toBe("LOW");
    // Should NOT propose severe emergency payment prioritization or emergency financing
    const paymentPrio = result.recommendations.find((r) => r.actionType === "PAYMENT_PRIORITIZATION");
    expect(paymentPrio).toBeUndefined();
  });

  it("TC-008: Payment-Risk Prediction — Insufficient history handling", () => {
    // Prediction request with zero historical buyer transactions
    const predictionReq = {
      organizationId: testOrgId,
      invoice: {
        id: "INV-NEW-BUYER-01",
        invoiceNumber: "INV-NEW-BUYER-01",
        organizationId: testOrgId,
        buyerId: "BUYER-BRAND-NEW",
        invoiceAmount: 50000,
        invoiceDate: "2026-03-01",
        dueDate: "2026-03-31",
      },
      historicalTransactions: [], // Empty history
      targetId: "PAYMENT_DELAY_RISK",
    };

    // When allowFallback = true, PredictionService generates fallback prediction with explicit non-ML disclaimer
    const fallback = PredictionService.predictInvoice(predictionReq, true);
    expect(fallback.isModelPrediction).toBe(false);
    expect(fallback.inferenceType).toBe("NON_ML_FALLBACK");
    expect(fallback.status).toBe("ML_UNAVAILABLE");
    expect(fallback.policyNotice).toBe("NOT_FOR_PRODUCTION_DECISIONING");
  });

  // ==========================================
  // SECTION C: SUPPLY-CHAIN GRAPH
  // ==========================================

  it("TC-009: Supply-Chain Graph — Graph rendering from authorized tenant data", async () => {
    // Create test firms and relationships
    const firmA = await prisma.firm.create({
      data: {
        id: `FIRM-GRAPH-A-${Date.now()}`,
        name: "Apex Precision Components",
        organizationId: testOrgId,
        industry: "Automotive",
        city: "Pune",
        riskScore: 35,
        riskLevel: "LOW",
      },
    });

    const firmB = await prisma.firm.create({
      data: {
        id: `FIRM-GRAPH-B-${Date.now()}`,
        name: "Bharat Assembly Works",
        organizationId: testOrgId,
        industry: "Manufacturing",
        city: "Mumbai",
        riskScore: 55,
        riskLevel: "MEDIUM",
      },
    });

    const rel = await prisma.relationship.create({
      data: {
        id: `REL-${Date.now()}`,
        organizationId: testOrgId,
        sourceFirmId: firmA.id,
        targetFirmId: firmB.id,
        type: "SUPPLIES_TO",
        dependencyLevel: 0.8,
        criticality: "HIGH",
        avgTransactionValue: 450000,
      },
    });

    const res = await request(app)
      .get("/api/network/graph")
      .set("Authorization", `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    const graphData = res.body.data || res.body;
    expect(graphData.nodes).toBeDefined();
    expect(graphData.edges).toBeDefined();
    expect(Array.isArray(graphData.nodes)).toBe(true);
    expect(Array.isArray(graphData.edges)).toBe(true);
  });

  it("TC-010: Supply-Chain Graph — Node selection & company name mapping", () => {
    // Test formatCompanyName utility for sanitized names and fallback handling
    const resolvedNormal = formatCompanyName("Tata Steel Processing", "Tata Steel Processing", "FIRM-101");
    expect(resolvedNormal).toBe("Tata Steel Processing");

    // Raw ID as name should fallback to clean label
    const resolvedRawId = formatCompanyName("FIRM-A-01", "Acme Motors", "FIRM-A-01");
    expect(resolvedRawId).toBe("Acme Motors");

    // Empty name should fallback cleanly
    const resolvedEmpty = formatCompanyName("", "Apex Engineering", "FIRM-202");
    expect(resolvedEmpty).toBe("Apex Engineering");
  });

  // ==========================================
  // SECTION D: CASCADE-RISK SIMULATION
  // ==========================================

  it("TC-011: Cascade-Risk Simulation — High-risk shock propagation", async () => {
    const firm = await prisma.firm.findFirst({ where: { organizationId: testOrgId } });
    expect(firm).toBeDefined();

    const simulationResult = await SimulationService.runSimulation(testOrgId, {
      name: "High Delay Shock Test",
      affectedFirmId: firm!.id,
      severity: "HIGH",
      delayDays: 45,
    });

    expect(simulationResult).toBeDefined();
    expect(simulationResult.result).toBeDefined();
    expect(simulationResult.result.affectedNodeCount).toBeGreaterThanOrEqual(1);
    expect(simulationResult.result.potentialDefaults).toBeGreaterThanOrEqual(0);
    expect(typeof simulationResult.result.expectedLoss).toBe("number");
  });

  it("TC-012: Cascade-Risk Simulation — Low-impact scenario validation", async () => {
    const firm = await prisma.firm.findFirst({ where: { organizationId: testOrgId } });
    expect(firm).toBeDefined();

    const simulationResult = await SimulationService.runSimulation(testOrgId, {
      name: "Zero Delay Control Test",
      affectedFirmId: firm!.id,
      severity: "LOW",
      delayDays: 0,
    });

    expect(simulationResult).toBeDefined();
    expect(simulationResult.result).toBeDefined();
    expect(simulationResult.result.cascadeProbability).toBeLessThanOrEqual(50);
  });

  // ==========================================
  // SECTION E: RECOMMENDATIONS
  // ==========================================

  it("TC-014: Recommendations — High-risk case generates proportionate interventions", () => {
    const highRisk = SmartResolutionEngine.generateRecommendations({
      entityId: "FIRM-HIGH-DEP",
      riskScore: 72,
      predictedLatencyDays: 38,
      concentrationHHI: 0.55,
      domain: "ENTERPRISE_P2P",
      riskBand: "HIGH",
    });

    expect(highRisk.recommendations.some((r) => r.actionType === "PAYMENT_PRIORITIZATION")).toBe(true);
    expect(highRisk.recommendations.some((r) => r.actionType === "SUPPLIER_DIVERSIFICATION")).toBe(true);
  });

  it("TC-015: Recommendations — Low-risk case avoids unnecessary severe interventions", () => {
    const lowRisk = SmartResolutionEngine.generateRecommendations({
      entityId: "FIRM-STABLE",
      riskScore: 22,
      predictedLatencyDays: 5,
      concentrationHHI: 0.15,
      domain: "INDIAN_SME_B2B",
      riskBand: "LOW",
    });

    expect(lowRisk.recommendations.some((r) => r.actionType === "PAYMENT_PRIORITIZATION")).toBe(false);
    expect(lowRisk.recommendations.some((r) => r.actionType === "SUPPLIER_DIVERSIFICATION")).toBe(false);
  });

  // ==========================================
  // SECTION F: DASHBOARD AND REPORTING
  // ==========================================

  it("TC-016: Dashboard & Reporting — KPI totals reconciliation", async () => {
    const res = await request(app)
      .get("/api/dashboard/summary")
      .set("Authorization", `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    const body = res.body.data || res.body;

    expect(Array.isArray(body.kpis)).toBe(true);
    expect(body.kpis.length).toBeGreaterThan(0);
    const outstandingKpi = body.kpis.find((k: any) => k.key === "outstanding");
    expect(outstandingKpi).toBeDefined();
    expect(typeof outstandingKpi.rawValue).toBe("number");
    expect(isNaN(outstandingKpi.rawValue)).toBe(false);

    const stressKpi = body.kpis.find((k: any) => k.key === "stress");
    expect(stressKpi).toBeDefined();
    expect(typeof stressKpi.rawValue).toBe("number");
    expect(isNaN(stressKpi.rawValue)).toBe(false);
  });

  it("TC-017: Dashboard & Reporting — Dashboard filtering", async () => {
    const paidTxs = await request(app)
      .get("/api/transactions?status=PAID")
      .set("Authorization", `Bearer ${authToken}`);

    expect(paidTxs.status).toBe(200);
    const transactions = paidTxs.body.data?.items || paidTxs.body.data || paidTxs.body.transactions || paidTxs.body;
    if (Array.isArray(transactions) && transactions.length > 0) {
      expect(transactions.every((t: any) => t.paymentStatus === "PAID")).toBe(true);
    }
  });

  // ==========================================
  // SECTION G: FINANCIAL DEADLOCK
  // ==========================================

  it("TC-013: Financial Deadlock — Circular payment chain detection", async () => {
    // Create circular payment cycle: Node A -> Node B -> Node C -> Node A
    const firmC1 = await prisma.firm.create({
      data: {
        id: `FIRM-CYC-1-${Date.now()}`,
        name: "Cycle Node One",
        organizationId: testOrgId,
        industry: "Automotive",
        city: "Chennai",
        riskScore: 65,
        riskLevel: "HIGH",
        outstandingAmount: 200000,
        financialStress: 70,
      },
    });

    const firmC2 = await prisma.firm.create({
      data: {
        id: `FIRM-CYC-2-${Date.now()}`,
        name: "Cycle Node Two",
        organizationId: testOrgId,
        industry: "Engineering",
        city: "Bengaluru",
        riskScore: 70,
        riskLevel: "HIGH",
        outstandingAmount: 250000,
        financialStress: 75,
      },
    });

    const firmC3 = await prisma.firm.create({
      data: {
        id: `FIRM-CYC-3-${Date.now()}`,
        name: "Cycle Node Three",
        organizationId: testOrgId,
        industry: "Machinery",
        city: "Coimbatore",
        riskScore: 75,
        riskLevel: "HIGH",
        outstandingAmount: 300000,
        financialStress: 80,
      },
    });

    // 1 -> 2 -> 3 -> 1
    await prisma.relationship.createMany({
      data: [
        {
          id: `REL-CYC-1-${Date.now()}`,
          organizationId: testOrgId,
          sourceFirmId: firmC1.id,
          targetFirmId: firmC2.id,
          type: "SUPPLIES_TO",
          avgTransactionValue: 100000,
        },
        {
          id: `REL-CYC-2-${Date.now()}`,
          organizationId: testOrgId,
          sourceFirmId: firmC2.id,
          targetFirmId: firmC3.id,
          type: "SUPPLIES_TO",
          avgTransactionValue: 120000,
        },
        {
          id: `REL-CYC-3-${Date.now()}`,
          organizationId: testOrgId,
          sourceFirmId: firmC3.id,
          targetFirmId: firmC1.id,
          type: "SUPPLIES_TO",
          avgTransactionValue: 150000,
        },
      ],
    });

    const deadlocks = await DeadlockService.getDeadlocks(testOrgId);
    expect(deadlocks).toBeDefined();
    expect(deadlocks.length).toBeGreaterThanOrEqual(1);

    const deadlock = deadlocks[0];
    expect(deadlock.deadlockRisk).toBeGreaterThan(0);
    expect(deadlock.totalExposure).toBeGreaterThan(0);
    expect(deadlock.bottleneckEntity).toBeDefined();
  });

  // ==========================================
  // SECTION H: DATA TRACEABILITY & PERFORMANCE
  // ==========================================

  it("TC-019: Data Traceability — Cryptographic provenance and lineage", () => {
    const lineage = LineageTracker.createPredictionLineage({
      organizationId: testOrgId,
      invoiceId: "INV-AUDIT-101",
      buyerId: "BUYER-001",
      supplierId: "SUPPLIER-001",
      modelId: "MODEL-LOGREG-v1",
      modelVersion: "2.1.0",
      modelChecksum: "sha256-mock-checksum",
      datasetId: "DATASET-B2B",
      datasetVersion: "v1.0",
      featureVersion: "2.1.0",
      featureSnapshotHash: "hash-feature-snapshot-1234",
      predictedProbability: 0.72,
      riskBand: "HIGH",
      featuresUsed: { daysOverdue: 24, invoiceAmount: 150000 },
      featureLineages: [],
    });

    expect(lineage).toBeDefined();
    expect(lineage.predictionId).toBeDefined();
    expect(lineage.lineageSignature).toMatch(/^[a-f0-9]{64}$/); // Valid SHA-256 hash
    expect(lineage.featureSnapshotHash).toBeDefined();
  });

  it("TC-020: Performance & Usability — Representative API response within SLA envelope", async () => {
    // Warm-up query
    await request(app).get("/api/dashboard/summary").set("Authorization", `Bearer ${authToken}`);

    // Measured run
    const startTime = Date.now();
    const res = await request(app)
      .get("/api/dashboard/summary")
      .set("Authorization", `Bearer ${authToken}`);
    const duration = Date.now() - startTime;

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(duration).toBeLessThan(3500); // Measured response time adheres to project performance target
  });
});
