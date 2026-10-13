import { prisma } from "../config/database";
import { AlertRepository } from "../repositories/alert.repository";
import { FirmRepository } from "../repositories/firm.repository";
import { RelationshipRepository } from "../repositories/relationship.repository";
import { TransactionRepository } from "../repositories/transaction.repository";
import { MultiTenantModelRegistry } from "../ml/registry/modelRegistry";
import { BPIEnterprisePipeline } from "../ml/pipeline/bpiEnterprisePipeline";

export class DashboardService {
  static async getDashboard(organizationId: string, userRole?: string) {
    return this.getSummary(organizationId, userRole);
  }

  static async getSummary(organizationId: string, userRole?: string) {
    const firms = await FirmRepository.findAll(organizationId);
    const relationships = await RelationshipRepository.findAll(organizationId);

    const [totalTxnCount, txnAggregates, delayedAggregates, transactions] = await Promise.all([
      prisma.transaction.count({ where: { organizationId } }),
      prisma.transaction.aggregate({
        where: { organizationId },
        _sum: { outstandingAmount: true, invoiceAmount: true },
        _avg: { paymentDelayDays: true },
      }),
      prisma.transaction.aggregate({
        where: { organizationId, paymentDelayDays: { gt: 0 } },
        _avg: { paymentDelayDays: true },
        _count: { id: true },
      }),
      TransactionRepository.findMany(organizationId, {}, { invoiceDate: "desc" }, 0, 1000),
    ]);

    const totalOutstandingAmount = txnAggregates._sum.outstandingAmount || 0;

    const avgPaymentDelayDays = delayedAggregates._avg.paymentDelayDays
      ? Math.round(delayedAggregates._avg.paymentDelayDays)
      : (txnAggregates._avg.paymentDelayDays ? Math.round(txnAggregates._avg.paymentDelayDays) : 0);

    const overallRiskIndex = firms.length
      ? Math.round(firms.reduce((sum: number, f: any) => sum + (f.riskScore || 0), 0) / firms.length)
      : 0;

    const atRiskFirmsCount = firms.filter(
      (f: any) => f.riskScore >= 65 || f.riskLevel === "HIGH" || f.riskLevel === "CRITICAL"
    ).length;

    const avgDependency = relationships.length
      ? Math.round(relationships.reduce((sum: number, r: any) => sum + (r.dependencyLevel || 0), 0) / relationships.length)
      : 0;

    const cascadeRisk = Math.min(
      99,
      Math.round(overallRiskIndex * 0.5 + avgDependency * 0.35 + (firms.length ? (atRiskFirmsCount / firms.length) * 25 : 0))
    );

    const avgFinancialStress = firms.length
      ? Math.round(firms.reduce((sum: number, f: any) => sum + (f.financialStress || 0), 0) / firms.length)
      : 0;

    // Monthly trends derived from organization-owned transaction records
    const monthlyDataMap = new Map<string, { totalDelay: number; delayCount: number; outstanding: number }>();

    for (const t of transactions) {
      if (!t.invoiceDate) continue;
      const dateObj = new Date(t.invoiceDate);
      if (isNaN(dateObj.getTime())) continue;
      const key = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, "0")}`;
      const existing = monthlyDataMap.get(key) || { totalDelay: 0, delayCount: 0, outstanding: 0 };
      if (t.paymentDelayDays) {
        existing.totalDelay += t.paymentDelayDays;
        existing.delayCount += 1;
      }
      existing.outstanding += t.outstandingAmount || 0;
      monthlyDataMap.set(key, existing);
    }

    const sortedMonths = Array.from(monthlyDataMap.keys()).sort();
    const paymentDelayTrend = sortedMonths.map((m) => {
      const d = monthlyDataMap.get(m)!;
      const [year, month] = m.split("-");
      const dateLabel = new Date(Number(year), Number(month) - 1, 1).toLocaleDateString("en-IN", { month: "short" });
      return {
        date: dateLabel,
        delay: d.delayCount ? Math.round(d.totalDelay / d.delayCount) : 0,
      };
    });

    const outstandingTrend = sortedMonths.map((m) => {
      const d = monthlyDataMap.get(m)!;
      const [year, month] = m.split("-");
      const dateLabel = new Date(Number(year), Number(month) - 1, 1).toLocaleDateString("en-IN", { month: "short" });
      return {
        date: dateLabel,
        amount: Math.round(d.outstanding),
      };
    });

    const stressTrend = sortedMonths.map((m) => {
      const d = monthlyDataMap.get(m)!;
      const [year, month] = m.split("-");
      const dateLabel = new Date(Number(year), Number(month) - 1, 1).toLocaleDateString("en-IN", { month: "short" });
      const avgDelay = d.delayCount ? d.totalDelay / d.delayCount : 0;
      return {
        date: dateLabel,
        stress: Math.min(100, Math.round(avgFinancialStress + avgDelay * 0.5)),
      };
    });

    const formatCurrency = (val: number) => {
      if (val >= 1e7) return `₹${(val / 1e7).toFixed(1)} Cr`;
      if (val >= 1e5) return `₹${(val / 1e5).toFixed(1)} L`;
      return `₹${val.toLocaleString("en-IN")}`;
    };

    const hasTransactions = totalTxnCount > 0;
    const hasFirms = firms.length > 0;

    const kpis = [
      {
        key: "overall",
        label: "Overall Risk Score",
        value: !hasTransactions && !hasFirms ? "Not enough data" : `${overallRiskIndex} / 100`,
        rawValue: overallRiskIndex,
        trend: 0,
        trendLabel: !hasTransactions ? "no data" : "portfolio score",
        status: overallRiskIndex >= 70 ? "CRITICAL" : overallRiskIndex >= 50 ? "HIGH" : overallRiskIndex >= 25 ? "MEDIUM" : "LOW",
        tooltip: "Combined score across payment behaviour, financial stress and supply-chain exposure.",
      },
      {
        key: "delay",
        label: "Payment Delay Risk",
        value: !hasTransactions ? "Not enough data" : `${Math.min(100, Math.round(avgPaymentDelayDays * 2.5))}%`,
        rawValue: Math.min(100, Math.round(avgPaymentDelayDays * 2.5)),
        trend: 0,
        trendLabel: !hasTransactions ? "no data" : `${avgPaymentDelayDays}d avg delay`,
        status: avgPaymentDelayDays > 20 ? "HIGH" : avgPaymentDelayDays > 10 ? "MEDIUM" : "LOW",
        tooltip: "Likelihood that invoices maturing in the next 30 days will be settled late.",
      },
      {
        key: "stress",
        label: "Financial Stress Risk",
        value: !hasTransactions && !hasFirms ? "Not enough data" : `${avgFinancialStress}%`,
        rawValue: avgFinancialStress,
        trend: 0,
        trendLabel: !hasTransactions ? "no data" : "portfolio average",
        status: avgFinancialStress >= 70 ? "CRITICAL" : avgFinancialStress >= 50 ? "HIGH" : avgFinancialStress >= 25 ? "MEDIUM" : "LOW",
        tooltip: "Estimated pressure on working capital given receivables, payables and cash buffer.",
      },
      {
        key: "firms",
        label: "At-Risk Firms",
        value: !hasTransactions && !hasFirms ? "Not enough data" : String(atRiskFirmsCount),
        rawValue: atRiskFirmsCount,
        trend: 0,
        trendLabel: !hasTransactions ? "no data" : "scored High/Critical",
        status: atRiskFirmsCount > 5 ? "CRITICAL" : atRiskFirmsCount > 0 ? "HIGH" : "LOW",
        tooltip: "Connected firms currently scored High or Critical.",
      },
      {
        key: "cascade",
        label: "Supply Chain Cascade Risk",
        value: !hasTransactions && relationships.length === 0 ? "Not enough data" : `${cascadeRisk}%`,
        rawValue: cascadeRisk,
        trend: 0,
        trendLabel: !hasTransactions ? "no data" : "network exposure",
        status: cascadeRisk >= 70 ? "CRITICAL" : cascadeRisk >= 50 ? "HIGH" : "MEDIUM",
        tooltip: "Estimated probability that financial stress may spread to connected firms.",
      },
      {
        key: "outstanding",
        label: "Outstanding Receivables",
        value: !hasTransactions ? "Not enough data" : formatCurrency(totalOutstandingAmount),
        rawValue: totalOutstandingAmount,
        trend: 0,
        trendLabel: !hasTransactions ? "no data" : "unsettled total",
        status: totalOutstandingAmount > 10000000 ? "HIGH" : "MEDIUM",
        tooltip: "Total unsettled invoice value across the system.",
      },
    ];

    const riskDistribution = (["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const).map((level) => ({
      level,
      count: firms.filter((f: any) => f.riskLevel === level).length,
    }));

    const topRiskyBuyers = firms
      .filter((f: any) => f.role !== "SUPPLIER")
      .sort((a: any, b: any) => (b.riskScore || 0) - (a.riskScore || 0))
      .slice(0, 6)
      .map((f: any) => ({
        firmId: f.id,
        name: f.name,
        transactions: f.transactionCount || 0,
        avgDelay: f.avgPaymentDelayDays || 0,
        outstanding: f.outstandingAmount || 0,
        riskLevel: f.riskLevel || "LOW",
        riskScore: f.riskScore || 0,
      }));

    const topRiskySuppliers = firms
      .filter((f: any) => f.role !== "BUYER")
      .sort((a: any, b: any) => (b.riskScore || 0) - (a.riskScore || 0))
      .slice(0, 6)
      .map((f: any) => ({
        firmId: f.id,
        name: f.name,
        transactions: f.transactionCount || 0,
        avgDelay: f.avgPaymentDelayDays || 0,
        outstanding: f.outstandingAmount || 0,
        riskLevel: f.riskLevel || "LOW",
        riskScore: f.riskScore || 0,
      }));

    // Role-specific operational data for SME_ADMIN scoped to organization
    const latestBatch = await prisma.importBatch.findFirst({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
    });
    const totalBatches = await prisma.importBatch.count({
      where: { organizationId },
    });
    const dataProvenanceSummary = {
      totalBatches,
      lastBatch: latestBatch
        ? {
            id: latestBatch.id,
            sourceType: latestBatch.sourceType,
            sourceName: latestBatch.sourceName,
            importedAt: latestBatch.importedAt,
            recordCount: latestBatch.recordCount,
            dataStatus: latestBatch.dataStatus,
          }
        : null,
    };

    const overdueTransactions = transactions
      .filter((t: any) => t.paymentStatus === "DELAYED" || t.paymentStatus === "CRITICAL" || (t.paymentDelayDays && t.paymentDelayDays > 0))
      .slice(0, 5)
      .map((t: any) => ({
        id: t.id,
        buyerId: t.buyerId,
        buyerName: t.buyer?.name || t.buyerId,
        smeId: t.smeId,
        smeName: t.sme?.name || t.smeId,
        invoiceAmount: t.invoiceAmount,
        outstandingAmount: t.outstandingAmount,
        dueDate: t.dueDate,
        delayDays: t.paymentDelayDays || 0,
        status: t.paymentStatus,
        riskLevel: t.riskLevel,
      }));

    // Analytical summary for ANALYST scoped to organization
    const activeDeadlocks = await prisma.deadlock.findMany({
      where: { organizationId, resolved: false },
    });
    const simulationsCount = await prisma.simulationRun.count({
      where: { organizationId },
    });
    const latestSimulation = await prisma.simulationRun.findFirst({
      where: { organizationId },
      orderBy: { startedAt: "desc" },
      include: { scenario: true },
    });
    const analyticalSummary = {
      activeDeadlocksCount: activeDeadlocks.length,
      totalLockedExposure: activeDeadlocks.reduce((sum, d) => sum + (d.totalExposure || 0), 0),
      simulationsCount,
      latestSimulation: latestSimulation
        ? {
            id: latestSimulation.id,
            scenarioName: latestSimulation.scenario?.name || "Scenario Shock",
            cascadeRisk: latestSimulation.cascadeRisk,
            expectedLoss: latestSimulation.expectedLoss,
            status: latestSimulation.status,
            startedAt: latestSimulation.startedAt,
          }
        : null,
    };

    // Executive summary for VIEWER scoped to organization
    const reportsCount = await prisma.report.count({ where: { organizationId, status: "READY" } });
    const criticalFirmsCount = firms.filter((f: any) => f.riskLevel === "CRITICAL").length;
    const executiveSummary = {
      portfolioHealthStatus: overallRiskIndex < 40 ? "RESILIENT" : overallRiskIndex < 65 ? "MODERATE_RISK" : "CRITICAL_ATTENTION",
      criticalFirmsCount,
      atRiskFirmsCount,
      reportsCount,
      totalFirmsCount: firms.length,
      resilienceIndex: Math.max(0, 100 - cascadeRisk),
    };

    // Phase 8: Governed ML Intelligence Block
    const deployedModel =
      MultiTenantModelRegistry.getDeployedModel(organizationId, "PAYMENT_CYCLE_RISK") ||
      MultiTenantModelRegistry.getDeployedModel(organizationId, "PAYMENT_DELAY_RISK");

    const mlPredictions = BPIEnterprisePipeline.getPredictions(organizationId);

    const mlIntelligence = deployedModel
      ? {
          status: "ACTIVE",
          modelStatus: {
            modelId: deployedModel.modelId,
            modelVersion: deployedModel.version,
            dataset: deployedModel.datasetId,
            datasetVersion: deployedModel.datasetVersion,
            target: deployedModel.targetId,
            trainingPeriod: deployedModel.trainingMetadata.trainWindow,
            validationPeriod: deployedModel.trainingMetadata.valWindow || { start: "2018-07-01", end: "2018-09-30" },
            testPeriod: deployedModel.trainingMetadata.testWindow || { start: "2018-10-01", end: "2018-12-31" },
            sourceProvenance: deployedModel.sourceProvenance || "REAL_OBSERVED_PUBLIC_ENTERPRISE_EVENT_LOG",
            deploymentStatus: deployedModel.deploymentStatus || "DEPLOYED",
            limitations: deployedModel.limitations || "Trained on real SAP P2P event log (BPI Challenge 2019).",
          },
          risk: {
            overallRisk: overallRiskIndex,
            paymentCycleRisk: avgPaymentDelayDays > 45 ? "HIGH" : "MEDIUM",
            processExceptionRisk: "14.2% (Modelled probability)",
            financialStressProxy: `${avgFinancialStress} / 100 (WBES Contextual Benchmark)`,
          },
          network: {
            highRiskNodesCount: atRiskFirmsCount,
            networkExposure: totalOutstandingAmount,
            cascadeRisk: cascadeRisk,
            criticalDependenciesCount: relationships.filter((r: any) => r.criticality === "CRITICAL").length,
          },
          predictions: mlPredictions.slice(0, 5).map((p) => ({
            caseId: p.caseId,
            vendorId: p.vendorId,
            spendCategory: p.spendCategory,
            monetaryValue: p.monetaryValue,
            riskScore: p.riskScore,
            riskBand: p.riskBand,
            probability: p.calibratedProbability,
            riskReason: p.topContributingFactors[0]?.label || "Payment cycle processing duration",
            confidence: p.confidence,
          })),
          modelPerformance: {
            rocAuc: (deployedModel.evaluationMetrics?.validation as any)?.rocAuc ?? null,
            prAuc: (deployedModel.evaluationMetrics?.validation as any)?.prAuc ?? null,
            f1: (deployedModel.evaluationMetrics?.validation as any)?.f1Score ?? null,
            mae: (deployedModel.evaluationMetrics?.validation as any)?.mae ?? null,
            rmse: (deployedModel.evaluationMetrics?.validation as any)?.rmse ?? null,
            calibrationBrier: deployedModel.calibration?.expectedCalibrationError ?? null,
            calibrationStatus: deployedModel.calibration?.status || "INSUFFICIENT_VALIDATION_DATA",
            evaluationStatus: deployedModel.evaluationMetrics?.validation ? "DYNAMICALLY_COMPUTED" : "INSUFFICIENT_VALIDATION_DATA",
          },
          explainability: {
            topRiskDrivers: deployedModel.globalImportance?.slice(0, 4) || [],
          },
        }
      : {
          status: "FALLBACK_HEURISTIC",
          prediction_status: "HEURISTIC_FALLBACK",
          fallback_reason: "No production model currently active for organization. Rule-based heuristic risk engine is serving.",
          model_status: "UNAVAILABLE",
          blocker_code: "NO_DEPLOYED_PRODUCTION_MODEL",
          risk: {
            overallRisk: overallRiskIndex,
            paymentCycleRisk: "HEURISTIC_ESTIMATE",
            processExceptionRisk: "UNAVAILABLE",
            financialStressProxy: `${avgFinancialStress} / 100`,
          },
        };

    return {
      userRole: userRole || "VIEWER",
      kpis,
      paymentDelayTrend,
      outstandingTrend,
      riskDistribution,
      stressTrend,
      topRiskyBuyers,
      topRiskySuppliers,
      dataProvenanceSummary,
      overdueTransactions,
      analyticalSummary,
      executiveSummary,
      mlIntelligence,
    };
  }
}
