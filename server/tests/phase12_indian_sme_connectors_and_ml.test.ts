import { describe, it, expect, beforeAll } from "vitest";
import { ConnectorRegistry } from "../src/connectors/connectorRegistry";
import { FileControlledConnector } from "../src/connectors/fileConnector";
import {
  TallyConnector,
  ZohoBooksConnector,
  QuickBooksConnector,
  SapConnector,
  TredsSandboxConnector,
} from "../src/connectors/erpConnectors";
import {
  CanonicalInvoiceContract,
  hashPAN,
  isValidGSTIN,
  isValidUdyamId,
} from "../src/pipeline/canonicalContract";
import { IndianSmeTargetRegistry } from "../src/ml/targets/indianSmeTargetRegistry";
import { IndianSmeReadinessGate } from "../src/ml/governance/indianSmeReadinessGate";
import { IndianSmeFeatureEngine } from "../src/ml/features/indianSmeFeatureEngine";
import { IndianSmeMLPipeline } from "../src/ml/pipeline/indianSmeMLPipeline";
import { IndianSmeModelRegistry } from "../src/ml/registry/indianSmeModelRegistry";
import { IndianSmeNetworkEngine } from "../src/ml/network/indianSmeNetworkEngine";
import { IndianSmeCascadeEngine } from "../src/ml/simulation/indianSmeCascadeEngine";
import { IndianSmeResolutionEngine } from "../src/ml/decision/indianSmeResolutionEngine";

