import { USE_MOCK_API, apiClient, mockDelay, resolve } from "@/api/client";
import { ENDPOINTS } from "@/api/contracts";
import * as db from "@/mocks/data";
import type { Alert, OptimizationAllocation, OptimizationRun, Recommendation, Report } from "@/types";
import { riskLevelFromScore, toCsv } from "@/utils/format";

let recommendationStore: Recommendation[] = [...db.recommendations];
let alertStore: Alert[] = [...db.alerts];
let reportStore: Report[] = [...db.reports];

export const recommendationService = {
  getRecommendations: () => resolve<Recommendation[]>(ENDPOINTS.recommendations, () => recommendationStore),
  getByIds: (ids: string[]) => resolve<Recommendation[]>(ENDPOINTS.recommendations, () => recommendationStore.filter((r) => ids.includes(r.id))),
  getForFirm: (firmId: string) =>
    resolve<Recommendation[]>(`${ENDPOINTS.recommendations}?firmId=${firmId}`, () => recommendationStore.filter((r) => r.firmId === firmId)),
  async setStatus(id: string, status: Recommendation["status"]): Promise<Recommendation> {
    await mockDelay(250);
    recommendationStore = recommendationStore.map((r) => (r.id === id ? { ...r, status } : r));
    return recommendationStore.find((r) => r.id === id)!;
  },
};

export const alertService = {
  getAlerts: () => resolve<Alert[]>(ENDPOINTS.alerts, () => alertStore),
  async markRead(id: string, read = true) {
    await mockDelay(150);
    alertStore = alertStore.map((a) => (a.id === id ? { ...a, read } : a));
    return alertStore.find((a) => a.id === id)!;
  },
  async markAllRead() {
    await mockDelay(200);
    alertStore = alertStore.map((a) => ({ ...a, read: true }));
    return alertStore;
  },
  async archive(id: string) {
    await mockDelay(150);
    alertStore = alertStore.map((a) => (a.id === id ? { ...a, archived: true, read: true } : a));
    return alertStore.find((a) => a.id === id)!;
  },
};

export const optimizationService = {
  /** Greedy impact-per-rupee allocation. Replaced by the solver service later. */
  async runOptimization(budget: number): Promise<OptimizationRun> {
    if (!USE_MOCK_API) return apiClient.post<OptimizationRun>(ENDPOINTS.optimizationRun, { budget });
    await mockDelay(900);

    const candidates = db.firms
      .filter((f) => f.riskScore >= 55)
      .map((f) => ({
        firm: f,
        requiredSupport: Math.round((f.outstandingAmount * 0.35 + f.riskScore * 10000) / 10000) * 10000,
        efficiency: f.riskScore / Math.max(1, f.outstandingAmount / 100000),
      }))
      .sort((a, b) => b.efficiency - a.efficiency);

    let remaining = budget;
    const allocations: OptimizationAllocation[] = candidates.map((c) => {
      const allocated = Math.max(0, Math.min(c.requiredSupport, remaining));
      remaining -= allocated;
      const coverage = c.requiredSupport === 0 ? 0 : allocated / c.requiredSupport;
      return {
        firmId: c.firm.id,
        firmName: c.firm.name,
        risk: c.firm.riskScore,
        requiredSupport: c.requiredSupport,
        allocated,
        impactReduction: Math.round(coverage * (c.firm.riskScore * 0.42)),
        priority: riskLevelFromScore(c.firm.riskScore),
      };
    });

    const funded = allocations.filter((a) => a.allocated > 0);
    const avgReduction = funded.length ? funded.reduce((s, a) => s + a.impactReduction, 0) / funded.length : 0;
    const cascadeBefore = 72;
    const expectedLossBefore = candidates.reduce((s, c) => s + c.firm.outstandingAmount, 0);

    return {
      id: `OPT-${Date.now()}`,
      budget,
      allocations,
      cascadeRiskBefore: cascadeBefore,
      cascadeRiskAfter: Math.max(18, Math.round(cascadeBefore - avgReduction * 0.9)),
      expectedLossBefore,
      expectedLossAfter: Math.round(expectedLossBefore * (1 - Math.min(0.55, avgReduction / 100))),
      createdAt: new Date().toISOString(),
    };
  },
};

export const reportService = {
  getReports: () => resolve<Report[]>(ENDPOINTS.reports, () => reportStore),
  async generate(id: string): Promise<Report> {
    await mockDelay(1000);
    reportStore = reportStore.map((r) => (r.id === id ? { ...r, status: "READY", lastGeneratedAt: new Date().toISOString().slice(0, 10) } : r));
    return reportStore.find((r) => r.id === id)!;
  },
  buildPayload(report: Report, format: "json" | "csv"): { filename: string; content: string; mime: string } {
    const generatedAt = new Date().toISOString();
    const base = { report: report.name, generatedAt, dataset: "DEMO DATASET — sample data, not real financial information" };

    const rows: Record<string, unknown>[] = (() => {
      switch (report.key) {
        case "transaction-analysis":
        case "payment-delay":
          return db.transactions.slice(0, 60).map((t) => ({
            transaction_id: t.id,
            buyer: db.firmById(t.buyerId)?.name ?? t.buyerId,
            invoice_amount: t.invoiceAmount,
            invoice_date: t.invoiceDate,
            due_date: t.dueDate,
            payment_delay_days: t.paymentDelayDays ?? 0,
            outstanding: t.outstandingAmount,
            status: t.paymentStatus,
          }));
        case "supply-chain-risk":
          return db.relationships.map((r) => ({
            relationship_id: r.id,
            source: db.firmById(r.sourceFirmId)?.name,
            target: db.firmById(r.targetFirmId)?.name,
            dependency: r.dependencyLevel,
            criticality: r.criticality,
            avg_value: r.avgTransactionValue,
          }));
        case "scenario":
          return db.scenarios.map((s) => ({ ...s, firm: db.firmById(s.affectedFirmId)?.name }));
        case "deadlock":
          return db.deadlocks.map((d) => ({
            deadlock_id: d.id,
            root_firm: d.rootFirmName,
            severity: d.severity,
            risk: d.deadlockRisk,
            chain: d.chain.map((c) => c.firmName).join(" -> "),
            total_exposure: d.totalExposure,
          }));
        case "recommendation":
          return recommendationStore.map((r) => ({
            id: r.id,
            title: r.title,
            firm: r.firmName,
            priority: r.priority,
            confidence: r.confidence,
            requirement: r.estimatedRequirement,
          }));
        default:
          return db.firms.map((f) => ({
            firm_id: f.id,
            name: f.name,
            industry: f.industry,
            risk_score: f.riskScore,
            risk_level: f.riskLevel,
            avg_delay_days: f.avgPaymentDelayDays,
            outstanding: f.outstandingAmount,
          }));
      }
    })();

    if (format === "csv") {
      return { filename: `${report.key}-${generatedAt.slice(0, 10)}.csv`, content: toCsv(rows), mime: "text/csv" };
    }
    return {
      filename: `${report.key}-${generatedAt.slice(0, 10)}.json`,
      content: JSON.stringify({ ...base, rowCount: rows.length, rows }, null, 2),
      mime: "application/json",
    };
  },
};
