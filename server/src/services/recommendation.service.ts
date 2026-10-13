import { FirmRepository } from "../repositories/firm.repository";
import { RecommendationRepository } from "../repositories/recommendation.repository";

export class RecommendationService {
  static async getRecommendations(organizationId: string, firmId?: string) {
    await this.generateDynamicRecommendations(organizationId);
    const where = firmId ? { firmId } : {};
    const recs = await RecommendationRepository.findAll(organizationId, where);
    return recs.map((r: any) => {
      let extra: any = {};
      if (r.description && r.description.startsWith("{")) {
        try {
          extra = JSON.parse(r.description);
        } catch {}
      }
      return {
        ...r,
        action: extra.action || r.kind,
        trigger: extra.trigger || r.reason,
        riskReductionEstimate: extra.riskReductionEstimate ?? 20,
        limitations: extra.limitations || "Decision-support recommendation only. No financial transactions are executed autonomously.",
      };
    });
  }

  static async setStatus(organizationId: string, id: string, status: "PENDING" | "OPEN" | "ACCEPTED" | "DISMISSED") {
    const rec = await RecommendationRepository.findById(id, organizationId);
    if (!rec) throw { status: 404, message: "This resource is not available in your organization." };

    return RecommendationRepository.update(id, organizationId, { status });
  }

  /** Algorithmic Recommendation Generator based on live firm risk conditions */
  static async generateDynamicRecommendations(organizationId: string) {
    const highRiskFirms = await FirmRepository.findAll(organizationId, { riskScore: { gte: 40 } });

    let recIdx = 1;
    for (const firm of highRiskFirms.slice(0, 10)) {
      const recId = `REC-${organizationId}-${String(recIdx++).padStart(3, "0")}`;
      let action = "INVOICE_DISCOUNTING";
      let kind = "INVOICE_FINANCING";
      let title = "Consider invoice discounting for delayed receivables";
      let trigger = `Receivables outstanding of ₹${(firm.outstandingAmount / 100000).toFixed(1)}L exceeding 30 days.`;
      let reason = `Observed payment cycle duration indicates working capital strain on ${firm.name}.`;
      let req = Math.round(firm.outstandingAmount * 0.4);
      let prio = firm.riskLevel;
      let expectedImpact = "Accelerates liquidity by converting verified receivables into operating cash within 48 hours.";
      let riskReductionEstimate = 18;

      if (firm.avgPaymentDelayDays > 45) {
        action = "TREDS_CONSIDERATION";
        kind = "TREDS";
        title = `Discount approved invoices on TReDS platform for ${firm.name}`;
        trigger = `Average payment delay of ${firm.avgPaymentDelayDays} days crossing 45-day operational threshold.`;
        reason = "Institutional TReDS factoring mitigates buyer payment cycle volatility with transparent competitive bidding.";
        expectedImpact = "Reduces firm cash conversion cycle by up to 35 days without recourse.";
        riskReductionEstimate = 28;
      } else if (firm.cashBufferDays < 20) {
        action = "CREDIT_LINE_CONSIDERATION";
        kind = "CREDIT_LINE";
        title = `Arrange standby working-capital credit line for ${firm.name}`;
        trigger = `Cash buffer depleted to ${firm.cashBufferDays} days (below the 25-day safety threshold).`;
        reason = "Standby liquidity buffer protects against supply-chain disruption during vendor payment delays.";
        req = Math.round((25 - firm.cashBufferDays) * 150000);
        expectedImpact = "Restores operating liquidity buffer to minimum 30 days of overhead coverage.";
        riskReductionEstimate = 22;
      } else if (firm.suppliersCount === 1) {
        action = "ALTERNATE_SUPPLIER";
        kind = "ALTERNATE_SUPPLIER";
        title = `Qualify an alternate supplier to reduce single-source dependency`;
        trigger = "Single supplier dependency identified in supply-chain network.";
        reason = "Sole-source vulnerability increases cascade exposure if primary supplier faces process delays.";
        req = 400000;
        expectedImpact = "Diversifies procurement risks and establishes backup fulfillment channels.";
        riskReductionEstimate = 15;
      } else if (firm.riskScore >= 75) {
        action = "COLLECTION_PRIORITIZATION";
        kind = "COLLECTION";
        title = `Initiate structured collection prioritization protocol for ${firm.name}`;
        trigger = `Composite risk score reached critical level (${firm.riskScore}/100).`;
        reason = "High concentration of overdue invoices presents imminent default contagion risk.";
        expectedImpact = "Prioritizes immediate outreach and automated settlement reconciliation.";
        riskReductionEstimate = 25;
      }

      const descriptionPayload = JSON.stringify({
        action,
        trigger,
        riskReductionEstimate,
        limitations: "Decision-support recommendation only. No financial transactions are executed autonomously.",
      });

      const recDbData = {
        organizationId,
        firmId: firm.id,
        firmName: firm.name,
        kind,
        title,
        description: descriptionPayload,
        riskAddressed: "Working capital stress & receivable delays",
        reason,
        expectedImpact,
        estimatedRequirement: req,
        priority: prio,
        confidence: Math.min(95, firm.riskScore + 8),
      };

      await RecommendationRepository.upsert(
        recId,
        recDbData,
        {
          id: recId,
          ...recDbData,
          status: "OPEN",
        },
      );
    }
  }
}
