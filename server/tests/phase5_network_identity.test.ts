import { describe, it, expect } from "vitest";
import { sanitizeCompanyName } from "../src/utils/sanitize";
import { NetworkService } from "../src/services/network.service";
import { prisma } from "../src/config/database";

describe("Phase 5: Network Graph & Company Identity Verification", () => {
  describe("Company Name Sanitization & Formatting", () => {
    it("preserves valid company names", () => {
      expect(sanitizeCompanyName("Sundaram Auto Components")).toBe("Sundaram Auto Components");
      expect(sanitizeCompanyName("  Tata Motors Ltd  ")).toBe("Tata Motors Ltd");
    });

    it("sanitizes null and undefined with clean fallbacks", () => {
      expect(sanitizeCompanyName(null, "FIRM-01")).toBe("Firm FIRM-01");
      expect(sanitizeCompanyName(undefined, "CUST-999")).toBe("Counterparty (CUST-999)");
      expect(sanitizeCompanyName(undefined)).toBe("Unknown Enterprise");
    });

    it("prevents literal 'undefined', 'null', '[object Object]' or 'NaN'", () => {
      expect(sanitizeCompanyName("undefined", "FIRM-02")).toBe("Firm FIRM-02");
      expect(sanitizeCompanyName("null", "CUST-100")).toBe("Counterparty (CUST-100)");
      expect(sanitizeCompanyName("[object Object]", "FIRM-05")).toBe("Firm FIRM-05");
      expect(sanitizeCompanyName("NaN", "FIRM-08")).toBe("Firm FIRM-08");
      expect(sanitizeCompanyName("   ", "FIRM-09")).toBe("Firm FIRM-09");
    });

    it("unwraps object instances safely", () => {
      expect(sanitizeCompanyName({ name: "Bajaj Electricals" })).toBe("Bajaj Electricals");
      expect(sanitizeCompanyName({ companyName: "Mahindra & Mahindra" })).toBe("Mahindra & Mahindra");
      expect(sanitizeCompanyName({ label: "Larsen & Toubro" })).toBe("Larsen & Toubro");
      expect(sanitizeCompanyName({}, "FIRM-12")).toBe("Firm FIRM-12");
    });
  });

  describe("NetworkService Enterprise Graph & Identity Mapping", () => {
    const testOrgId = `test-org-identity-${Date.now()}`;

    it("ensures all graph nodes have non-empty, sanitized company names and unique IDs", async () => {
      // Create a test organization
      await prisma.organization.create({
        data: {
          id: testOrgId,
          name: "Audit Identity Test Org",
          code: `CODE-${testOrgId}`,
        },
      });

      // Create test firms: one valid, one with empty name, one with [object Object]
      await prisma.firm.createMany({
        data: [
          {
            id: `firm-valid-${testOrgId}`,
            organizationId: testOrgId,
            name: "Alpha Corp Industries",
            industry: "Manufacturing",
            role: "SME",
            city: "Pune",
          },
          {
            id: `firm-empty-${testOrgId}`,
            organizationId: testOrgId,
            name: "",
            industry: "Engineering",
            role: "BUYER",
            city: "Mumbai",
          },
          {
            id: `firm-obj-${testOrgId}`,
            organizationId: testOrgId,
            name: "[object Object]",
            industry: "Textiles",
            role: "SUPPLIER",
            city: "Surat",
          },
        ],
      });

      // Create a transaction between firm-valid and firm-empty
      await prisma.transaction.create({
        data: {
          id: `txn-net-${testOrgId}-1`,
          organizationId: testOrgId,
          smeId: `firm-valid-${testOrgId}`,
          buyerId: `firm-empty-${testOrgId}`,
          invoiceAmount: 500000,
          outstandingAmount: 250000,
          invoiceDate: new Date(),
          dueDate: new Date(Date.now() + 30 * 86400000),
          paymentStatus: "PENDING",
        },
      });

      // Fetch network graph
      const graph = await NetworkService.getNetwork(testOrgId);

      expect(graph).toBeDefined();
      expect(graph.nodes.length).toBeGreaterThanOrEqual(3);

      // Verify no node has undefined or [object Object] as its display name
      for (const node of graph.nodes) {
        expect(node.id).toBeTruthy();
        expect(typeof node.name).toBe("string");
        expect(node.name.length).toBeGreaterThan(0);
        expect(node.name).not.toBe("undefined");
        expect(node.name).not.toBe("[object Object]");
        expect(node.name).not.toBe("null");
      }

      // Verify valid firm preserved exact name
      const validNode = graph.nodes.find((n) => n.id === `firm-valid-${testOrgId}`);
      expect(validNode?.name).toBe("Alpha Corp Industries");

      // Verify empty firm fell back to safe counterparty identity
      const emptyNode = graph.nodes.find((n) => n.id === `firm-empty-${testOrgId}`);
      expect(emptyNode?.name).toContain(`firm-empty-${testOrgId}`);

      // Verify [object Object] firm was sanitized
      const objNode = graph.nodes.find((n) => n.id === `firm-obj-${testOrgId}`);
      expect(objNode?.name).not.toBe("[object Object]");

      // Verify derived edge was created connecting firm-valid and firm-empty
      const edge = graph.edges.find(
        (e) =>
          (e.source === `firm-valid-${testOrgId}` && e.target === `firm-empty-${testOrgId}`) ||
          (e.source === `firm-empty-${testOrgId}` && e.target === `firm-valid-${testOrgId}`)
      );
      expect(edge).toBeDefined();
      expect(edge?.activeExposure).toBe(250000);
      expect(edge?.hasActiveTransactions).toBe(true);

      // Clean up test data safely
      await prisma.transaction.deleteMany({ where: { organizationId: testOrgId } });
      await prisma.firm.deleteMany({ where: { organizationId: testOrgId } });
      await prisma.organization.delete({ where: { id: testOrgId } });
    }, 90000);
  });
});
