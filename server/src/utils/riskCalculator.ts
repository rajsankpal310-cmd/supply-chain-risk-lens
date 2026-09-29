import { FirmRepository } from "../repositories/firm.repository";
import { TransactionRepository } from "../repositories/transaction.repository";

export function getRiskLevel(score: number): "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" {
  if (score >= 80) return "CRITICAL";
  if (score >= 62) return "HIGH";
  if (score >= 40) return "MEDIUM";
  return "LOW";
}

export function calculatePaymentDelayRisk(avgDelayDays: number, totalInvoices: number, overdueCount: number): number {
  const delayFactor = Math.min(60, avgDelayDays * 1.8);
  const overdueRatio = totalInvoices > 0 ? (overdueCount / totalInvoices) * 35 : 0;
  return Math.min(99, Math.round(delayFactor + overdueRatio + 10));
}

export async function recalculateFirmRisk(firmId: string, organizationId?: string) {
  const firm = await FirmRepository.findById(firmId, organizationId);
  if (!firm) return;

  const orgId = organizationId || firm.organizationId;

  const txns = await TransactionRepository.findMany(
    orgId,
    {
      OR: [{ smeId: firmId }, { buyerId: firmId }, { supplierId: firmId }],
    },
    { invoiceDate: "desc" },
    0,
    10000
  );

  const transactionCount = txns.length;

  let totalOutstanding = 0;
  let totalDelayDays = 0;
  let delayedTxnCount = 0;

  for (const t of txns) {
    totalOutstanding += t.outstandingAmount;
    if (t.paymentDelayDays && t.paymentDelayDays > 0) {
      totalDelayDays += t.paymentDelayDays;
      delayedTxnCount++;
    }
  }

  const avgPaymentDelayDays = delayedTxnCount > 0 ? Math.round(totalDelayDays / delayedTxnCount) : 0;

  const delayScore = calculatePaymentDelayRisk(avgPaymentDelayDays, transactionCount, delayedTxnCount);
  const outstandingRatioScore = Math.min(40, Math.round((totalOutstanding / Math.max(1, firm.annualTurnover)) * 250));
  const bufferScore = Math.max(0, Math.round((30 - firm.cashBufferDays) * 1.2));

  const riskScore = Math.min(99, Math.max(10, Math.round(delayScore * 0.55 + outstandingRatioScore * 0.25 + bufferScore * 0.2)));
  const riskLevel = getRiskLevel(riskScore);
  const financialStress = Math.min(99, Math.round(riskScore * 0.85 + bufferScore * 0.15));

  let status = firm.status;
  if (riskLevel === "CRITICAL" || riskLevel === "HIGH") {
    status = "STRESSED";
  } else if (riskLevel === "LOW") {
    status = "HEALTHY";
  }

  await FirmRepository.updateMetrics(firmId, {
    transactionCount,
    outstandingAmount: totalOutstanding,
    avgPaymentDelayDays,
    riskScore,
    riskLevel,
    financialStress,
    status,
  });
}
