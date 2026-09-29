import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { ingestVerifiedB2BDataset } from "../src/pipeline/ingestRealData";

const prisma = new PrismaClient();

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(20260813);
const pick = <T>(arr: readonly T[]) => arr[Math.floor(rnd() * arr.length)]!;
const int = (min: number, max: number) => Math.floor(rnd() * (max - min + 1)) + min;

const INDUSTRIES = [
  "Auto Components",
  "Textiles",
  "Engineering",
  "Manufacturing",
  "Food Processing",
  "Electronics",
  "Packaging",
] as const;

const CITIES = ["Pune", "Coimbatore", "Ludhiana", "Ahmedabad", "Chennai", "Rajkot", "Nashik", "Surat", "Faridabad", "Hosur"];

const FIRM_NAMES_A = [
  "Sundaram Auto Components",
  "Krishna Textiles Mills",
  "Vertex Engineering Works",
  "Nandi Precision Manufacturing",
  "Annapurna Food Processing",
  "Meridian Electronics",
  "Shakti Packaging Solutions",
  "Deccan Forge & Castings",
  "Bharat Polymers",
  "Sharda Industrial Fasteners",
  "Coromandel Weavers",
  "Aravalli Metal Works",
];

const FIRM_NAMES_B = [
  "Ganga Agro Logistics",
  "Lakshmi Circuit Distribution",
  "Tricity Cargo Carriers",
  "Vindhya Supply Solutions",
  "Saraswati Warehousing",
  "Konark Freight Forwarders",
  "Neelkanth Transport Fleet",
  "Surya Cold Chain Systems",
];

const today = new Date("2026-08-13T00:00:00Z");
const daysAgo = (d: number) => new Date(today.getTime() - d * 86400000);
const daysAhead = (d: number) => new Date(today.getTime() + d * 86400000);

