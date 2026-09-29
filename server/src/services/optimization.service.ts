import { FirmRepository } from "../repositories/firm.repository";
import { OptimizationRepository } from "../repositories/optimization.repository";

export class OptimizationService {
  static async runOptimization(organizationId: string, budget: number) {
    const firms = await FirmRepository.findAll(organizationId, { riskScore: { gte: 40 } });

    const candidates = firms
      .map((f: any) => ({
        firm: f,
        requiredSupport: Math.round((f.outstandingAmount * 0.35 + f.riskScore * 10000) / 10000) * 10000,
        efficiency: f.riskScore / Math.max(1, f.outstandingAmount / 100000),
      }))
      .sort((a: any, b: any) => b.efficiency - a.efficiency);

    let remaining = Number(budget) || 10000000;
    const allocations = candidates.map((c: any) => {
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
        priority: c.firm.riskLevel,
      };
    });

    const funded = allocations.filter((a: any) => a.allocated > 0);
    const avgReduction = funded.length ? funded.reduce((s: number, a: any) => s + a.impactReduction, 0) / funded.length : 0;
    const cascadeBefore = 72;
    const expectedLossBefore = candidates.reduce((s: number, c: any) => s + c.firm.outstandingAmount, 0);

    const id = `OPT-${Date.now()}`;

    const run = await OptimizationRepository.create({
      id,
      organizationId,
      budget: Number(budget) || 10000000,
      allocations: JSON.stringify(allocations),
      cascadeRiskBefore: cascadeBefore,
      cascadeRiskAfter: Math.max(18, Math.round(cascadeBefore - avgReduction * 0.9)),
      expectedLossBefore,
      expectedLossAfter: Math.round(expectedLossBefore * (1 - Math.min(0.55, avgReduction / 100))),
    });

    return {
      id: run.id,
      budget: run.budget,
      allocations: typeof run.allocations === "string" ? JSON.parse(run.allocations) : run.allocations,
      cascadeRiskBefore: run.cascadeRiskBefore,
      cascadeRiskAfter: run.cascadeRiskAfter,
      expectedLossBefore: run.expectedLossBefore,
      expectedLossAfter: run.expectedLossAfter,
      createdAt: run.createdAt.toISOString(),
    };
  }

  static async getOptimizationById(organizationId: string, id: string) {
    const run = await OptimizationRepository.findById(id, organizationId);
    if (!run) throw { status: 404, message: "This resource is not available in your organization." };
    return {
      id: run.id,
      budget: run.budget,
      allocations: typeof run.allocations === "string" ? JSON.parse(run.allocations) : run.allocations,
      cascadeRiskBefore: run.cascadeRiskBefore,
      cascadeRiskAfter: run.cascadeRiskAfter,
      expectedLossBefore: run.expectedLossBefore,
      expectedLossAfter: run.expectedLossAfter,
      createdAt: run.createdAt.toISOString(),
    };
  }
}
