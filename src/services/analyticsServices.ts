import { resolve } from "@/api/client";
import { ENDPOINTS } from "@/api/contracts";
import * as db from "@/mocks/data";
import type { DashboardSummary, NetworkGraph, NetworkNode, Prediction, RiskLevel, RiskScore, TopFirmRow } from "@/types";
import { formatINR } from "@/utils/format";

const outstandingTotal = db.transactions.reduce((s, t) => s + t.outstandingAmount, 0);
const avgDelay = Math.round(
  db.transactions.filter((t) => t.paymentDelayDays).reduce((s, t) => s + (t.paymentDelayDays ?? 0), 0) /
    Math.max(1, db.transactions.filter((t) => t.paymentDelayDays).length),
);
const atRiskFirms = db.firms.filter((f) => f.riskLevel === "HIGH" || f.riskLevel === "CRITICAL").length;
const overallRisk = Math.round(db.firms.reduce((s, f) => s + f.riskScore, 0) / db.firms.length) + 15;

function topRows(role: "buyer" | "supplier"): TopFirmRow[] {
  return [...db.firms]
    .filter((f) => (role === "buyer" ? f.role !== "SUPPLIER" : f.role !== "BUYER"))
    .sort((a, b) => b.riskScore - a.riskScore)
    .slice(0, 6)
    .map((f) => ({
      firmId: f.id,
      name: f.name,
      transactions: f.transactionCount,
      avgDelay: f.avgPaymentDelayDays,
      outstanding: f.outstandingAmount,
      riskLevel: f.riskLevel,
      riskScore: f.riskScore,
    }));
}

const monthLabel = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { month: "short" });

export const dashboardService = {
  getSummary: () =>
    resolve<DashboardSummary>(ENDPOINTS.dashboardSummary, () => ({
      kpis: [
        {
          key: "overall",
          label: "Overall Risk Score",
          value: `${overallRisk} / 100`,
          rawValue: overallRisk,
          trend: 4.1,
          trendLabel: "vs last month",
          status: "HIGH" as RiskLevel,
          tooltip: "Combined score across payment behaviour, financial stress and supply-chain exposure.",
        },
        {
          key: "delay",
          label: "Payment Delay Risk",
          value: "68%",
          rawValue: 68,
          trend: 8.2,
          trendLabel: "this month",
          status: "HIGH" as RiskLevel,
          tooltip: "Likelihood that invoices maturing in the next 30 days will be settled late.",
        },
        {
          key: "stress",
          label: "Financial Stress Risk",
          value: "61%",
          rawValue: 61,
          trend: -2.4,
          trendLabel: "this month",
          status: "MEDIUM" as RiskLevel,
          tooltip: "Estimated pressure on working capital given receivables, payables and cash buffer.",
        },
        {
          key: "firms",
          label: "At-Risk Firms",
          value: String(atRiskFirms),
          rawValue: atRiskFirms,
          trend: 3,
          trendLabel: "new this week",
          status: "HIGH" as RiskLevel,
          tooltip: "Connected firms currently scored High or Critical.",
        },
        {
          key: "cascade",
          label: "Supply Chain Cascade Risk",
          value: "72%",
          rawValue: 72,
          trend: 6.5,
          trendLabel: "this month",
          status: "CRITICAL" as RiskLevel,
          tooltip: "Estimated probability that financial stress may spread to connected firms.",
        },
        {
          key: "outstanding",
          label: "Outstanding Receivables",
          value: formatINR(outstandingTotal),
          rawValue: outstandingTotal,
          trend: 1.8,
          trendLabel: "vs last month",
          status: "MEDIUM" as RiskLevel,
          tooltip: "Total unsettled invoice value across the demo dataset.",
        },
      ],
      paymentDelayTrend: db.seriesDates.map((d, i) => ({
        date: monthLabel(d),
        delay: Math.round(avgDelay * (0.72 + i * 0.035) + (i % 3) * 1.6),
      })),
      outstandingTrend: db.seriesDates.map((d, i) => ({
        date: monthLabel(d),
        amount: Math.round(outstandingTotal * (0.55 + i * 0.04)),
      })),
      riskDistribution: (["LOW", "MEDIUM", "HIGH", "CRITICAL"] as RiskLevel[]).map((level) => ({
        level,
        count: db.firms.filter((f) => f.riskLevel === level).length,
      })),
      stressTrend: db.seriesDates.map((d, i) => ({ date: monthLabel(d), stress: 38 + i * 2 + ((i * 7) % 9) })),
      topRiskyBuyers: topRows("buyer"),
      topRiskySuppliers: topRows("supplier"),
    })),
};