async function main() {
  console.log("Seeding NEXUS-CFR multi-tenant database...");

  // Clean existing data in reverse dependency order
  await prisma.report.deleteMany();
  await prisma.alert.deleteMany();
  await prisma.recommendation.deleteMany();
  await prisma.deadlock.deleteMany();
  await prisma.simulationResult.deleteMany();
  await prisma.simulationRun.deleteMany();
  await prisma.scenario.deleteMany();
  await prisma.prediction.deleteMany();
  await prisma.relationship.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.importBatch.deleteMany();
  await prisma.firm.deleteMany();
  await prisma.user.deleteMany();
  await prisma.optimizationRun.deleteMany();
  await prisma.organization.deleteMany();

  const passwordHash = await bcrypt.hash("demo1234", 10);

  // 1. Create Organizations
  const orgA = await prisma.organization.create({
    data: {
      id: "ORG-001",
      name: "Apex Manufacturing Consortium",
      code: "ORG_A",
      status: "ACTIVE",
    },
  });

  const orgB = await prisma.organization.create({
    data: {
      id: "ORG-002",
      name: "Bharat Logistics & Distribution",
      code: "ORG_B",
      status: "ACTIVE",
    },
  });

  const orgReal = await prisma.organization.create({
    data: {
      id: "ORG-003",
      name: "National Industrial Supply Consortium (Simulated B2B Benchmark)",
      code: "ORG_REAL",
      status: "ACTIVE",
    },
  });

  console.log("Created 3 organizations: ORG_A, ORG_B, and ORG_REAL");

  // 2. Create Users for ORG_A
  await prisma.user.create({
    data: {
      id: "USR-001",
      fullName: "Ananya Deshpande",
      email: "demo@nexuscfr.in",
      passwordHash,
      companyName: "Apex Manufacturing Consortium",
      industry: "Auto Components",
      companySize: "51-200",
      role: "SME_ADMIN",
      avatarInitials: "AD",
      organizationId: orgA.id,
    },
  });

  await prisma.user.create({
    data: {
      id: "USR-002",
      fullName: "Rajesh Sharma",
      email: "analyst@nexus-cfr.demo",
      passwordHash,
      companyName: "Apex Manufacturing Consortium",
      industry: "Financial Services",
      companySize: "11-50",
      role: "ANALYST",
      avatarInitials: "RS",
      organizationId: orgA.id,
    },
  });

  await prisma.user.create({
    data: {
      id: "USR-003",
      fullName: "Priya Mehta",
      email: "viewer@nexus-cfr.demo",
      passwordHash,
      companyName: "Apex Manufacturing Consortium",
      industry: "Investment",
      companySize: "1-10",
      role: "VIEWER",
      avatarInitials: "PM",
      organizationId: orgA.id,
    },
  });

  // 3. Create Users for ORG_B
  await prisma.user.create({
    data: {
      id: "USR-004",
      fullName: "Vikram Singhania",
      email: "admin@orgb.demo",
      passwordHash,
      companyName: "Bharat Logistics & Distribution",
      industry: "Logistics",
      companySize: "101-500",
      role: "SME_ADMIN",
      avatarInitials: "VS",
      organizationId: orgB.id,
    },
  });

  await prisma.user.create({
    data: {
      id: "USR-005",
      fullName: "Sunita Rao",
      email: "analyst@orgb.demo",
      passwordHash,
      companyName: "Bharat Logistics & Distribution",
      industry: "Supply Chain",
      companySize: "51-200",
      role: "ANALYST",
      avatarInitials: "SR",
      organizationId: orgB.id,
    },
  });

  await prisma.user.create({
    data: {
      id: "USR-006",
      fullName: "Amitabh Sen",
      email: "viewer@orgb.demo",
      passwordHash,
      companyName: "Bharat Logistics & Distribution",
      industry: "Logistics",
      companySize: "11-50",
      role: "VIEWER",
      avatarInitials: "AS",
      organizationId: orgB.id,
    },
  });

  await prisma.user.create({
    data: {
      id: "USR-007",
      fullName: "Devendra Kulkarni",
      email: "realadmin@nexuscfr.in",
      passwordHash,
      companyName: "National Industrial Supply Consortium",
      industry: "Manufacturing & Supply",
      companySize: "101-500",
      role: "SME_ADMIN",
      avatarInitials: "DK",
      organizationId: orgReal.id,
    },
  });

  console.log("Created 7 users across ORG_A, ORG_B, and ORG_REAL");

  // Helper to seed an organization's business dataset
  async function seedOrganizationData(
    org: { id: string; name: string; code: string },
    firmNames: string[],
    firmIdPrefix: string,
    txnIdPrefix: string,
    relIdPrefix: string,
    startIdx: number,
    firmCount: number,
    txnCount: number
  ) {
    const createdFirms = [];
    for (let i = 0; i < firmNames.length; i++) {
      const riskScore = [88, 41, 74, 33, 66, 52, 81, 29, 58, 70, 45, 91][i % 12]!;
      const role = i % 4 === 0 ? "BUYER" : i % 4 === 1 ? "SUPPLIER" : i % 4 === 2 ? "SME" : "BUYER_SUPPLIER";
      const riskLevel = riskScore >= 80 ? "CRITICAL" : riskScore >= 62 ? "HIGH" : riskScore >= 40 ? "MEDIUM" : "LOW";
      const status = riskScore >= 80 ? "CRITICAL" : riskScore >= 62 ? "AT_RISK" : riskScore >= 40 ? "WATCH" : "HEALTHY";

      const firm = await prisma.firm.create({
        data: {
          id: `${firmIdPrefix}-${String(i + 1).padStart(2, "0")}`,
          organizationId: org.id,
          name: firmNames[i]!,
          industry: INDUSTRIES[i % INDUSTRIES.length]!,
          role,
          city: CITIES[i % CITIES.length]!,
          transactionCount: int(6, 34),
          buyersCount: int(1, 7),
          suppliersCount: int(1, 6),
          avgPaymentDelayDays: Math.round((riskScore / 100) * 48 + rnd() * 6),
          outstandingAmount: int(8, 220) * 100000,
          annualTurnover: int(4, 90) * 10000000,
          cashBufferDays: Math.max(4, 70 - Math.round(riskScore * 0.6)),
          riskScore,
          riskLevel,
          financialStress: Math.min(99, Math.round(riskScore * 0.92 + 4)),
          status,
          isDemo: true,
        },
      });
      createdFirms.push(firm);
    }

    // Relationships
    let relCount = 1;
    for (let i = 0; i < createdFirms.length; i++) {
      const links = 2 + (i % 2);
      for (let k = 1; k <= links; k++) {
        const target = createdFirms[(i + k * 2 + 1) % createdFirms.length]!;
        if (target.id === createdFirms[i]!.id) continue;
        const dependency = int(15, 88);
        const criticality = dependency >= 80 ? "CRITICAL" : dependency >= 62 ? "HIGH" : dependency >= 40 ? "MEDIUM" : "LOW";
        await prisma.relationship.create({
          data: {
            id: `${relIdPrefix}-${String(relCount++).padStart(3, "0")}`,
            organizationId: org.id,
            sourceFirmId: createdFirms[i]!.id,
            targetFirmId: target.id,
            type: pick(["SUPPLIES_TO", "BUYS_FROM", "SUBCONTRACTS"] as const),
            avgTransactionValue: int(3, 90) * 100000,
            creditPeriodDays: pick([30, 45, 60, 90]),
            dependencyLevel: dependency,
            criticality,
          },
        });
      }
    }

    // Transactions
    for (let i = 0; i < txnCount; i++) {
      const sme = pick(createdFirms);
      let buyer = pick(createdFirms);
      while (buyer.id === sme.id) buyer = pick(createdFirms);
      let supplier = pick(createdFirms);
      while (supplier.id === sme.id || supplier.id === buyer.id) supplier = pick(createdFirms);

      const invoiceAgo = int(10, 300);
      const creditPeriodDays = pick([30, 45, 60, 90]);
      const invoiceAmount = int(50, 4500) * 10000;
      const dueAgo = invoiceAgo - creditPeriodDays;
      const buyerRisk = buyer.riskScore;
      const roll = rnd() * 100;

      let paymentStatus: string;
      let paymentDelayDays: number | undefined;
      let paymentDate: Date | undefined;
      let outstandingAmount = 0;

      if (dueAgo > 0) {
        if (roll > buyerRisk * 0.85) {
          paymentDelayDays = Math.max(0, int(-4, 8));
          paymentDate = daysAgo(Math.max(0, dueAgo - paymentDelayDays));
          paymentStatus = "PAID";
        } else {
          paymentDelayDays = Math.round((buyerRisk / 100) * int(12, 95));
          outstandingAmount = Math.round(invoiceAmount * (rnd() * 0.6 + 0.4));
          paymentStatus = paymentDelayDays > 60 ? "CRITICAL" : "DELAYED";
          if (paymentDelayDays < dueAgo) {
            paymentDate = daysAgo(Math.max(0, dueAgo - paymentDelayDays));
            outstandingAmount = 0;
            paymentStatus = "PAID";
          }
        }
      } else {
        paymentStatus = "PENDING";
        outstandingAmount = invoiceAmount;
      }

      const riskScore =
        paymentStatus === "CRITICAL" ? 88 : paymentStatus === "DELAYED" ? 68 : paymentStatus === "PENDING" ? Math.min(70, buyerRisk) : 28;
      const riskLevel = riskScore >= 80 ? "CRITICAL" : riskScore >= 62 ? "HIGH" : riskScore >= 40 ? "MEDIUM" : "LOW";

      await prisma.transaction.create({
        data: {
          id: `${txnIdPrefix}-${String(i + 1).padStart(4, "0")}`,
          organizationId: org.id,
          transactionId: `INV-2026-${org.code}-${String(i + 1).padStart(4, "0")}`,
          smeId: sme.id,
          buyerId: buyer.id,
          supplierId: supplier.id,
          invoiceAmount,
          outstandingAmount,
          invoiceDate: daysAgo(invoiceAgo),
          dueDate: dueAgo > 0 ? daysAgo(dueAgo) : daysAhead(-dueAgo),
          paymentDate,
          creditPeriodDays,
          paymentDelayDays,
          paymentStatus,
          riskLevel,
        },
      });
    }

    // Predictions
    for (let i = 0; i < Math.min(createdFirms.length, 6); i++) {
      const f = createdFirms[i]!;
      const probability = Math.min(96, Math.max(12, f.riskScore + int(-8, 8)));
      const riskLevel = probability >= 80 ? "CRITICAL" : probability >= 62 ? "HIGH" : probability >= 40 ? "MEDIUM" : "LOW";
      await prisma.prediction.create({
        data: {
          id: `PRD-${org.code}-${String(i + 1).padStart(3, "0")}`,
          organizationId: org.id,
          firmId: f.id,
          type: "PAYMENT_DELAY",
          probability,
          expectedDelayDays: Math.round((probability / 100) * 42),
          riskLevel,
          predictedDate: daysAhead(int(6, 75)),
          confidence: int(65, 92),
          factors: JSON.stringify([
            { label: "Repeated payment delays", description: "Invoices settled past due date.", weight: 28, direction: "INCREASES" },
          ]),
          horizon: JSON.stringify([{ days: 30, risk: probability }]),
          modelVersion: "phase2-demo",
        },
      });
    }

    // Recommendations
    for (let i = 0; i < Math.min(createdFirms.length, 5); i++) {
      const f = createdFirms[i]!;
      await prisma.recommendation.create({
        data: {
          id: `REC-${org.code}-${String(i + 1).padStart(3, "0")}`,
          organizationId: org.id,
          firmId: f.id,
          firmName: f.name,
          kind: "INVOICE_FINANCING",
          title: `Consider invoice financing for ${f.name}`,
          riskAddressed: "Short-term receivable stress",
          reason: "Delayed receivables exceed working capital buffer.",
          expectedImpact: "Improves cash conversion cycle.",
          estimatedRequirement: 2500000,
          priority: f.riskLevel,
          confidence: 82,
          status: "OPEN",
        },
      });
    }

    // Alerts
    for (let i = 0; i < Math.min(createdFirms.length, 4); i++) {
      const f = createdFirms[i]!;
      await prisma.alert.create({
        data: {
          id: `ALT-${org.code}-${String(i + 1).padStart(3, "0")}`,
          organizationId: org.id,
          firmId: f.id,
          firmName: f.name,
          category: "PAYMENT_DELAY",
          severity: f.riskLevel === "LOW" ? "MEDIUM" : (f.riskLevel as any),
          title: `Payment Risk Alert: ${f.name}`,
          reason: "Payment delays observed over recent billing cycle.",
          impact: "Contagion risk on connected suppliers.",
          recommendedAction: "Request early settlement discount or TReDS financing.",
          read: i > 2,
          archived: false,
          date: daysAgo(i + 1),
        },
      });
    }

    // Deadlocks
    if (createdFirms.length >= 3) {
      const f1 = createdFirms[0]!;
      const f2 = createdFirms[1]!;
      const f3 = createdFirms[2]!;
      await prisma.deadlock.create({
        data: {
          id: `DLK-${org.code}-001`,
          organizationId: org.id,
          rootFirmId: f1.id,
          rootFirmName: f1.name,
          severity: "HIGH",
          deadlockRisk: 74,
          chain: JSON.stringify([
            { firmId: f1.id, firmName: f1.name, owesAmount: 1200000, stress: 72 },
            { firmId: f2.id, firmName: f2.name, owesAmount: 900000, stress: 68 },
            { firmId: f3.id, firmName: f3.name, owesAmount: 850000, stress: 65 },
          ]),
          totalExposure: 2950000,
          estimatedImpact: 3800000,
          status: "OPEN",
          resolved: false,
          detectedAt: daysAgo(2),
        },
      });
    }

    // Scenario & Simulation
    const rootFirm = createdFirms[0]!;
    const scenario = await prisma.scenario.create({
      data: {
        id: `SCN-${org.code}-001`,
        organizationId: org.id,
        name: `${org.code} Supply Chain Shock: ${rootFirm.name}`,
        description: "Simulated buyer payment delay shock across connected supply chain.",
        type: "BUYER_PAYMENT_DELAY",
        affectedFirmId: rootFirm.id,
        severity: "HIGH",
        delayDays: 60,
        amount: 5000000,
        durationDays: 90,
        recoveryRate: 45,
      },
    });

    await prisma.simulationRun.create({
      data: {
        id: `SIM-${org.code}-001`,
        organizationId: org.id,
        scenarioId: scenario.id,
        rootFirmId: rootFirm.id,
        status: "COMPLETED",
        cascadeRisk: 72,
        expectedLoss: 3400000,
        maximumImpact: 4800000,
        startedAt: daysAgo(2),
        completedAt: daysAgo(2),
        result: JSON.stringify({
          affectedFirms: [
            { firmId: rootFirm.id, firmName: rootFirm.name, riskBefore: rootFirm.riskScore, riskAfter: Math.min(99, rootFirm.riskScore + 18), loss: 1200000, step: 0 },
          ],
          potentialDefaults: 2,
          cascadeProbability: 72,
          expectedLoss: 3400000,
          maximumImpact: 4800000,
          recoveryDays: 45,
          propagationPath: [rootFirm.id],
          timeline: Array.from({ length: 8 }, (_, idx) => ({ day: idx * 10, stressedFirms: idx + 1, loss: idx * 400000 })),
        }),
      },
    });

    // Reports
    const reportKeys = [
      { key: "risk-summary", name: "Risk Summary", desc: "Portfolio-level risk scores, drivers and month-on-month movement." },
      { key: "transaction-analysis", name: "Transaction Analysis", desc: "Invoice volumes, ageing buckets and settlement behaviour." },
      { key: "payment-delay", name: "Payment Delay Report", desc: "Delay distribution by buyer, industry and credit period." },
      { key: "supply-chain-risk", name: "Supply Chain Risk Report", desc: "Network exposure, dependency hotspots and critical paths." },
    ];

    for (let i = 0; i < reportKeys.length; i++) {
      const r = reportKeys[i]!;
      await prisma.report.create({
        data: {
          id: `RPT-${org.code}-${String(i + 1).padStart(3, "0")}`,
          organizationId: org.id,
          key: r.key,
          name: r.name,
          description: r.desc,
          status: i < 2 ? "READY" : "NOT_GENERATED",
          lastGeneratedAt: i < 2 ? daysAgo(i + 1) : null,
        },
      });
    }
  }

  // Seed ORG_A: 12 firms, 120 txns
  await seedOrganizationData(orgA, FIRM_NAMES_A, "FIRM-A", "TXN-A", "REL-A", 1, 12, 120);
  console.log("Seeded ORG_A data (Apex Manufacturing Consortium)");

  // Seed ORG_B: 8 firms, 80 txns
  await seedOrganizationData(orgB, FIRM_NAMES_B, "FIRM-B", "TXN-B", "REL-B", 13, 8, 80);
  console.log("Seeded ORG_B data (Bharat Logistics & Distribution)");

  // Seed ORG_REAL with verified real B2B dataset via Phase 3 pipeline
  console.log("Ingesting verified real-world B2B dataset for ORG-003...");
  await ingestVerifiedB2BDataset(orgReal.id, "realadmin@nexuscfr.in");
  console.log("Seeded ORG_REAL data (National Industrial Supply Consortium)");

  console.log("NEXUS-CFR Multi-Tenant Database Seeding Completed Successfully!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
