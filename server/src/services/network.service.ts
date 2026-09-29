import { AlertRepository } from "../repositories/alert.repository";
import { FirmRepository } from "../repositories/firm.repository";
import { RelationshipRepository } from "../repositories/relationship.repository";
import { TransactionRepository } from "../repositories/transaction.repository";

export class NetworkService {
  static async getNetwork(organizationId: string) {
    const firms = await FirmRepository.findAll(organizationId);
    const relationships = await RelationshipRepository.findAll(organizationId);
    const transactions = await TransactionRepository.findMany(organizationId, {}, { invoiceDate: "desc" }, 0, 10000);
    const alerts = await AlertRepository.findAll(organizationId, { read: false });

    const nodes = firms.map((f: any, i: number) => {
      const ring = i % 3;
      const perRing = [7, 7, 6][ring]!;
      const idxInRing = Math.floor(i / 3);
      const angle = (idxInRing / perRing) * Math.PI * 2 + ring * 0.4;
      const radius = 130 + ring * 105;

      const relsForFirm = relationships.filter((r: any) => r.sourceFirmId === f.id || r.targetFirmId === f.id);
      const exposure = relsForFirm.reduce((s: number, r: any) => s + r.avgTransactionValue, 0);

      const firmTxns = transactions.filter((t: any) => t.smeId === f.id || t.buyerId === f.id || t.supplierId === f.id);
      const activeTxns = firmTxns.filter((t: any) => t.paymentStatus !== "PAID");
      const completedTxns = firmTxns.filter((t: any) => t.paymentStatus === "PAID");
      const activeAlerts = alerts.filter((a: any) => a.firmId === f.id);

      return {
        id: f.id,
        name: f.name,
        industry: f.industry,
        role: f.role,
        volume: f.transactionCount || firmTxns.length,
        riskScore: f.riskScore,
        riskLevel: f.riskLevel,
        exposure,
        impact: Math.min(99, Math.round(f.riskScore * 0.6 + (exposure / 10000000) * 8)),
        avgPaymentDelayDays: f.avgPaymentDelayDays,
        outstandingAmount: f.outstandingAmount,
        activeRelationshipsCount: relsForFirm.length,
        activeTransactionsCount: activeTxns.length,
        completedTransactionsCount: completedTxns.length,
        activeAlertsCount: activeAlerts.length,
        x: 500 + Math.cos(angle) * radius,
        y: 380 + Math.sin(angle) * radius * 0.82,
      };
    });

    const edges = relationships.map((r: any) => {
      const relTxns = transactions.filter(
        (t: any) =>
          (t.smeId === r.sourceFirmId && t.buyerId === r.targetFirmId) ||
          (t.smeId === r.targetFirmId && t.buyerId === r.sourceFirmId) ||
          (t.supplierId === r.sourceFirmId && t.buyerId === r.targetFirmId)
      );
      const activeRelTxns = relTxns.filter((t: any) => t.paymentStatus !== "PAID");
      const completedRelTxns = relTxns.filter((t: any) => t.paymentStatus === "PAID");
      const activeExposure = activeRelTxns.reduce((s: number, t: any) => s + (t.outstandingAmount || t.invoiceAmount || 0), 0);

      return {
        id: r.id,
        source: r.sourceFirmId,
        target: r.targetFirmId,
        exposure: r.avgTransactionValue,
        activeExposure,
        dependency: r.dependencyLevel,
        criticality: r.criticality,
        activeTransactionCount: activeRelTxns.length,
        completedTransactionCount: completedRelTxns.length,
        hasActiveTransactions: activeRelTxns.length > 0,
        status: activeRelTxns.length > 0 ? "ACTIVE" : "COMPLETED",
      };
    });

    return { nodes, edges };
  }
}