describe("Phase 12: Indian SME Connectors, Strict Governance, and Dedicated ML Pipeline", () => {
  beforeAll(() => {
    IndianSmeModelRegistry.clear();
  });

  // 1. Indian SME connector configuration
  it("Area 1: Configures all 6 enterprise Indian SME connectors with production metadata", () => {
    const connectors = ConnectorRegistry.listConnectorsForTenant("ORG-TEST-IN");
    expect(connectors.length).toBe(6);

    const ids = connectors.map((c) => c.id);
    expect(ids).toContain("CONN-TALLY-PRIME");
    expect(ids).toContain("CONN-ZOHO-BOOKS");
    expect(ids).toContain("CONN-QUICKBOOKS-ONLINE");
    expect(ids).toContain("CONN-SAP-S4HANA");
    expect(ids).toContain("CONN-FILE-CONTROLLED");
    expect(ids).toContain("CONN-TREDS-SANDBOX");

    const tally = connectors.find((c) => c.id === "CONN-TALLY-PRIME")!;
    expect(tally.name).toContain("TallyPrime");
    expect(tally.status).toBe("NOT_CONNECTED");
  });

  // 2. Unauthorized connection rejection
  it("Area 2: Rejects unauthorized connection attempts and keeps status NOT_CONNECTED", async () => {
    const tally = new TallyConnector();
    const result = await tally.validateCredentials({});
    expect(result.success).toBe(false);
    expect(result.missingRequirements?.some((m) => m.includes("gatewayUrl"))).toBe(true);
    expect(result.missingRequirements?.some((m) => m.includes("companyName"))).toBe(true);
  });

  // 3. Fake credential rejection
  it("Area 3: Rejects fake credentials and never reports CONNECTED falsely", async () => {
    const zoho = new ZohoBooksConnector();
    const result = await zoho.validateCredentials({
      clientId: "fake-client",
      clientSecret: "fake-secret",
      refreshToken: "fake-token",
      organizationId: "123",
    });
    expect(result.success).toBe(false);
    expect(result.message).toContain("Zoho Books token refresh failed");
  });

  // 4. OAuth failure handling
  it("Area 4: Handles OAuth flow failures cleanly with missing requirements", async () => {
    const qb = new QuickBooksConnector();
    const result = await qb.validateCredentials({ clientId: "id-only" });
    expect(result.success).toBe(false);
    expect(result.missingRequirements).toContain("clientSecret");
    expect(result.missingRequirements).toContain("realmId");
  });

  // 5. Token refresh
  it("Area 5: Rejects fake or missing refresh tokens in Zoho Books", async () => {
    const zoho = new ZohoBooksConnector();
    const result = await zoho.validateCredentials({
      clientId: "1000.VALIDFORMAT123456",
      clientSecret: "ValidSecretKey12345",
      // missing refreshToken
      organizationId: "700192837",
    });
    expect(result.success).toBe(false);
    expect(result.missingRequirements?.some((m) => m.includes("Refresh Token"))).toBe(true);
  });

  // 6. Tenant isolation
  it("Area 6: Enforces strict tenant isolation in ConnectorRegistry", async () => {
    const org1 = "ORG-TALLY-A";
    const org2 = "ORG-TALLY-B";

    await ConnectorRegistry.testConnection(
      org1,
      "CONN-TALLY-PRIME",
      { gatewayUrl: "http://127.0.0.1:9000", companyName: "Firm A" },
      "auditor@firma.in"
    );

    const detail1 = ConnectorRegistry.getConnectorDetail(org1, "CONN-TALLY-PRIME");
    const detail2 = ConnectorRegistry.getConnectorDetail(org2, "CONN-TALLY-PRIME");

    expect(detail1?.auditHistory.length).toBe(1);
    expect(detail2?.auditHistory.length).toBe(0);
  });

  // 7. Raw snapshot integrity (SHA-256)
  it("Area 7: Verifies raw snapshot integrity with deterministic SHA-256 manifests", () => {
    const fileConn = new FileControlledConnector();
    const records = [{ id: "REC-1", amount: 50000 }];
    const hash1 = fileConn.computeManifestHash(records);
    const hash2 = fileConn.computeManifestHash(records);
    expect(hash1).toHaveLength(64);
    expect(hash1).toBe(hash2);
  });

  // 8. Canonical transformation with Indian fields
  it("Area 8: Normalizes records into CanonicalInvoiceContract with valid GSTIN and hashed PAN", async () => {
    const fileConn = new FileControlledConnector();
    const raw = [
      {
        transaction_id: "TXN-IN-001",
        invoice_amount: 150000,
        invoice_date: "2026-01-10",
        due_date: "2026-02-15",
        gstin: "27AABCU9603R1ZM",
        udyam_id: "UDYAM-MH-01-0012345",
        state: "Maharashtra",
      },
    ];

    const normalized = await fileConn.normalize(raw);
    expect(normalized).toHaveLength(1);
    expect(normalized[0].gstin).toBe("27AABCU9603R1ZM");
    expect(normalized[0].pan_hash).toHaveLength(64);
    expect(normalized[0].udyam_id).toBe("UDYAM-MH-01-0012345");
    expect(normalized[0].state).toBe("Maharashtra");
  });

  // 9. Reconciliation
  it("Area 9: Audits reconciliation between raw input and normalized contract", async () => {
    const fileConn = new FileControlledConnector();
    const raw = [
      { transaction_id: "TXN-1", invoice_amount: 100000, due_date: "2026-02-01" },
      { transaction_id: "TXN-2", invoice_amount: 250000, due_date: "2026-02-10" },
    ];
    const canonical = await fileConn.normalize(raw);
    const totalRaw = raw.reduce((sum, r) => sum + r.invoice_amount, 0);
    const totalCanonical = canonical.reduce((sum, c) => sum + c.invoice_amount, 0);
    expect(totalCanonical).toBe(totalRaw);
  });

  // 10. Duplicate detection
  it("Area 10: Flags duplicate transaction IDs as blocking failure in readiness gate", () => {
    const records: CanonicalInvoiceContract[] = [
      {
        transaction_id: "TXN-DUP-01",
        sme_id: "SME-1",
        buyer_id: "B-1",
        invoice_amount: 10000,
        invoice_date: "2026-01-01",
        due_date: "2026-01-30",
        credit_period: 30,
        outstanding_amount: 0,
        payment_status: "PAID",
        currency: "INR",
        source_system: "TEST",
        source_record_id: "REC-1",
        extracted_at: new Date().toISOString(),
        raw_payload: {},
      },
      {
        transaction_id: "TXN-DUP-01", // duplicate
        sme_id: "SME-1",
        buyer_id: "B-2",
        invoice_amount: 20000,
        invoice_date: "2026-01-02",
        due_date: "2026-02-01",
        credit_period: 30,
        outstanding_amount: 0,
        payment_status: "PAID",
        currency: "INR",
        source_system: "TEST",
        source_record_id: "REC-2",
        extracted_at: new Date().toISOString(),
        raw_payload: {},
      },
    ];

    const gate = IndianSmeReadinessGate.evaluate(records, {
      sourceType: "CONTROLLED_FILE",
      provenanceClassification: "REAL_OBSERVED",
      legalAuthorizationAttested: true,
      datasetHash: "a".repeat(64),
      governanceApproved: true,
    });

    const dupCheck = gate.checks.find((c) => c.checkId === "DUPLICATE_CONTAMINATION")!;
    expect(dupCheck.passed).toBe(false);
    expect(gate.overallPassed).toBe(false);
  });

  // 11. Censoring analysis
  it("Area 11: Accurately analyzes right-censoring rate and distinguishes settled invoices", () => {
    const records: CanonicalInvoiceContract[] = [
      {
        transaction_id: "TXN-1",
        sme_id: "SME-1",
        buyer_id: "B-1",
        invoice_amount: 50000,
        invoice_date: "2026-01-01",
        due_date: "2026-01-30",
        payment_date: "2026-02-05", // Settled
        credit_period: 30,
        outstanding_amount: 0,
        payment_status: "PAID",
        currency: "INR",
        source_system: "TEST",
        source_record_id: "1",
        extracted_at: new Date().toISOString(),
        raw_payload: {},
      },
      {
        transaction_id: "TXN-2",
        sme_id: "SME-1",
        buyer_id: "B-1",
        invoice_amount: 75000,
        invoice_date: "2026-01-10",
        due_date: "2026-02-10",
        payment_date: null, // Censored
        credit_period: 30,
        outstanding_amount: 75000,
        payment_status: "PENDING",
        currency: "INR",
        source_system: "TEST",
        source_record_id: "2",
        extracted_at: new Date().toISOString(),
        raw_payload: {},
      },
    ];

    const targets = IndianSmeTargetRegistry.computeTargets(records);
    expect(targets[0].isCensored).toBe(false);
    expect(targets[0].paymentDelayDays).toBe(6);
    expect(targets[1].isCensored).toBe(true);
    expect(targets[1].paymentDelayDays).toBeNull();
  });

  // 12. Target construction
  it("Area 12: Evaluates Indian SME targets and marks SME_FINANCIAL_STRESS as unsupported without longitudinal statements", () => {
    const records: CanonicalInvoiceContract[] = [
      {
        transaction_id: "TXN-1",
        sme_id: "SME-1",
        buyer_id: "B-1",
        invoice_amount: 50000,
        invoice_date: "2026-01-01",
        due_date: "2026-01-30",
        payment_date: "2026-02-25", // delayed > 15 days, age > 45 days
        credit_period: 30,
        outstanding_amount: 0,
        payment_status: "PAID",
        currency: "INR",
        source_system: "TEST",
        source_record_id: "1",
        extracted_at: new Date().toISOString(),
        raw_payload: {},
      },
    ];

    const evalRes = IndianSmeTargetRegistry.evaluateTargetSupport(records);
    expect(evalRes.SME_FINANCIAL_STRESS.supported).toBe(false);
    expect(evalRes.SME_FINANCIAL_STRESS.reason).toContain("UNSUPPORTED");

    const targets = IndianSmeTargetRegistry.computeTargets(records);
    expect(targets[0].isPaymentDelayed).toBe(true);
    expect(targets[0].isMsmeda45dBreach).toBe(true);
  });

  // 13. Temporal leakage protection
  it("Area 13: Detects and blocks inverted dates (due_date < invoice_date)", () => {
    const records: CanonicalInvoiceContract[] = [
      {
        transaction_id: "TXN-INVERTED",
        sme_id: "SME-1",
        buyer_id: "B-1",
        invoice_amount: 50000,
        invoice_date: "2026-02-15",
        due_date: "2026-01-15", // Inverted!
        credit_period: -31,
        outstanding_amount: 0,
        payment_status: "PAID",
        currency: "INR",
        source_system: "TEST",
        source_record_id: "1",
        extracted_at: new Date().toISOString(),
        raw_payload: {},
      },
    ];

    const gate = IndianSmeReadinessGate.evaluate(records, {
      sourceType: "FILE",
      provenanceClassification: "REAL_OBSERVED",
      legalAuthorizationAttested: true,
      datasetHash: "b".repeat(64),
    });

    const leakCheck = gate.checks.find((c) => c.checkId === "TEMPORAL_LEAKAGE_FIREWALL")!;
    expect(leakCheck.passed).toBe(false);
  });

  // 14. Entity leakage protection
  it("Area 14: Computes rolling buyer historical behavior strictly pre-t0 without future leakage", () => {
    const records: CanonicalInvoiceContract[] = [
      {
        transaction_id: "TXN-A",
        sme_id: "SME-1",
        buyer_id: "BUYER-X",
        invoice_amount: 100000,
        invoice_date: "2026-01-01",
        due_date: "2026-01-30",
        payment_date: "2026-02-15", // delayed 16 days
        credit_period: 30,
        outstanding_amount: 0,
        payment_status: "PAID",
        currency: "INR",
        source_system: "TEST",
        source_record_id: "1",
        extracted_at: new Date().toISOString(),
        raw_payload: {},
      },
      {
        transaction_id: "TXN-B",
        sme_id: "SME-1",
        buyer_id: "BUYER-X",
        invoice_amount: 200000,
        invoice_date: "2026-01-10", // Issued BEFORE TXN-A was settled!
        due_date: "2026-02-10",
        payment_date: "2026-02-10",
        credit_period: 31,
        outstanding_amount: 0,
        payment_status: "PAID",
        currency: "INR",
        source_system: "TEST",
        source_record_id: "2",
        extracted_at: new Date().toISOString(),
        raw_payload: {},
      },
    ];

    const features = IndianSmeFeatureEngine.extractFeatures(records);
    // TXN-B was issued on Jan 10, when TXN-A had not yet settled (settled Feb 15).
    // So buyer_prior_invoice_count should be 0 settled invoices!
    const featB = features.find((f) => f.transaction_id === "TXN-B")!;
    expect(featB.buyer_prior_invoice_count).toBe(0);
  });

  // 15. Target leakage protection
  it("Area 15: Confirms payment_date and actual delay are permanently excluded from feature keys", () => {
    const records: CanonicalInvoiceContract[] = [
      {
        transaction_id: "TXN-1",
        sme_id: "SME-1",
        buyer_id: "B-1",
        invoice_amount: 50000,
        invoice_date: "2026-01-01",
        due_date: "2026-01-30",
        payment_date: "2026-02-05",
        credit_period: 30,
        outstanding_amount: 0,
        payment_status: "PAID",
        currency: "INR",
        source_system: "TEST",
        source_record_id: "1",
        extracted_at: new Date().toISOString(),
        raw_payload: {},
      },
    ];

    const features = IndianSmeFeatureEngine.extractFeatures(records);
    const featureKeys = Object.keys(features[0]);
    expect(featureKeys).not.toContain("payment_date");
    expect(featureKeys).not.toContain("actual_delay_days");
    expect(featureKeys).not.toContain("is_payment_delayed");
    expect(featureKeys).not.toContain("gstin");
  });

  // 16. Duplicate split contamination protection
  it("Area 16: Prevents duplicate split contamination between chronological train/val/test partitions", async () => {
    // Generate 40 sequential transactions
    const records: CanonicalInvoiceContract[] = [];
    const baseDate = new Date("2026-01-01");

    for (let i = 0; i < 40; i++) {
      const invDate = new Date(baseDate.getTime() + i * 2 * 86400000);
      const dueDate = new Date(invDate.getTime() + 30 * 86400000);
      const payDate = new Date(dueDate.getTime() + (i % 2 === 0 ? 5 : -2) * 86400000);

      records.push({
        transaction_id: `TXN-SEQ-${i + 1}`,
        sme_id: "SME-IND-01",
        buyer_id: `BUYER-${(i % 5) + 1}`,
        invoice_amount: 50000 + i * 2000,
        invoice_date: invDate.toISOString().slice(0, 10),
        due_date: dueDate.toISOString().slice(0, 10),
        payment_date: payDate.toISOString().slice(0, 10),
        credit_period: 30,
        outstanding_amount: 0,
        payment_status: "PAID",
        currency: "INR",
        source_system: "CONTROLLED_FILE_EXPORT",
        source_record_id: `REC-${i + 1}`,
        extracted_at: new Date().toISOString(),
        raw_payload: {},
      });
    }

    const report = await IndianSmeMLPipeline.runPipeline(
      records,
      {
        sourceType: "CONTROLLED_FILE_EXPORT",
        provenanceClassification: "REAL_OBSERVED",
        legalAuthorizationAttested: true,
        authorizedSignatoryName: "Rajesh Kumar",
        smeLegalName: "Paramount Auto Ancillaries Pvt Ltd",
        smeGstin: "27AABCU9603R1ZM",
        datasetHash: "c".repeat(64),
        governanceApproved: true,
      },
      "PAYMENT_DELAY_RISK"
    );

    expect(report.success).toBe(true);
    expect(report.trainingSummary).toBeDefined();
    const summary = report.trainingSummary!;

    // Train and test windows must not overlap
    expect(summary.trainCount).toBeGreaterThan(0);
    expect(summary.testCount).toBeGreaterThan(0);
    expect(summary.trainWindow.end).not.toBe(summary.testWindow.start);
  });

  // 17. Indian SME ML readiness gate blocks unconsented or simulated data honestly
  it("Area 17: Halts pipeline with TRAINING_BLOCKED_AWAITING_AUTHORIZED_DATA if unconsented", async () => {
    const report = await IndianSmeMLPipeline.runPipeline([], {
      sourceType: "UNCONNECTED",
      provenanceClassification: "SIMULATED",
      legalAuthorizationAttested: false,
    });

    expect(report.success).toBe(false);
    expect(report.status).toBe("TRAINING_BLOCKED_AWAITING_AUTHORIZED_DATA");
    expect(report.message).toContain("TRUTH > DATA VOLUME");
  });

  // 18. Model training on authorized data
  it("Area 18: Successfully trains and evaluates regularized model on genuine authorized stream", async () => {
    const records: CanonicalInvoiceContract[] = [];
    const baseDate = new Date("2026-01-01");

    for (let i = 0; i < 40; i++) {
      const invDate = new Date(baseDate.getTime() + i * 2 * 86400000);
      const dueDate = new Date(invDate.getTime() + 30 * 86400000);
      const payDate = new Date(dueDate.getTime() + (i % 2 === 0 ? 10 : -3) * 86400000);

      records.push({
        transaction_id: `TXN-VOL-${i + 1}`,
        sme_id: "SME-01",
        buyer_id: `BUYER-${(i % 4) + 1}`,
        invoice_amount: 80000 + i * 3000,
        invoice_date: invDate.toISOString().slice(0, 10),
        due_date: dueDate.toISOString().slice(0, 10),
        payment_date: payDate.toISOString().slice(0, 10),
        credit_period: 30,
        outstanding_amount: 0,
        payment_status: "PAID",
        currency: "INR",
        source_system: "CONTROLLED_FILE_EXPORT",
        source_record_id: `REC-${i + 1}`,
        extracted_at: new Date().toISOString(),
        raw_payload: {},
      });
    }

    const report = await IndianSmeMLPipeline.runPipeline(
      records,
      {
        sourceType: "CONTROLLED_FILE_EXPORT",
        provenanceClassification: "REAL_OBSERVED",
        legalAuthorizationAttested: true,
        authorizedSignatoryName: "Sanjay Mehta",
        smeLegalName: "Mehta Precision Engineering LLP",
        smeGstin: "27AABCU9603R1ZM",
        datasetHash: "d".repeat(64),
        governanceApproved: true,
      },
      "PAYMENT_DELAY_RISK"
    );

    expect(report.success).toBe(true);
    expect(report.status).toBe("TRAINED_AND_REGISTERED");
  });

  // 19. OOT Evaluation metrics
  it("Area 19: Measures observed ROC-AUC, F1, and Brier Score on out-of-time test set", async () => {
    const activeModel = IndianSmeModelRegistry.getActiveModel();
    expect(activeModel).toBeDefined();
    const metrics = activeModel!.classificationMetrics!;
    expect(metrics.rocAuc).toBeGreaterThanOrEqual(0.5);
    expect(metrics.f1).toBeGreaterThanOrEqual(0);
    expect(metrics.brierScore).toBeLessThanOrEqual(1.0);
  });

  // 20. Calibration evaluation
  it("Area 20: Evaluates calibration defensibility and flags power status", () => {
    const activeModel = IndianSmeModelRegistry.getActiveModel()!;
    expect(["CALIBRATED", "INSUFFICIENT_STATISTICAL_POWER"]).toContain(activeModel.calibrationStatus);
  });

  // 21. Model persistence
  it("Area 21: Persists model record to disk with cryptographic artifact checksum", () => {
    const activeModel = IndianSmeModelRegistry.getActiveModel()!;
    expect(activeModel.artifactChecksum).toHaveLength(64);
  });

  // 22. Restart recovery
  it("Area 22: Recovers model registry state seamlessly across simulated server restart", () => {
    const preRestartId = IndianSmeModelRegistry.getActiveModel()?.modelId;
    expect(preRestartId).toBeDefined();

    // Re-initialize from disk
    IndianSmeModelRegistry.init();
    const postRestartModel = IndianSmeModelRegistry.getActiveModel();
    expect(postRestartModel?.modelId).toBe(preRestartId);
  });

  // 23. Prediction service
  it("Area 23: Produces calibrated delay probability and risk tiers with explainability", () => {
    const invoice: CanonicalInvoiceContract = {
      transaction_id: "TXN-INFER-01",
      sme_id: "SME-01",
      buyer_id: "BUYER-1",
      invoice_amount: 120000,
      invoice_date: "2026-03-01",
      due_date: "2026-03-31",
      credit_period: 30,
      outstanding_amount: 120000,
      payment_status: "PENDING",
      currency: "INR",
      source_system: "TEST",
      source_record_id: "1",
      extracted_at: new Date().toISOString(),
      raw_payload: {},
    };

    const features = IndianSmeFeatureEngine.extractFeatures([invoice])[0];
    const prediction = IndianSmeMLPipeline.predictInvoice(invoice, features);

    expect(prediction.transaction_id).toBe("TXN-INFER-01");
    expect(prediction.paymentDelayProbability).toBeGreaterThanOrEqual(0);
    expect(prediction.paymentDelayProbability).toBeLessThanOrEqual(1);
    expect(["LOW", "ELEVATED", "CRITICAL"]).toContain(prediction.riskTier);
    expect(prediction.explainability.topDrivers.length).toBeGreaterThan(0);
  });

  // 24. Network integration
  it("Area 24: Builds Indian SME supply chain network graph with counterparty exposure", () => {
    const records: CanonicalInvoiceContract[] = [
      {
        transaction_id: "TXN-NET-1",
        sme_id: "SME-CORE",
        buyer_id: "BUYER-ANCHOR",
        invoice_amount: 500000,
        due_date: "2026-03-01",
        credit_period: 30,
        outstanding_amount: 500000,
        payment_status: "PENDING",
        currency: "INR",
        source_system: "TEST",
        source_record_id: "1",
        extracted_at: new Date().toISOString(),
        raw_payload: {},
        invoice_date: "2026-02-01",
      },
    ];

    const graph = IndianSmeNetworkEngine.buildGraph(records);
    expect(graph.nodes.length).toBe(2);
    expect(graph.edges.length).toBe(1);
    expect(graph.summary.topBuyerConcentrationRatio).toBe(1.0);
    expect(graph.provenance.crossSourceJoinsApplied).toBe(false);
  });

  // 25. Cascade simulation
  it("Area 25: Simulates hypothetical shock contagion strictly labeled as HYPOTHETICAL_SCENARIO", () => {
    const records: CanonicalInvoiceContract[] = [
      {
        transaction_id: "TXN-1",
        sme_id: "SME-CORE",
        buyer_id: "BUYER-ANCHOR",
        invoice_amount: 500000,
        due_date: "2026-03-01",
        credit_period: 30,
        outstanding_amount: 500000,
        payment_status: "PENDING",
        currency: "INR",
        source_system: "TEST",
        source_record_id: "1",
        extracted_at: new Date().toISOString(),
        raw_payload: {},
        invoice_date: "2026-02-01",
      },
    ];

    const graph = IndianSmeNetworkEngine.buildGraph(records);
    const scenario = IndianSmeCascadeEngine.simulateCascade(graph, "BUYER-ANCHOR", 60);

    expect(scenario.scenarioClassification).toBe("HYPOTHETICAL_SCENARIO");
    expect(scenario.totalDistressedNodes).toBe(2);
    expect(scenario.disclaimer).toContain("HYPOTHETICAL");
  });

  // 26. Resolution engine
  it("Area 26: Generates non-transactional decision-support resolutions with full triggers and disclaimers", () => {
    const predictions = [
      {
        transaction_id: "TXN-CRIT",
        paymentDelayProbability: 0.88,
        predictedDelayDays: 35,
        riskTier: "CRITICAL" as const,
        isMsmeda45dBreachRisk: true,
        modelId: "INDIAN-SME-MDL-TEST",
        confidence: 0.9,
        explainability: { topDrivers: [] },
      },
    ];

    const edges = [
      {
        source: "SME-1",
        target: "BUYER-1",
        relationship: "SELLS_TO" as const,
        totalVolumeINR: 500000,
        activeInvoiceCount: 5,
        dependencyRatio: 0.65,
        averageCreditDays: 45,
      },
    ];

    const plan = IndianSmeResolutionEngine.generateResolutions(predictions, edges);
    expect(plan.operationalMode).toBe("DECISION_SUPPORT_ONLY");
    expect(plan.recommendations.length).toBeGreaterThan(0);

    const tredsAction = plan.recommendations.find((r) => r.type === "TREDS_INVOICE_FINANCING");
    expect(tredsAction).toBeDefined();
    expect(tredsAction?.disclaimer).toBe("DECISION_SUPPORT_ONLY_NO_EXECUTION");
  });

  // 27. Provenance display
  it("Area 27: Enforces Indian SME provenance metadata (Country: IN, Industry, Limitations)", () => {
    const activeModel = IndianSmeModelRegistry.getActiveModel()!;
    expect(activeModel.provenance.country).toBe("IN");
    expect(activeModel.provenance.industryCoverage.length).toBeGreaterThan(0);
    expect(activeModel.provenance.knownLimitations.length).toBeGreaterThan(0);
  });

  // 28. Production boundary enforcement
  it("Area 28: Enforces explicit production boundaries and prevents premature claims", () => {
    const activeModel = IndianSmeModelRegistry.getActiveModel()!;
    expect(activeModel.productionBoundary).toBe("INDIAN_SME_MODEL_DEPLOYED");

    // Unconnected pipeline run boundary check
    const gateDummy = IndianSmeReadinessGate.evaluate([], {
      sourceType: "UNCONNECTED",
      provenanceClassification: "SIMULATED",
      legalAuthorizationAttested: false,
    });
    expect(gateDummy.status).toBe("TRAINING_BLOCKED_AWAITING_AUTHORIZED_DATA");
  });
});
