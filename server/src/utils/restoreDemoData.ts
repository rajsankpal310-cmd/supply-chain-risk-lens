import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

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

const INDUSTRIES = [
  "Auto Components",
  "Textiles",
  "Engineering",
  "Manufacturing",
  "Food Processing",
  "Electronics",
  "Packaging",
] as const;

const CITIES = [
  "Pune",
  "Coimbatore",
  "Ludhiana",
  "Ahmedabad",
  "Chennai",
  "Rajkot",
  "Nashik",
  "Surat",
  "Faridabad",
  "Hosur",
];

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

/**
 * Idempotently restores the complete canonical demo dataset for ORG-001.
 * Preserves multi-tenant isolation by touching ONLY records owned by ORG-001.
 */
export async function restoreDemoData(prisma: PrismaClient, targetOrgId: string = "ORG-001"): Promise<{
  orgId: string;
  firmsCount: number;
  relationshipsCount: number;
  transactionsCount: number;
  predictionsCount: number;
  recommendationsCount: number;
  alertsCount: number;
  deadlocksCount: number;
  reportsCount: number;
  batchId: string;
}> {
  const rnd = mulberry32(20260813);
  const pick = <T>(arr: readonly T[]) => arr[Math.floor(rnd() * arr.length)]!;
  const int = (min: number, max: number) => Math.floor(rnd() * (max - min + 1)) + min;

  const now = new Date();
  const daysAgo = (d: number) => new Date(now.getTime() - d * 86400000);
  const daysAhead = (d: number) => new Date(now.getTime() + d * 86400000);

  // 1. Ensure Organization exists
  const org = await prisma.organization.upsert({
    where: { id: targetOrgId },
    update: {
      name: "Apex Manufacturing Consortium",
      code: "ORG_A",
      status: "ACTIVE",
    },
    create: {
      id: targetOrgId,
      name: "Apex Manufacturing Consortium",
      code: "ORG_A",
      status: "ACTIVE",
    },
  });

  const passwordHash = await bcrypt.hash("demo1234", 10);

  // 2. Ensure Users for ORG-001 exist
  await prisma.user.upsert({
    where: { email: "demo@nexuscfr.in" },
    update: {
      organizationId: org.id,
      fullName: "Ananya Deshpande",
      companyName: "Apex Manufacturing Consortium",
      industry: "Auto Components",
      role: "SME_ADMIN",
      isActive: true,
    },
    create: {
      id: "USR-001",
      fullName: "Ananya Deshpande",
      email: "demo@nexuscfr.in",
      passwordHash,
      companyName: "Apex Manufacturing Consortium",
      industry: "Auto Components",
      companySize: "51-200",
      role: "SME_ADMIN",
      avatarInitials: "AD",
      organizationId: org.id,
    },
  });

  await prisma.user.upsert({
    where: { email: "analyst@nexus-cfr.demo" },
    update: { organizationId: org.id },
    create: {
      id: "USR-002",
      fullName: "Rajesh Sharma",
      email: "analyst@nexus-cfr.demo",
      passwordHash,
      companyName: "Apex Manufacturing Consortium",
      industry: "Financial Services",
      companySize: "11-50",
      role: "ANALYST",
      avatarInitials: "RS",
      organizationId: org.id,
    },
  });

  await prisma.user.upsert({
    where: { email: "viewer@nexus-cfr.demo" },
    update: { organizationId: org.id },
    create: {
      id: "USR-003",
      fullName: "Priya Mehta",
      email: "viewer@nexus-cfr.demo",
      passwordHash,
      companyName: "Apex Manufacturing Consortium",
      industry: "Investment",
      companySize: "1-10",
      role: "VIEWER",
      avatarInitials: "PM",
      organizationId: org.id,
    },
  });

  // 3. Clean existing ORG-001 records in safe reverse foreign-key order
  await prisma.report.deleteMany({ where: { organizationId: org.id } });
  await prisma.alert.deleteMany({ where: { organizationId: org.id } });
  await prisma.recommendation.deleteMany({ where: { organizationId: org.id } });
  await prisma.deadlock.deleteMany({ where: { organizationId: org.id } });
  await prisma.simulationResult.deleteMany({
    where: { simulationRun: { organizationId: org.id } },
  });
  await prisma.simulationRun.deleteMany({ where: { organizationId: org.id } });
  await prisma.scenario.deleteMany({ where: { organizationId: org.id } });
  await prisma.prediction.deleteMany({ where: { organizationId: org.id } });
  await prisma.transaction.deleteMany({ where: { organizationId: org.id } });
  await prisma.relationship.deleteMany({ where: { organizationId: org.id } });
  await prisma.importBatch.deleteMany({ where: { organizationId: org.id } });
  await prisma.firm.deleteMany({ where: { organizationId: org.id } });

  // 4. Batch Insert Canonical Demo Firms
  const firmData = [];
  for (let i = 0; i < FIRM_NAMES_A.length; i++) {
    const riskScore = [88, 41, 74, 33, 66, 52, 81, 29, 58, 70, 45, 91][i % 12]!;
    const role = i % 4 === 0 ? "BUYER" : i % 4 === 1 ? "SUPPLIER" : i % 4 === 2 ? "SME" : "BUYER_SUPPLIER";
    const riskLevel = riskScore >= 80 ? "CRITICAL" : riskScore >= 62 ? "HIGH" : riskScore >= 40 ? "MEDIUM" : "LOW";
    const status = riskScore >= 80 ? "CRITICAL" : riskScore >= 62 ? "AT_RISK" : riskScore >= 40 ? "WATCH" : "HEALTHY";

    firmData.push({
      id: `FIRM-A-${String(i + 1).padStart(2, "0")}`,
      organizationId: org.id,
      name: FIRM_NAMES_A[i]!,
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
      sourceType: "DEMO_ONLY",
      dataStatus: "DEMO",
    });
  }
  await prisma.firm.createMany({ data: firmData });

  // 5. Batch Insert Canonical Demo Relationships
  const relationshipData = [];
  let relCount = 1;
  for (let i = 0; i < firmData.length; i++) {
    const links = 2 + (i % 2);
    for (let k = 1; k <= links; k++) {
      const target = firmData[(i + k * 2 + 1) % firmData.length]!;
      if (target.id === firmData[i]!.id) continue;
      const dependency = int(15, 88);
      const criticality = dependency >= 80 ? "CRITICAL" : dependency >= 62 ? "HIGH" : dependency >= 40 ? "MEDIUM" : "LOW";
      relationshipData.push({
        id: `REL-A-${String(relCount++).padStart(3, "0")}`,
        organizationId: org.id,
        sourceFirmId: firmData[i]!.id,
        targetFirmId: target.id,
        type: pick(["SUPPLIES_TO", "BUYS_FROM", "SUBCONTRACTS"] as const),
        avgTransactionValue: int(3, 90) * 100000,
        creditPeriodDays: pick([30, 45, 60, 90]),
        dependencyLevel: dependency,
        criticality,
      });
    }
  }
  await prisma.relationship.createMany({ data: relationshipData });

  // 6. Create Demo ImportBatch
  const importBatch = await prisma.importBatch.create({
    data: {
      id: "BAT-ORG_A-001",
      organizationId: org.id,
      sourceType: "DEMO_ONLY",
      sourceName: "Apex Consortium Q3 Ledger (Canonical Demo Dataset)",
      sourceOrg: "Apex Manufacturing Consortium",
      datasetVersion: "v2026.3-demo",
      status: "IMPORTED",
      recordCount: 120,
      acceptedCount: 120,
      rejectedCount: 0,
      duplicateCount: 0,
      dataStatus: "VERIFIED",
      qualityReport: JSON.stringify({
        schemaCompliance: 100,
        completeness: 100,
        validityScore: 98.5,
        contentFingerprint: "sha256-demo-apex-consortium-canonical-v1",
      }),
    },
  });

  // 7. Batch Insert 120 Canonical Demo Transactions
  const transactionData = [];
  for (let i = 0; i < 120; i++) {
    const sme = pick(firmData);
    let buyer = pick(firmData);
    while (buyer.id === sme.id) buyer = pick(firmData);
    let supplier = pick(firmData);
    while (supplier.id === sme.id || supplier.id === buyer.id) supplier = pick(firmData);

    const invoiceAgo = int(10, 240);
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
      paymentStatus === "CRITICAL"
        ? 88
        : paymentStatus === "DELAYED"
        ? 68
        : paymentStatus === "PENDING"
        ? Math.min(70, buyerRisk)
        : 28;
    const riskLevel = riskScore >= 80 ? "CRITICAL" : riskScore >= 62 ? "HIGH" : riskScore >= 40 ? "MEDIUM" : "LOW";

    transactionData.push({
      id: `TXN-A-${String(i + 1).padStart(4, "0")}`,
      organizationId: org.id,
      transactionId: `INV-2026-ORG_A-${String(i + 1).padStart(4, "0")}`,
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
      sourceType: "DEMO_ONLY",
      batchId: importBatch.id,
      dataStatus: "DEMO",
    });
  }
  await prisma.transaction.createMany({ data: transactionData });

  // 8. Batch Insert Predictions
  const predictionData = [];
  for (let i = 0; i < Math.min(firmData.length, 6); i++) {
    const f = firmData[i]!;
    const probability = Math.min(96, Math.max(12, f.riskScore + int(-8, 8)));
    const riskLevel = probability >= 80 ? "CRITICAL" : probability >= 62 ? "HIGH" : probability >= 40 ? "MEDIUM" : "LOW";
    predictionData.push({
      id: `PRD-ORG_A-${String(i + 1).padStart(3, "0")}`,
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
        { label: "High buyer concentration", description: "Over 65% revenue tied to top 2 buyers.", weight: 22, direction: "INCREASES" },
        { label: "Liquidity buffer", description: "Cash runway below 30 days.", weight: 15, direction: "INCREASES" },
      ]),
      horizon: JSON.stringify([
        { days: 30, risk: probability },
        { days: 60, risk: Math.min(99, probability + 8) },
        { days: 90, risk: Math.min(99, probability + 14) },
      ]),
      modelVersion: "phase2-demo",
    });
  }
  await prisma.prediction.createMany({ data: predictionData });

  // 9. Batch Insert Recommendations
  const recommendationData = [];
  for (let i = 0; i < Math.min(firmData.length, 5); i++) {
    const f = firmData[i]!;
    recommendationData.push({
      id: `REC-ORG_A-${String(i + 1).padStart(3, "0")}`,
      organizationId: org.id,
      firmId: f.id,
      firmName: f.name,
      kind: "INVOICE_FINANCING",
      title: `Consider invoice financing for ${f.name}`,
      riskAddressed: "Short-term receivable stress",
      reason: "Delayed receivables exceed working capital buffer.",
      expectedImpact: "Improves cash conversion cycle by 24 days.",
      estimatedRequirement: 2500000,
      priority: f.riskLevel,
      confidence: 82,
      status: "OPEN",
    });
  }
  await prisma.recommendation.createMany({ data: recommendationData });

  // 10. Batch Insert Alerts
  const alertData = [];
  for (let i = 0; i < Math.min(firmData.length, 4); i++) {
    const f = firmData[i]!;
    alertData.push({
      id: `ALT-ORG_A-${String(i + 1).padStart(3, "0")}`,
      organizationId: org.id,
      firmId: f.id,
      firmName: f.name,
      category: "PAYMENT_DELAY",
      severity: f.riskLevel === "LOW" ? "MEDIUM" : f.riskLevel,
      title: `Payment Risk Alert: ${f.name}`,
      reason: "Payment delays observed over recent billing cycle.",
      impact: "Contagion risk on connected suppliers.",
      recommendedAction: "Request early settlement discount or TReDS financing.",
      read: i > 2,
      archived: false,
      date: daysAgo(i + 1),
    });
  }
  await prisma.alert.createMany({ data: alertData });

  // 11. Create Canonical Financial Deadlock
  const f1 = firmData[0]!;
  const f2 = firmData[1]!;
  const f3 = firmData[2]!;
  await prisma.deadlock.create({
    data: {
      id: "DLK-ORG_A-001",
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

  // 12. Create Canonical Scenario & Simulation Run
  const rootFirm = firmData[0]!;
  const scenario = await prisma.scenario.create({
    data: {
      id: "SCN-ORG_A-001",
      organizationId: org.id,
      name: `ORG_A Supply Chain Shock: ${rootFirm.name}`,
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
      id: "SIM-ORG_A-001",
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
          {
            firmId: rootFirm.id,
            firmName: rootFirm.name,
            riskBefore: rootFirm.riskScore,
            riskAfter: Math.min(99, rootFirm.riskScore + 18),
            loss: 1200000,
            step: 0,
          },
        ],
        potentialDefaults: 2,
        cascadeProbability: 72,
        expectedLoss: 3400000,
        maximumImpact: 4800000,
        recoveryDays: 45,
        propagationPath: [rootFirm.id],
        timeline: Array.from({ length: 8 }, (_, idx) => ({
          day: idx * 10,
          stressedFirms: idx + 1,
          loss: idx * 400000,
        })),
      }),
    },
  });

  // 13. Create Canonical Reports
  const reportKeys = [
    { key: "risk-summary", name: "Risk Summary", desc: "Portfolio-level risk scores, drivers and month-on-month movement." },
    { key: "transaction-analysis", name: "Transaction Analysis", desc: "Invoice volumes, ageing buckets and settlement behaviour." },
    { key: "payment-delay", name: "Payment Delay Report", desc: "Delay distribution by buyer, industry and credit period." },
    { key: "supply-chain-risk", name: "Supply Chain Risk Report", desc: "Network exposure, dependency hotspots and critical paths." },
  ];

  const reportData = reportKeys.map((r, i) => ({
    id: `RPT-ORG_A-${String(i + 1).padStart(3, "0")}`,
    organizationId: org.id,
    key: r.key,
    name: r.name,
    description: r.desc,
    status: "READY",
    lastGeneratedAt: daysAgo(i + 1),
  }));
  await prisma.report.createMany({ data: reportData });

  return {
    orgId: org.id,
    firmsCount: firmData.length,
    relationshipsCount: relationshipData.length,
    transactionsCount: transactionData.length,
    predictionsCount: predictionData.length,
    recommendationsCount: recommendationData.length,
    alertsCount: alertData.length,
    deadlocksCount: 1,
    reportsCount: reportKeys.length,
    batchId: importBatch.id,
  };
}
