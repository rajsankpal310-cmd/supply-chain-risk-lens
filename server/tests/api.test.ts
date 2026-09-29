import { describe, it, expect, beforeAll } from "vitest";
import request from "supertest";
import app from "../src/app";

describe("NEXUS-CFR Multi-Tenant & RBAC Hardened API Tests", () => {
  // ORG_A Tokens
  let orgAAdminToken: string;
  let orgAAnalystToken: string;
  let orgAViewerToken: string;

  // ORG_B Tokens
  let orgBAdminToken: string;
  let orgBAnalystToken: string;
  let orgBViewerToken: string;

  beforeAll(async () => {
    // 1. Obtain ORG_A tokens
    const resAAdmin = await request(app)
      .post("/api/auth/login")
      .send({ email: "demo@nexuscfr.in", password: "demo1234" });
    if (resAAdmin.status === 200 && resAAdmin.body.data?.token) {
      orgAAdminToken = resAAdmin.body.data.token;
    }

    const resAAnalyst = await request(app)
      .post("/api/auth/login")
      .send({ email: "analyst@nexus-cfr.demo", password: "demo1234" });
    if (resAAnalyst.status === 200 && resAAnalyst.body.data?.token) {
      orgAAnalystToken = resAAnalyst.body.data.token;
    }

    const resAViewer = await request(app)
      .post("/api/auth/login")
      .send({ email: "viewer@nexus-cfr.demo", password: "demo1234" });
    if (resAViewer.status === 200 && resAViewer.body.data?.token) {
      orgAViewerToken = resAViewer.body.data.token;
    }

    // 2. Obtain ORG_B tokens
    const resBAdmin = await request(app)
      .post("/api/auth/login")
      .send({ email: "admin@orgb.demo", password: "demo1234" });
    if (resBAdmin.status === 200 && resBAdmin.body.data?.token) {
      orgBAdminToken = resBAdmin.body.data.token;
    }

    const resBAnalyst = await request(app)
      .post("/api/auth/login")
      .send({ email: "analyst@orgb.demo", password: "demo1234" });
    if (resBAnalyst.status === 200 && resBAnalyst.body.data?.token) {
      orgBAnalystToken = resBAnalyst.body.data.token;
    }

    const resBViewer = await request(app)
      .post("/api/auth/login")
      .send({ email: "viewer@orgb.demo", password: "demo1234" });
    if (resBViewer.status === 200 && resBViewer.body.data?.token) {
      orgBViewerToken = resBViewer.body.data.token;
    }
  });

  // --- SECTION A: HEALTH & AUTHENTICATION ---

  it("1. GET /health returns 200 healthy status", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.status).toBe("healthy");
  });

  it("2. POST /api/auth/login authenticates user and returns organization context", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "demo@nexuscfr.in", password: "demo1234" });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.token).toBeDefined();
    expect(res.body.data.user.email).toBe("demo@nexuscfr.in");
    expect(res.body.data.user.organizationId).toBe("ORG-001");
    expect(res.body.data.user.organizationName).toBe("Apex Manufacturing Consortium");
  });

  it("3. POST /api/auth/login for ORG_B user returns ORG_B organization context", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "admin@orgb.demo", password: "demo1234" });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.organizationId).toBe("ORG-002");
    expect(res.body.data.user.organizationName).toBe("Bharat Logistics & Distribution");
  });

  it("4. POST /api/auth/login with invalid credentials fails with 401", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email: "demo@nexuscfr.in", password: "wrongpassword" });
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it("5. Protected route GET /api/auth/me fails without token", async () => {
    const res = await request(app).get("/api/auth/me");
    expect(res.status).toBe(401);
  });

  it("6. Protected route GET /api/auth/me succeeds with token and reveals organization", async () => {
    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${orgAAdminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.email).toBe("demo@nexuscfr.in");
    expect(res.body.data.organizationId).toBe("ORG-001");
  });

  it("7. POST /api/auth/register automatically provisions an isolated organization", async () => {
    const uniqueEmail = `test_${Date.now()}@newcorp.in`;
    const res = await request(app)
      .post("/api/auth/register")
      .send({
        fullName: "Test Admin",
        companyName: "Pinnacle Precision Gears",
        email: uniqueEmail,
        password: "password123",
        industry: "Manufacturing",
        companySize: "11-50",
      });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.user.email).toBe(uniqueEmail);
    expect(res.body.data.user.organizationId).toBeDefined();
    expect(res.body.data.user.organizationName).toBe("Pinnacle Precision Gears");
  });

  // --- SECTION B: MULTI-TENANT DASHBOARD ISOLATION ---

  it("8. GET /api/dashboard/summary calculates KPIs exclusively for ORG_A", async () => {
    const res = await request(app)
      .get("/api/dashboard/summary")
      .set("Authorization", `Bearer ${orgAAdminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.kpis).toBeDefined();
    expect(Array.isArray(res.body.data.kpis)).toBe(true);

    // ORG_A has 12 firms
    expect(res.body.data.executiveSummary.totalFirmsCount).toBe(12);

    // Ensure all overdue txns in summary belong to ORG_A firms
    for (const t of res.body.data.overdueTransactions) {
      expect(t.smeId.startsWith("FIRM-A")).toBe(true);
    }
  });

  it("9. GET /api/dashboard/summary calculates KPIs exclusively for ORG_B", async () => {
    const res = await request(app)
      .get("/api/dashboard/summary")
      .set("Authorization", `Bearer ${orgBAdminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.kpis).toBeDefined();

    // ORG_B has 8 firms (distinct from ORG_A's 12)
    expect(res.body.data.executiveSummary.totalFirmsCount).toBe(8);

    // Ensure all overdue txns in summary belong to ORG_B firms
    for (const t of res.body.data.overdueTransactions) {
      expect(t.smeId.startsWith("FIRM-B")).toBe(true);
    }
  });

  // --- SECTION C: TRANSACTION SCOPING & ISOLATION ---

  it("10. GET /api/transactions for ORG_A returns only ORG_A transactions", async () => {
    const res = await request(app)
      .get("/api/transactions?page=1&limit=50")
      .set("Authorization", `Bearer ${orgAAdminToken}`);
    expect(res.status).toBe(200);
    const items = res.body.data.items || res.body.data;
    expect(items.length).toBeGreaterThan(0);
    for (const txn of items) {
      expect(txn.organizationId).toBe("ORG-001");
      expect(txn.smeId.startsWith("FIRM-A")).toBe(true);
    }
  });

  it("11. GET /api/transactions for ORG_B returns only ORG_B transactions", async () => {
    const res = await request(app)
      .get("/api/transactions?page=1&limit=50")
      .set("Authorization", `Bearer ${orgBAdminToken}`);
    expect(res.status).toBe(200);
    const items = res.body.data.items || res.body.data;
    expect(items.length).toBeGreaterThan(0);
    for (const txn of items) {
      expect(txn.organizationId).toBe("ORG-002");
      expect(txn.smeId.startsWith("FIRM-B")).toBe(true);
    }
  });

  // --- SECTION D: IDOR (INSECURE DIRECT OBJECT REFERENCE) PROTECTION ---

  it("12. IDOR: ORG_B user attempting to read ORG_A transaction is blocked with 404", async () => {
    const res = await request(app)
      .get("/api/transactions/TXN-A-0001")
      .set("Authorization", `Bearer ${orgBAdminToken}`);
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error.message).toContain("not available in your organization");
  });

  it("13. IDOR: ORG_B user attempting to update ORG_A transaction is blocked with 404", async () => {
    const res = await request(app)
      .put("/api/transactions/TXN-A-0001")
      .set("Authorization", `Bearer ${orgBAdminToken}`)
      .send({ paymentStatus: "PAID" });
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error.message).toContain("not available in your organization");
  });

  it("14. IDOR: ORG_B user attempting to delete ORG_A transaction is blocked with 404", async () => {
    const res = await request(app)
      .delete("/api/transactions/TXN-A-0001")
      .set("Authorization", `Bearer ${orgBAdminToken}`);
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error.message).toContain("not available in your organization");
  });

  it("15. IDOR: ORG_B user attempting to read ORG_A firm is blocked with 404", async () => {
    const res = await request(app)
      .get("/api/firms/FIRM-A-01")
      .set("Authorization", `Bearer ${orgBAdminToken}`);
    expect(res.status).toBe(404);
    expect(res.body.error.message).toContain("not available in your organization");
  });

  it("16. IDOR: ORG_B user attempting to read ORG_A firm transactions is blocked with 404", async () => {
    const res = await request(app)
      .get("/api/firms/FIRM-A-01/transactions")
      .set("Authorization", `Bearer ${orgBAdminToken}`);
    expect(res.status).toBe(404);
  });

  it("17. IDOR: ORG_B user attempting to update ORG_A firm is blocked with 404", async () => {
    const res = await request(app)
      .put("/api/firms/FIRM-A-01")
      .set("Authorization", `Bearer ${orgBAdminToken}`)
      .send({ name: "Malicious Tamper" });
    expect(res.status).toBe(404);
  });

  it("18. IDOR: ORG_B user attempting to delete ORG_A firm is blocked with 404", async () => {
    const res = await request(app)
      .delete("/api/firms/FIRM-A-01")
      .set("Authorization", `Bearer ${orgBAdminToken}`);
    expect(res.status).toBe(404);
  });

  it("19. IDOR: ORG_B user attempting to read ORG_A relationship is blocked with 404", async () => {
    const res = await request(app)
      .get("/api/relationships/REL-A-001")
      .set("Authorization", `Bearer ${orgBAdminToken}`);
    expect(res.status).toBe(404);
  });

  it("20. IDOR: ORG_B user attempting to update ORG_A alert is blocked with 404", async () => {
    const res = await request(app)
      .put("/api/alerts/ALT-ORG_A-001/read")
      .set("Authorization", `Bearer ${orgBAdminToken}`)
      .send({ read: true });
    expect(res.status).toBe(404);
  });

  it("21. IDOR: ORG_B user attempting to resolve ORG_A deadlock is blocked with 404", async () => {
    const res = await request(app)
      .post("/api/deadlocks/DLK-ORG_A-001/resolve")
      .set("Authorization", `Bearer ${orgBAdminToken}`);
    expect(res.status).toBe(404);
  });

  it("22. IDOR: ORG_B user attempting to update ORG_A recommendation is blocked with 404", async () => {
    const res = await request(app)
      .put("/api/recommendations/REC-ORG_A-001/status")
      .set("Authorization", `Bearer ${orgBAdminToken}`)
      .send({ status: "ACCEPTED" });
    expect(res.status).toBe(404);
  });

  it("23. IDOR: ORG_B user attempting to run simulation on ORG_A scenario is blocked with 404", async () => {
    const res = await request(app)
      .post("/api/scenarios/SCN-ORG_A-001/run")
      .set("Authorization", `Bearer ${orgBAdminToken}`)
      .send({ affectedFirmId: "FIRM-A-01", delayDays: 60 });
    expect(res.status).toBe(404);
  });

  // --- SECTION E: NETWORK GRAPH SCOPING ---

  it("24. Network graph for ORG_A contains only ORG_A firms and zero ORG_B firms", async () => {
    const resA = await request(app)
      .get("/api/network")
      .set("Authorization", `Bearer ${orgAAdminToken}`);
    expect(resA.status).toBe(200);
    const nodeIdsA = resA.body.data.nodes.map((n: any) => n.id);
    expect(nodeIdsA.length).toBe(12);
    expect(nodeIdsA.every((id: string) => id.startsWith("FIRM-A"))).toBe(true);

    const resB = await request(app)
      .get("/api/network")
      .set("Authorization", `Bearer ${orgBAdminToken}`);
    expect(resB.status).toBe(200);
    const nodeIdsB = resB.body.data.nodes.map((n: any) => n.id);
    expect(nodeIdsB.length).toBe(8);
    expect(nodeIdsB.every((id: string) => id.startsWith("FIRM-B"))).toBe(true);

    // Mutual exclusion: no overlap between tenant graphs
    const overlap = nodeIdsA.filter((id: string) => nodeIdsB.includes(id));
    expect(overlap.length).toBe(0);
  });

  // --- SECTION F: CLIENT TAMPERING RESISTANCE ---

  it("25. Client organizationId tampering during bulk import is ignored/overridden by server", async () => {
    const res = await request(app)
      .post("/api/transactions/import")
      .set("Authorization", `Bearer ${orgAAdminToken}`)
      .send({
        // Malicious client claims to be ORG-002 (Bharat Logistics)
        organizationId: "ORG-002",
        transactions: [
          {
            smeId: "FIRM-A-01",
            buyerId: "FIRM-A-02",
            invoiceAmount: 600000,
            invoiceDate: "2026-08-01",
            dueDate: "2026-09-01",
            paymentStatus: "PENDING",
            outstandingAmount: 600000,
          },
        ],
      });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.imported).toBe(1);

    // Verify the newly created transaction belongs to ORG-001, not ORG-002
    const txnsA = await request(app)
      .get("/api/transactions?limit=1&sortBy=createdAt&sortDir=desc")
      .set("Authorization", `Bearer ${orgAAdminToken}`);
    const itemsA = txnsA.body.data.items || txnsA.body.data;
    expect(itemsA[0].organizationId).toBe("ORG-001");
  });

  it("26. Client organizationId tampering during single transaction create is ignored", async () => {
    const res = await request(app)
      .post("/api/transactions")
      .set("Authorization", `Bearer ${orgAAdminToken}`)
      .send({
        organizationId: "ORG-002", // Tampering attempt
        smeId: "FIRM-A-01",
        buyerId: "FIRM-A-02",
        invoiceAmount: 220000,
        invoiceDate: "2026-08-01",
        dueDate: "2026-09-01",
        paymentStatus: "PENDING",
        outstandingAmount: 220000,
      });
    expect(res.status).toBe(201);
    expect(res.body.data.organizationId).toBe("ORG-001");
  });

  // --- SECTION G: ROLE-BASED ACCESS CONTROL (RBAC) MATRIX ---

  it("27. RBAC: VIEWER cannot import transactions (403 Forbidden)", async () => {
    const res = await request(app)
      .post("/api/transactions/import")
      .set("Authorization", `Bearer ${orgAViewerToken}`)
      .send({ count: 1 });
    expect(res.status).toBe(403);
  });

  it("28. RBAC: ANALYST cannot import transactions (403 Forbidden)", async () => {
    const res = await request(app)
      .post("/api/transactions/import")
      .set("Authorization", `Bearer ${orgAAnalystToken}`)
      .send({ count: 1 });
    expect(res.status).toBe(403);
  });

  it("29. RBAC: VIEWER cannot create transactions (403 Forbidden)", async () => {
    const res = await request(app)
      .post("/api/transactions")
      .set("Authorization", `Bearer ${orgAViewerToken}`)
      .send({ invoiceAmount: 10000 });
    expect(res.status).toBe(403);
  });

  it("30. RBAC: VIEWER cannot update transactions (403 Forbidden)", async () => {
    const res = await request(app)
      .put("/api/transactions/TXN-A-0001")
      .set("Authorization", `Bearer ${orgAViewerToken}`)
      .send({ paymentStatus: "PAID" });
    expect(res.status).toBe(403);
  });

  it("31. RBAC: VIEWER cannot delete transactions (403 Forbidden)", async () => {
    const res = await request(app)
      .delete("/api/transactions/TXN-A-0001")
      .set("Authorization", `Bearer ${orgAViewerToken}`);
    expect(res.status).toBe(403);
  });

  it("32. RBAC: ANALYST cannot delete transactions (403 Forbidden)", async () => {
    const res = await request(app)
      .delete("/api/transactions/TXN-A-0001")
      .set("Authorization", `Bearer ${orgAAnalystToken}`);
    expect(res.status).toBe(403);
  });

  it("33. RBAC: VIEWER cannot create firms (403 Forbidden)", async () => {
    const res = await request(app)
      .post("/api/firms")
      .set("Authorization", `Bearer ${orgAViewerToken}`)
      .send({ name: "Unauthorized Firm" });
    expect(res.status).toBe(403);
  });

  it("34. RBAC: VIEWER cannot run scenario simulations (403 Forbidden)", async () => {
    const res = await request(app)
      .post("/api/scenarios/SCN-ORG_A-001/run")
      .set("Authorization", `Bearer ${orgAViewerToken}`)
      .send({ affectedFirmId: "FIRM-A-01", delayDays: 45 });
    expect(res.status).toBe(403);
  });

  it("35. RBAC: ANALYST CAN run scenario simulations (201 Created)", async () => {
    const res = await request(app)
      .post("/api/scenarios/SCN-ORG_A-001/run")
      .set("Authorization", `Bearer ${orgAAnalystToken}`)
      .send({ affectedFirmId: "FIRM-A-01", delayDays: 45 });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.result.cascadeProbability).toBeDefined();
  });

  it("36. RBAC: VIEWER cannot run optimization (403 Forbidden)", async () => {
    const res = await request(app)
      .post("/api/optimization/run")
      .set("Authorization", `Bearer ${orgAViewerToken}`)
      .send({ budget: 1000000 });
    expect(res.status).toBe(403);
  });

  it("37. Transaction completion workflow: Updating transaction to PAID clears outstandingAmount to 0", async () => {
    // 1. Create transaction as SME_ADMIN
    const createRes = await request(app)
      .post("/api/transactions")
      .set("Authorization", `Bearer ${orgAAdminToken}`)
      .send({
        smeId: "FIRM-A-01",
        buyerId: "FIRM-A-02",
        invoiceAmount: 500000,
        outstandingAmount: 500000,
        invoiceDate: "2026-05-01T00:00:00.000Z",
        dueDate: "2026-06-01T00:00:00.000Z",
        creditPeriodDays: 31,
        paymentStatus: "PENDING",
      });
    expect(createRes.status).toBe(201);
    const txnId = createRes.body.data.id;

    // 2. Update to PAID
    const updateRes = await request(app)
      .put(`/api/transactions/${txnId}`)
      .set("Authorization", `Bearer ${orgAAdminToken}`)
      .send({ paymentStatus: "PAID" });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.data.paymentStatus).toBe("PAID");
    expect(Number(updateRes.body.data.outstandingAmount)).toBe(0);
    expect(updateRes.body.data.paymentDate).toBeDefined();
  });
});
