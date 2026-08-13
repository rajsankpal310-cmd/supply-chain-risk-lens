// Deterministic demo dataset (clearly labelled as DEMO DATA in the UI).
// Replaced by real backend responses when VITE_USE_MOCK_API=false.
import type {
  Alert,
  Deadlock,
  Firm,
  NetworkEdge,
  Prediction,
  Recommendation,
  Relationship,
  Report,
  RiskLevel,
  Scenario,
  Transaction,
} from "@/types";

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
const pick = <T,>(arr: readonly T[]) => arr[Math.floor(rnd() * arr.length)]!;
const int = (min: number, max: number) => Math.floor(rnd() * (max - min + 1)) + min;

export const INDUSTRIES = [
  "Auto Components",
  "Textiles",
  "Engineering",
  "Manufacturing",
  "Food Processing",
  "Electronics",
  "Packaging",
] as const;

export const COMPANY_SIZES = ["1-10", "11-50", "51-200", "201-500", "500+"] as const;

const CITIES = ["Pune", "Coimbatore", "Ludhiana", "Ahmedabad", "Chennai", "Rajkot", "Nashik", "Surat", "Faridabad", "Hosur"];

const FIRM_NAMES = [
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
  "Ganga Agro Foods",
  "Lakshmi Circuit Systems",
  "Tricity Corrugators",
  "Vindhya Auto Parts",
  "Saraswati Looms",
  "Konark Tooling Systems",
  "Neelkanth Rubber Products",
  "Surya Component Systems",
];

function levelFromScore(score: number): RiskLevel {
  if (score >= 80) return "CRITICAL";
  if (score >= 62) return "HIGH";
  if (score >= 40) return "MEDIUM";
  return "LOW";
}
export const riskLevelFromScore = levelFromScore;

const today = new Date("2026-08-13T00:00:00Z");
const isoDaysAgo = (d: number) => new Date(today.getTime() - d * 86400000).toISOString().slice(0, 10);
const isoDaysAhead = (d: number) => new Date(today.getTime() + d * 86400000).toISOString().slice(0, 10);

export const firms: Firm[] = FIRM_NAMES.map((name, i) => {
  const riskScore = [88, 41, 74, 33, 66, 52, 81, 29, 58, 70, 45, 91, 37, 63, 49, 77, 31, 55, 68, 43][i]!;
  const role: Firm["role"] = i % 4 === 0 ? "BUYER" : i % 4 === 1 ? "SUPPLIER" : i % 4 === 2 ? "SME" : "BUYER_SUPPLIER";
  return {
    id: `FIRM-${String(i + 1).padStart(2, "0")}`,
    name,
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
    riskLevel: levelFromScore(riskScore),
    financialStress: Math.min(99, Math.round(riskScore * 0.92 + 4)),
    isDemo: true,
  };
});

export const firmById = (id: string) => firms.find((f) => f.id === id);

export const relationships: Relationship[] = (() => {
  const out: Relationship[] = [];
  let n = 1;
  for (let i = 0; i < firms.length && out.length < 50; i++) {
    const links = 2 + (i % 2);
    for (let k = 1; k <= links && out.length < 50; k++) {
      const target = firms[(i + k * 3 + 1) % firms.length]!;
      if (target.id === firms[i]!.id) continue;
      const dependency = int(15, 88);
      out.push({
        id: `REL-${String(n++).padStart(3, "0")}`,
        sourceFirmId: firms[i]!.id,
        targetFirmId: target.id,
        type: pick(["SUPPLIES_TO", "BUYS_FROM", "SUBCONTRACTS"] as const),
        avgTransactionValue: int(3, 90) * 100000,
        creditPeriodDays: pick([30, 45, 60, 90]),
        dependencyLevel: dependency,
        criticality: levelFromScore(dependency),
      });
    }
  }
  return out;
})();

