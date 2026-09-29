import request from "supertest";
import { describe, expect, it, beforeAll } from "vitest";
import app from "../src/app";

describe("NEXUS-CFR Phase 3.9 — Primary Data Access & Enterprise Ingestion Readiness Suite", () => {
  let orgRealAdminToken: string;
  let orgAAdminToken: string;

  beforeAll(async () => {
    const resReal = await request(app)
      .post("/api/auth/login")
      .send({ email: "realadmin@nexuscfr.in", password: "demo1234" });
    orgRealAdminToken = resReal.body.data.token;

    const resA = await request(app)
      .post("/api/auth/login")
      .send({ email: "demo@nexuscfr.in", password: "demo1234" });
    orgAAdminToken = resA.body.data.token;
  });

  it("1. GET /api/connectors requires authentication (401 unauthorized)", async () => {
    const res = await request(app).get("/api/connectors");
    expect(res.status).toBe(401);
  });

  it("2. GET /api/connectors returns full enterprise connector catalog with honest connection statuses", async () => {
    const res = await request(app)
      .get("/api/connectors")
      .set("Authorization", `Bearer ${orgRealAdminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const connectors = res.body.data;
    expect(connectors.length).toBeGreaterThanOrEqual(6);

    // Verify File Connector is operational
    const fileConn = connectors.find((c: any) => c.id === "CONN-FILE-CONTROLLED");
    expect(fileConn).toBeDefined();
    expect(fileConn.status).toBe("CONNECTED");
    expect(fileConn.provenanceClassification).toBe("ARCHITECTURAL_BENCHMARK");

    // Verify ERP connectors are honestly marked NOT_CONNECTED (Zero fabrication)
    const tallyConn = connectors.find((c: any) => c.id === "CONN-TALLY-PRIME");
    expect(tallyConn).toBeDefined();
    expect(tallyConn.status).toBe("NOT_CONNECTED");
    expect(tallyConn.authType).toBe("ON_PREM_GATEWAY");

    const zohoConn = connectors.find((c: any) => c.id === "CONN-ZOHO-BOOKS");
    expect(zohoConn).toBeDefined();
    expect(zohoConn.status).toBe("NOT_CONNECTED");
    expect(zohoConn.authType).toBe("OAUTH2");

    const sapConn = connectors.find((c: any) => c.id === "CONN-SAP-S4HANA");
    expect(sapConn).toBeDefined();
    expect(sapConn.status).toBe("NOT_CONNECTED");
    expect(sapConn.authType).toBe("MUTUAL_TLS");

    const tredsConn = connectors.find((c: any) => c.id === "CONN-TREDS-SANDBOX");
    expect(tredsConn).toBeDefined();
    expect(tredsConn.status).toBe("NOT_CONNECTED");
    expect(tredsConn.authType).toBe("API_KEY");
  });

  it("3. GET /api/connectors/contract returns canonical transaction contract and provider mappings", async () => {
    const res = await request(app)
      .get("/api/connectors/contract")
      .set("Authorization", `Bearer ${orgRealAdminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.schemaVersion).toBe("3.9-CANONICAL");
    const registry = res.body.data.registry;

    expect(registry.TALLY_PRIME).toBeDefined();
    expect(registry.ZOHO_BOOKS).toBeDefined();
    expect(registry.QUICKBOOKS_ONLINE).toBeDefined();
    expect(registry.SAP_S4HANA).toBeDefined();
    expect(registry.TREDS_SANDBOX).toBeDefined();
    expect(registry.CONTROLLED_FILE_EXPORT).toBeDefined();
  });

  it("4. POST /api/connectors/:id/test reports missing parameters without fabricating connection", async () => {
    // Test Tally with empty body
    const resTally = await request(app)
      .post("/api/connectors/CONN-TALLY-PRIME/test")
      .set("Authorization", `Bearer ${orgRealAdminToken}`)
      .send({ credentials: {} });

    expect(resTally.status).toBe(200);
    expect(resTally.body.data.success).toBe(false);
    expect(resTally.body.data.missingRequirements).toBeDefined();
    expect(resTally.body.data.missingRequirements.length).toBeGreaterThanOrEqual(1);

    // Test Zoho with empty credentials
    const resZoho = await request(app)
      .post("/api/connectors/CONN-ZOHO-BOOKS/test")
      .set("Authorization", `Bearer ${orgRealAdminToken}`)
      .send({ credentials: {} });

    expect(resZoho.status).toBe(200);
    expect(resZoho.body.data.success).toBe(false);
    expect(resZoho.body.data.missingRequirements).toContain("clientId");
  });

  it("5. Security & Credential Protection: GET /api/connectors/:id masks sensitive credentials", async () => {
    // Submit test credentials for Zoho in ORG-003
    await request(app)
      .post("/api/connectors/CONN-ZOHO-BOOKS/test")
      .set("Authorization", `Bearer ${orgRealAdminToken}`)
      .send({
        credentials: {
          clientId: "zoho_client_abc123",
          clientSecret: "super_secret_password_xyz",
          organizationId: "zoho_org_999",
        },
      });

    // Inspect connector detail
    const resDetail = await request(app)
      .get("/api/connectors/CONN-ZOHO-BOOKS")
      .set("Authorization", `Bearer ${orgRealAdminToken}`);

    expect(resDetail.status).toBe(200);
    const detail = resDetail.body.data;
    // Secret must be masked
    expect(detail.configuredCredentials.clientSecret).toBe("********");
    expect(detail.auditHistory.length).toBeGreaterThanOrEqual(1);
    expect(detail.auditHistory[0].actor).toBe("realadmin@nexuscfr.in");
  });

  it("6. Multi-Tenant Isolation: Connector audit logs in ORG-003 are invisible to ORG-001", async () => {
    const resDetailA = await request(app)
      .get("/api/connectors/CONN-ZOHO-BOOKS")
      .set("Authorization", `Bearer ${orgAAdminToken}`);

    expect(resDetailA.status).toBe(200);
    // In ORG-001, Zoho connector has no configured credentials or audit history from ORG-003
    expect(resDetailA.body.data.configuredCredentials.clientSecret).toBeUndefined();
    expect(resDetailA.body.data.auditHistory.length).toBe(0);
  });

  it("7. ML Gate Lock: Audit confirms 'ML BLOCKED — PRIMARY DATA NOT YET CONNECTED'", async () => {
    const res = await request(app)
      .get("/api/governance/audit")
      .set("Authorization", `Bearer ${orgRealAdminToken}`);

    expect(res.status).toBe(200);
    const audit = res.body.data;
    expect(audit.mlGateStatus).toBe("LOCKED");
    expect(audit.mlGateSummary.verdict).toContain("ML BLOCKED");
    expect(audit.mlGateSummary.verdict).toContain("PRIMARY DATA NOT YET CONNECTED");
    expect(audit.mlGateSummary.primaryBlocker).toContain("enterprise ingestion architecture is production-ready");
    expect(audit.mlGateSummary.actionableRequirement).toContain("Connect an authorized enterprise data source");
  });
});
