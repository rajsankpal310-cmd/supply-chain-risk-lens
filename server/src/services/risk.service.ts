import { FirmRepository } from "../repositories/firm.repository";
import { RelationshipRepository } from "../repositories/relationship.repository";
import { TransactionRepository } from "../repositories/transaction.repository";
import { recalculateFirmRisk } from "../utils/riskCalculator";

export class RiskService {
  static async getOverview(organizationId: string) {
    const firms = await FirmRepository.findAll(organizationId);
    const transactions = await TransactionRepository.findMany(organizationId, {}, { invoiceDate: "desc" }, 0, 10000);
    const relationships = await RelationshipRepository.findAll(organizationId);

    // Empty organization check: 0 firms and 0 transactions
    if (firms.length === 0 && transactions.length === 0) {
      return {
        isEmpty: true,
        overall: null,
        level: "NO_DATA",
        categories: [
          { key: "payment", label: "Payment Risk", description: "Late settlement behaviour across buyers.", score: null },
          { key: "stress", label: "Financial Stress", description: "Working-capital pressure on SMEs.", score: null },
          { key: "dependency", label: "Dependency Risk", description: "Concentration on key buyers or suppliers.", score: null },
          { key: "supply", label: "Supply Chain Risk", description: "Fragility of the connected firm network.", score: null },
          { key: "cascade", label: "Cascade Risk", description: "Probability that stress spreads to connected firms.", score: null },
        ],
        drivers: [],
        trend: [],
      };
    }

    const overall = firms.length ? Math.round(firms.reduce((s: number, f: any) => s + f.riskScore, 0) / firms.length) : 0;

    const delayedTxns = transactions.filter((t: any) => t.paymentDelayDays && t.paymentDelayDays > 0);
    const avgDelayScore = delayedTxns.length ? Math.min(99, Math.round((delayedTxns.reduce((s: number, t: any) => s + (t.paymentDelayDays || 0), 0) / delayedTxns.length) * 1.5 + 25)) : 0;

    const avgStress = firms.length ? Math.round(firms.reduce((s: number, f: any) => s + f.financialStress, 0) / firms.length) : 0;

    const avgDependency = relationships.length ? Math.round(relationships.reduce((s: number, r: any) => s + r.dependencyLevel, 0) / relationships.length) : 0;

    const criticalRels = relationships.filter((r: any) => r.criticality === "HIGH" || r.criticality === "CRITICAL").length;
    const supplyChainScore = Math.min(99, Math.round(avgDependency * 0.7 + (criticalRels / Math.max(1, relationships.length)) * 40));

    const cascadeScore = Math.min(99, Math.round(overall * 0.5 + avgDependency * 0.3 + (delayedTxns.length / Math.max(1, transactions.length)) * 35));

    const level = overall >= 80 ? "CRITICAL" : overall >= 62 ? "HIGH" : overall >= 40 ? "MEDIUM" : "LOW";

    const totalOutstanding = transactions.reduce((s: number, t: any) => s + t.outstandingAmount, 0);

    return {
      isEmpty: false,
      overall,
      level,
      categories: [
        { key: "payment", label: "Payment Risk", description: "Late settlement behaviour across buyers.", score: avgDelayScore },
        { key: "stress", label: "Financial Stress", description: "Working-capital pressure on SMEs.", score: avgStress },
        { key: "dependency", label: "Dependency Risk", description: "Concentration on key buyers or suppliers.", score: avgDependency },
        { key: "supply", label: "Supply Chain Risk", description: "Fragility of the connected firm network.", score: supplyChainScore },
        { key: "cascade", label: "Cascade Risk", description: "Probability that stress spreads to connected firms.", score: cascadeScore },
      ],
      drivers: [
        { label: `${delayedTxns.length} payment delays detected`, description: "Invoices settled after due date.", weight: 28, direction: "INCREASES" },
        { label: `₹${(totalOutstanding / 100000).toFixed(1)}L total outstanding`, description: "Unsettled receivables across active invoices.", weight: 24, direction: "INCREASES" },
        { label: `${criticalRels} critical dependencies`, description: "High concentration on specific relationship edges.", weight: 20, direction: "INCREASES" },
      ],
      trend: ["Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb"].map((date, i) => ({
        date,
        score: Math.max(10, Math.min(99, overall - 18 + i * 2 + ((i * 3) % 5))),
      })),
    };
  }

  static async getFirmRisk(organizationId: string, firmId: string) {
    const firm = await FirmRepository.findById(firmId, organizationId);
    if (!firm) throw { status: 404, message: "This resource is not available in your organization." };

    await recalculateFirmRisk(firmId, organizationId);

    const updatedFirm = await FirmRepository.findById(firmId, organizationId);
    const firmRels = await RelationshipRepository.findForFirm(organizationId, firmId);
    const avgRelDep = firmRels.length ? Math.round(firmRels.reduce((s: number, r: any) => s + r.dependencyLevel, 0) / firmRels.length) : 30;

    const f = updatedFirm || firm;

    return {
      firmId,
      overall: f.riskScore,
      level: f.riskLevel,
      categories: [
        { key: "payment", label: "Payment Risk", description: "Late settlement behaviour.", score: Math.min(99, f.riskScore + 4) },
        { key: "stress", label: "Financial Stress", description: "Working-capital pressure.", score: f.financialStress },
        { key: "dependency", label: "Dependency Risk", description: "Buyer/supplier concentration.", score: avgRelDep },
        { key: "supply", label: "Supply Chain Risk", description: "Network fragility around this firm.", score: Math.max(12, Math.round(f.riskScore * 0.8 + avgRelDep * 0.2)) },
        { key: "cascade", label: "Cascade Risk", description: "Spread probability to connected firms.", score: Math.min(97, Math.round(f.riskScore * 0.9 + 6)) },
      ],
      drivers: [
        { label: `Average delay of ${f.avgPaymentDelayDays} days`, description: "Settlement consistently relative to credit period.", weight: 30, direction: "INCREASES" },
        { label: `₹${(f.outstandingAmount / 100000).toFixed(1)}L outstanding`, description: "Unsettled receivables relative to turnover.", weight: 24, direction: "INCREASES" },
        { label: `${f.cashBufferDays}-day cash buffer`, description: "Buffer available before liquidity pressure.", weight: 20, direction: f.cashBufferDays < 25 ? "INCREASES" : "DECREASES" },
      ],
      trend: ["Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb"].map((date, i) => ({
        date,
        score: Math.max(10, Math.min(99, f.riskScore - 20 + i * 2 + ((i * 3) % 5))),
      })),
    };
  }
}
