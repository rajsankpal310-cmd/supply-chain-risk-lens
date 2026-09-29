import { FirmRepository } from "../repositories/firm.repository";
import { RecommendationRepository } from "../repositories/recommendation.repository";

export class RecommendationService {
  static async getRecommendations(organizationId: string, firmId?: string) {
    await this.generateDynamicRecommendations(organizationId);
    const where = firmId ? { firmId } : {};
    return RecommendationRepository.findAll(organizationId, where);
  }

  static async setStatus(organizationId: string, id: string, status: "PENDING" | "OPEN" | "ACCEPTED" | "DISMISSED") {
    const rec = await RecommendationRepository.findById(id, organizationId);
    if (!rec) throw { status: 404, message: "This resource is not available in your organization." };

    return RecommendationRepository.update(id, organizationId, { status });
  }

  /** Algorithmic Recommendation Generator based on live firm risk conditions */
  static async generateDynamicRecommendations(organizationId: string) {
    const highRiskFirms = await FirmRepository.findAll(organizationId, { riskScore: { gte: 50 } });

    let recIdx = 1;
    for (const firm of highRiskFirms.slice(0, 10)) {
      const recId = `REC-${organizationId}-${String(recIdx++).padStart(3, "0")}`;
      let kind = "INVOICE_FINANCING";
      let title = "Consider invoice financing for delayed receivables";
      let req = Math.round(firm.outstandingAmount * 0.4);
      let prio = firm.riskLevel;

      if (firm.avgPaymentDelayDays > 30) {
        kind = "TREDS";
        title = `Discount approved invoices on TReDS platform for ${firm.name}`;
      } else if (firm.cashBufferDays < 20) {
        kind = "CREDIT_LINE";
        title = `Arrange standby working-capital credit line for ${firm.name}`;
        req = Math.round((25 - firm.cashBufferDays) * 150000);
      } else if (firm.suppliersCount === 1) {
        kind = "ALTERNATE_SUPPLIER";
        title = `Qualify an alternate supplier to reduce single-source dependency`;
        req = 400000;
      }

      await RecommendationRepository.upsert(
        recId,
        {
          organizationId,
          firmId: firm.id,
          firmName: firm.name,
          kind,
          title,
          riskAddressed: "Working capital stress & receivable delays",
          reason: `Average payment delay of ${firm.avgPaymentDelayDays} days with ₹${(firm.outstandingAmount / 100000).toFixed(1)}L outstanding.`,
          expectedImpact: "Improves liquidity and reduces default contagion.",
          estimatedRequirement: req,
          priority: prio,
          confidence: Math.min(95, firm.riskScore + 8),
        },
        {
          id: recId,
          organizationId,
          firmId: firm.id,
          firmName: firm.name,
          kind,
          title,
          riskAddressed: "Working capital stress & receivable delays",
          reason: `Average payment delay of ${firm.avgPaymentDelayDays} days with ₹${(firm.outstandingAmount / 100000).toFixed(1)}L outstanding.`,
          expectedImpact: "Improves liquidity and reduces default contagion.",
          estimatedRequirement: req,
          priority: prio,
          confidence: Math.min(95, firm.riskScore + 8),
          status: "OPEN",
        },
      );
    }
  }
}