export const transactions: Transaction[] = Array.from({ length: 200 }, (_, i) => {
  const sme = pick(firms);
  let buyer = pick(firms);
  while (buyer.id === sme.id) buyer = pick(firms);
  let supplier = pick(firms);
  while (supplier.id === sme.id || supplier.id === buyer.id) supplier = pick(firms);

  const invoiceAgo = int(10, 300);
  const creditPeriodDays = pick([30, 45, 60, 90]);
  const invoiceAmount = int(50, 4500) * 10000;
  const dueAgo = invoiceAgo - creditPeriodDays;
  const buyerRisk = buyer.riskScore;
  const roll = rnd() * 100;

  let paymentStatus: Transaction["paymentStatus"];
  let paymentDelayDays: number | undefined;
  let paymentDate: string | undefined;
  let outstandingAmount = 0;

  if (dueAgo > 0) {
    if (roll > buyerRisk * 0.85) {
      paymentDelayDays = Math.max(0, int(-4, 8));
      paymentDate = isoDaysAgo(Math.max(0, dueAgo - paymentDelayDays));
      paymentStatus = "PAID";
    } else {
      paymentDelayDays = Math.round((buyerRisk / 100) * int(12, 95));
      outstandingAmount = Math.round(invoiceAmount * (rnd() * 0.6 + 0.4));
      paymentStatus = paymentDelayDays > 60 ? "CRITICAL" : "DELAYED";
      if (paymentDelayDays < dueAgo) {
        paymentDate = isoDaysAgo(Math.max(0, dueAgo - paymentDelayDays));
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

  return {
    id: `TXN-${String(i + 1).padStart(4, "0")}`,
    smeId: sme.id,
    buyerId: buyer.id,
    supplierId: supplier.id,
    invoiceAmount,
    invoiceDate: isoDaysAgo(invoiceAgo),
    dueDate: dueAgo > 0 ? isoDaysAgo(dueAgo) : isoDaysAhead(-dueAgo),
    paymentDate,
    paymentDelayDays,
    creditPeriodDays,
    outstandingAmount,
    paymentStatus,
    riskLevel: levelFromScore(riskScore),
  };
});

const factorPool = [
  { label: "Repeated payment delays", description: "4 invoices paid 30+ days late in the last 6 months.", weight: 28, direction: "INCREASES" as const },
  { label: "Buyer concentration", description: "62% of receivables depend on a single buyer.", weight: 22, direction: "INCREASES" as const },
  { label: "High outstanding exposure", description: "Outstanding receivables exceed 2 months of turnover.", weight: 18, direction: "INCREASES" as const },
  { label: "Low cash buffer", description: "Cash buffer covers fewer than 20 days of operating cost.", weight: 16, direction: "INCREASES" as const },
  { label: "Long credit period", description: "Average agreed credit period of 90 days strains liquidity.", weight: 10, direction: "INCREASES" as const },
  { label: "Stable order book", description: "Consistent monthly invoicing across 3 buyers.", weight: 12, direction: "DECREASES" as const },
  { label: "Diversified suppliers", description: "No single supplier accounts for more than 25% of purchases.", weight: 9, direction: "DECREASES" as const },
];

export const predictions: Prediction[] = firms.slice(0, 15).map((f, i) => {
  const type: Prediction["type"] = i % 2 === 0 ? "PAYMENT_DELAY" : "FINANCIAL_STRESS";
  const probability = Math.min(96, Math.max(12, f.riskScore + int(-8, 8)));
  return {
    id: `PRD-${String(i + 1).padStart(3, "0")}`,
    firmId: f.id,
    firmName: f.name,
    type,
    probability,
    expectedDelayDays: type === "PAYMENT_DELAY" ? Math.round((probability / 100) * 42) : undefined,
    riskLevel: levelFromScore(probability),
    predictedDate: isoDaysAhead(int(6, 75)),
    confidence: int(62, 94),
    factors: [factorPool[i % 5]!, factorPool[(i + 1) % 5]!, factorPool[5 + (i % 2)]!],
    horizon: [
      { days: 7, risk: Math.round(probability * 0.55) },
      { days: 30, risk: Math.round(probability * 0.78) },
      { days: 60, risk: Math.round(probability * 0.92) },
      { days: 90, risk: probability },
    ],
  };
});

export const recommendations: Recommendation[] = [
  {
    kind: "INVOICE_FINANCING" as const,
    title: "Consider invoice financing for delayed receivables",
    riskAddressed: "Short-term liquidity stress",
    reason: "Buyer has repeatedly delayed payments and receivable exposure is high relative to monthly turnover.",
    expectedImpact: "Reduces short-term liquidity stress; cash conversion cycle improves by ~24 days.",
    estimatedRequirement: 3500000,
    priority: "CRITICAL" as RiskLevel,
    confidence: 87,
  },
  {
    kind: "TREDS" as const,
    title: "Discount approved invoices on a TReDS platform",
    riskAddressed: "Receivable concentration",
    reason: "Approved invoices from a large buyer are eligible for bill discounting at competitive rates.",
    expectedImpact: "Unlocks ~₹28L of blocked working capital within 3 working days.",
    estimatedRequirement: 2800000,
    priority: "HIGH" as RiskLevel,
    confidence: 81,
  },
  {
    kind: "CREDIT_LINE" as const,
    title: "Arrange a standby working-capital credit line",
    riskAddressed: "Cash-flow shock absorption",
    reason: "Cash buffer covers fewer than 18 days while payables mature in 30 days.",
    expectedImpact: "Prevents default propagation to two dependent suppliers.",
    estimatedRequirement: 5000000,
    priority: "HIGH" as RiskLevel,
    confidence: 76,
  },
  {
    kind: "PAYMENT_RESCHEDULING" as const,
    title: "Renegotiate payment schedule with the stressed buyer",
    riskAddressed: "Payment delay risk",
    reason: "Predicted delay of 27 days on invoices maturing this month.",
    expectedImpact: "Converts an unplanned delay into a planned, staged settlement.",
    estimatedRequirement: 0,
    priority: "MEDIUM" as RiskLevel,
    confidence: 72,
  },
  {
    kind: "ALTERNATE_SUPPLIER" as const,
    title: "Qualify an alternate supplier for critical inputs",
    riskAddressed: "Supply-chain dependency",
    reason: "78% of a critical input is sourced from a single high-risk supplier.",
    expectedImpact: "Cuts single-point-of-failure exposure by roughly half.",
    estimatedRequirement: 400000,
    priority: "HIGH" as RiskLevel,
    confidence: 69,
  },
  {
    kind: "ALTERNATE_BUYER" as const,
    title: "Develop an additional buyer in an adjacent segment",
    riskAddressed: "Buyer concentration",
    reason: "A single buyer contributes 62% of revenue and shows rising stress.",
    expectedImpact: "Reduces revenue concentration to below 45% within two quarters.",
    estimatedRequirement: 250000,
    priority: "MEDIUM" as RiskLevel,
    confidence: 64,
  },
  {
    kind: "CASH_BUFFER" as const,
    title: "Build a 30-day operating cash buffer",
    riskAddressed: "Financial stress",
    reason: "Stress score rises sharply whenever a single invoice slips beyond 45 days.",
    expectedImpact: "Absorbs a one-off ₹18L delay without triggering payable defaults.",
    estimatedRequirement: 1800000,
    priority: "MEDIUM" as RiskLevel,
    confidence: 78,
  },
  {
    kind: "DEPENDENCY_REDUCTION" as const,
    title: "Reduce dependency on the highest-exposure relationship",
    riskAddressed: "Cascade risk",
    reason: "This relationship sits on the shortest propagation path in the detected deadlock chain.",
    expectedImpact: "Lowers modelled cascade probability from 72% to 54%.",
    estimatedRequirement: 0,
    priority: "HIGH" as RiskLevel,
    confidence: 74,
  },
].map((r, i) => ({
  ...r,
  id: `REC-${String(i + 1).padStart(3, "0")}`,
  firmId: firms[i]!.id,
  firmName: firms[i]!.name,
  status: "OPEN" as const,
}));

export const alerts: Alert[] = [
  ["PAYMENT_DELAY", "CRITICAL", "Invoice overdue by 74 days", "Buyer has not settled TXN-0042 despite two reminders.", "₹42L receivable blocked; payables to two suppliers at risk."],
  ["FINANCIAL_STRESS", "HIGH", "Financial stress score crossed 80", "Cash buffer dropped below 12 days of operating cost.", "Possible delay on upcoming supplier payments."],
  ["SUPPLY_CHAIN", "HIGH", "Critical supplier flagged high risk", "Sole supplier of machined parts shows rising delays.", "Production continuity risk within 3 weeks."],
  ["CASCADE_RISK", "CRITICAL", "Cascade risk above threshold", "Stress at a hub firm may spread to 6 connected firms.", "Modelled expected loss ₹1.4Cr across the chain."],
  ["DEADLOCK", "HIGH", "Payment chain deadlock detected", "A 4-firm circular exposure chain has stalled.", "₹22L locked across the chain."],
  ["CRITICAL_RISK", "CRITICAL", "Firm risk score reached 91", "Multiple risk drivers triggered simultaneously.", "Default probability within 90 days is elevated."],
  ["PAYMENT_DELAY", "MEDIUM", "Predicted delay on maturing invoices", "Model expects a 27-day delay on invoices due this month.", "Working-capital gap of ~₹12L."],
  ["FINANCIAL_STRESS", "MEDIUM", "Rising receivable ageing", "Ageing beyond 60 days grew 18% month-on-month.", "Liquidity headroom shrinking."],
  ["SUPPLY_CHAIN", "LOW", "New relationship added", "A new buyer relationship was recorded from imported data.", "Network exposure recalculated."],
  ["CASCADE_RISK", "HIGH", "Second-order exposure increased", "Indirect exposure through two hops rose to ₹68L.", "Monitor propagation path weekly."],
].map((a, i) => ({
  id: `ALT-${String(i + 1).padStart(3, "0")}`,
  category: a[0] as Alert["category"],
  severity: a[1] as RiskLevel,
  firmId: firms[i]!.id,
  firmName: firms[i]!.name,
  date: isoDaysAgo(i),
  title: a[2] as string,
  reason: a[3] as string,
  impact: a[4] as string,
  recommendedAction: recommendations[i % recommendations.length]!.title,
  read: i > 6,
  archived: false,
}));

export const deadlocks: Deadlock[] = Array.from({ length: 5 }, (_, i) => {
  const chainFirms = [firms[i]!, firms[(i + 4) % firms.length]!, firms[(i + 8) % firms.length]!, firms[(i + 12) % firms.length]!];
  const chain = chainFirms.map((f, k) => ({
    firmId: f.id,
    firmName: f.name,
    owesAmount: (10 - k * 2) * 100000 + i * 50000,
    stress: Math.max(20, f.financialStress - k * 6),
  }));
  const totalExposure = chain.reduce((s, c) => s + c.owesAmount, 0);
  const deadlockRisk = Math.min(95, 55 + i * 8);
  return {
    id: `DLK-${String(i + 1).padStart(3, "0")}`,
    rootFirmId: chainFirms[0]!.id,
    rootFirmName: chainFirms[0]!.name,
    severity: levelFromScore(deadlockRisk),
    deadlockRisk,
    chain,
    totalExposure,
    estimatedImpact: Math.round(totalExposure * 1.4),
    detectedAt: isoDaysAgo(i * 2 + 1),
    resolved: false,
  };
});

export const scenarios: Scenario[] = [
  { name: "Major buyer payment delay", type: "BUYER_PAYMENT_DELAY" as const, delayDays: 60, amount: 5000000, severity: "HIGH", durationDays: 90, recoveryRate: 45 },
  { name: "Critical supplier failure", type: "SUPPLIER_FAILURE" as const, delayDays: 0, amount: 3200000, severity: "CRITICAL", durationDays: 120, recoveryRate: 30 },
  { name: "High dependency buyer loss", type: "MAJOR_BUYER_LOSS" as const, delayDays: 0, amount: 8000000, severity: "CRITICAL", durationDays: 180, recoveryRate: 25 },
  { name: "Cash-flow shock", type: "CASH_FLOW_SHOCK" as const, delayDays: 30, amount: 2500000, severity: "MEDIUM", durationDays: 60, recoveryRate: 60 },
  { name: "Natural disaster disruption", type: "NATURAL_DISASTER" as const, delayDays: 21, amount: 6500000, severity: "HIGH", durationDays: 75, recoveryRate: 40 },
].map((s, i) => ({
  ...s,
  id: `SCN-${String(i + 1).padStart(3, "0")}`,
  affectedFirmId: firms[i * 2]!.id,
  createdAt: isoDaysAgo(i * 3 + 2),
  severity: s.severity as RiskLevel,
}));

export const reports: Report[] = [
  { key: "risk-summary", name: "Risk Summary", description: "Portfolio-level risk scores, drivers and month-on-month movement." },
  { key: "transaction-analysis", name: "Transaction Analysis", description: "Invoice volumes, ageing buckets and settlement behaviour." },
  { key: "payment-delay", name: "Payment Delay Report", description: "Delay distribution by buyer, industry and credit period." },
  { key: "supply-chain-risk", name: "Supply Chain Risk Report", description: "Network exposure, dependency hotspots and critical paths." },
  { key: "scenario", name: "Scenario Report", description: "Configured what-if scenarios and their simulated outcomes." },
  { key: "deadlock", name: "Financial Deadlock Report", description: "Detected payment chains, locked exposure and resolution options." },
  { key: "recommendation", name: "Recommendation Report", description: "Prioritised interventions with expected impact and requirement." },
].map((r, i) => ({
  ...r,
  id: `RPT-${String(i + 1).padStart(3, "0")}`,
  status: i < 3 ? ("READY" as const) : ("NOT_GENERATED" as const),
  lastGeneratedAt: i < 3 ? isoDaysAgo(i + 1) : undefined,
}));

export const networkEdges: NetworkEdge[] = relationships.map((r) => ({
  id: r.id,
  source: r.sourceFirmId,
  target: r.targetFirmId,
  exposure: r.avgTransactionValue,
  dependency: r.dependencyLevel,
  criticality: r.criticality,
}));

export const demoUser = {
  id: "USR-001",
  fullName: "Ananya Deshpande",
  email: "demo@nexuscfr.in",
  companyName: "Sundaram Auto Components",
  industry: "Auto Components",
  companySize: "51-200",
  role: "SME_ADMIN" as const,
  avatarInitials: "AD",
};

export const seriesDates = Array.from({ length: 12 }, (_, i) => isoDaysAgo((11 - i) * 30));