export const riskService = {
  getOverview: () =>
    resolve<RiskScore>(ENDPOINTS.riskOverview, () => ({
      overall: overallRisk,
      level: "HIGH",
      categories: [
        { key: "payment", label: "Payment Risk", description: "Late settlement behaviour across buyers.", score: 68 },
        { key: "stress", label: "Financial Stress", description: "Working-capital pressure on the SME itself.", score: 61 },
        { key: "dependency", label: "Dependency Risk", description: "Concentration on a few buyers or suppliers.", score: 74 },
        { key: "supply", label: "Supply Chain Risk", description: "Fragility of the connected firm network.", score: 57 },
        { key: "cascade", label: "Cascade Risk", description: "Probability that stress spreads to connected firms.", score: 72 },
      ],
      drivers: [
        { label: "4 repeated payment delays", description: "Four invoices from two buyers were settled 30+ days late.", weight: 26, direction: "INCREASES" },
        { label: "62% dependency on one buyer", description: "Receivables are heavily concentrated on a single buyer.", weight: 22, direction: "INCREASES" },
        { label: "High outstanding amount", description: `${formatINR(outstandingTotal)} remains unsettled across open invoices.`, weight: 19, direction: "INCREASES" },
        { label: "Low cash buffer", description: "Cash covers only 16 days of operating cost.", weight: 15, direction: "INCREASES" },
        { label: "Steady invoicing volume", description: "Monthly invoice volume has remained stable for 8 months.", weight: 10, direction: "DECREASES" },
        { label: "Diversified supplier base", description: "No supplier exceeds 25% of total purchases.", weight: 8, direction: "DECREASES" },
      ],
      trend: db.seriesDates.map((d, i) => ({ date: monthLabel(d), score: 44 + i * 2 + ((i * 5) % 7) })),
    })),

  getFirmRisk: (firmId: string) =>
    resolve<RiskScore>(ENDPOINTS.riskForFirm(firmId), () => {
      const firm = db.firmById(firmId)!;
      return {
        firmId,
        overall: firm.riskScore,
        level: firm.riskLevel,
        categories: [
          { key: "payment", label: "Payment Risk", description: "Late settlement behaviour.", score: Math.min(99, firm.riskScore + 4) },
          { key: "stress", label: "Financial Stress", description: "Working-capital pressure.", score: firm.financialStress },
          { key: "dependency", label: "Dependency Risk", description: "Buyer/supplier concentration.", score: Math.max(15, firm.riskScore - 9) },
          { key: "supply", label: "Supply Chain Risk", description: "Network fragility around this firm.", score: Math.max(12, firm.riskScore - 14) },
          { key: "cascade", label: "Cascade Risk", description: "Spread probability to connected firms.", score: Math.min(97, firm.riskScore + 6) },
        ],
        drivers: [
          { label: `Average delay of ${firm.avgPaymentDelayDays} days`, description: "Settlement consistently exceeds agreed credit period.", weight: 30, direction: "INCREASES" },
          { label: `${formatINR(firm.outstandingAmount)} outstanding`, description: "Unsettled receivables relative to turnover.", weight: 24, direction: "INCREASES" },
          { label: `${firm.cashBufferDays}-day cash buffer`, description: "Buffer available before liquidity pressure begins.", weight: 20, direction: firm.cashBufferDays < 25 ? "INCREASES" : "DECREASES" },
          { label: `${firm.buyersCount} active buyers`, description: "Revenue diversification across buyers.", weight: 14, direction: firm.buyersCount > 3 ? "DECREASES" : "INCREASES" },
        ],
        trend: db.seriesDates.map((d, i) => ({ date: monthLabel(d), score: Math.max(10, firm.riskScore - 22 + i * 2 + ((i * 3) % 5)) })),
      };
    }),
};

export const predictionService = {
  getPredictions: () => resolve<Prediction[]>(ENDPOINTS.predictions, () => db.predictions),
  getPredictionById: (id: string) => resolve<Prediction | undefined>(ENDPOINTS.prediction(id), () => db.predictions.find((p) => p.id === id)),
  getPredictionsForFirm: (firmId: string) =>
    resolve<Prediction[]>(`${ENDPOINTS.predictions}?firmId=${firmId}`, () => db.predictions.filter((p) => p.firmId === firmId)),
};

// Deterministic radial layout so the graph is stable across renders.
const nodes: NetworkNode[] = db.firms.map((f, i) => {
  const ring = i % 3;
  const perRing = [7, 7, 6][ring]!;
  const idxInRing = Math.floor(i / 3);
  const angle = (idxInRing / perRing) * Math.PI * 2 + ring * 0.4;
  const radius = 130 + ring * 105;
  const exposure = db.networkEdges
    .filter((e) => e.source === f.id || e.target === f.id)
    .reduce((s, e) => s + e.exposure, 0);
  return {
    id: f.id,
    name: f.name,
    industry: f.industry,
    role: f.role,
    volume: f.transactionCount,
    riskScore: f.riskScore,
    riskLevel: f.riskLevel,
    exposure,
    impact: Math.min(99, Math.round(f.riskScore * 0.6 + (exposure / 10000000) * 8)),
    x: 500 + Math.cos(angle) * radius,
    y: 380 + Math.sin(angle) * radius * 0.82,
  };
});

export const networkService = {
  getNetwork: () => resolve<NetworkGraph>(ENDPOINTS.network, () => ({ nodes, edges: db.networkEdges })),
  getNeighbours: (firmId: string) =>
    db.networkEdges
      .filter((e) => e.source === firmId || e.target === firmId)
      .map((e) => (e.source === firmId ? e.target : e.source)),
};
