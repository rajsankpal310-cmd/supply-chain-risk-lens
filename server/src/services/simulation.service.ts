import { FirmRepository } from "../repositories/firm.repository";
import { RelationshipRepository } from "../repositories/relationship.repository";
import { ScenarioRepository } from "../repositories/scenario.repository";
import { SimulationRepository } from "../repositories/simulation.repository";

const SEVERITY_WEIGHT = { LOW: 0.5, MEDIUM: 0.75, HIGH: 1, CRITICAL: 1.3 } as const;

export class SimulationService {
  static async getSimulations(organizationId: string) {
    const runs = await SimulationRepository.findMany(organizationId, {}, { createdAt: "desc" });

    return runs.map((r: any) => ({
      id: r.id,
      scenario: {
        ...r.scenario,
        createdAt: r.scenario.createdAt.toISOString().slice(0, 10),
      },
      startedAt: r.startedAt.toISOString(),
      status: r.status,
      result: typeof r.result === "string" ? JSON.parse(r.result) : r.result,
    }));
  }

  static async getSimulationById(organizationId: string, id: string) {
    const r = await SimulationRepository.findById(id, organizationId);

    if (!r) throw { status: 404, message: "This resource is not available in your organization." };

    return {
      id: r.id,
      scenario: {
        ...r.scenario,
        createdAt: r.scenario.createdAt.toISOString().slice(0, 10),
      },
      startedAt: r.startedAt.toISOString(),
      status: r.status,
      result: typeof r.result === "string" ? JSON.parse(r.result) : r.result,
    };
  }

  static async runSimulation(organizationId: string, input: any) {
    const firms = await FirmRepository.findAll(organizationId);
    const relationships = await RelationshipRepository.findAll(organizationId);

    const rootFirm = firms.find((f: any) => f.id === input.affectedFirmId) || firms[0];
    if (!rootFirm) {
      throw { status: 404, message: "This resource is not available in your organization." };
    }

    const weight = (SEVERITY_WEIGHT as any)[input.severity || "HIGH"] || 1;

    const firstHopRels = relationships.filter((r: any) => r.sourceFirmId === rootFirm.id || r.targetFirmId === rootFirm.id);
    const firstHopIds = Array.from(new Set(firstHopRels.map((r: any) => (r.sourceFirmId === rootFirm.id ? r.targetFirmId : r.sourceFirmId))));

    const secondHopRels = relationships.filter((r: any) => firstHopIds.includes(r.sourceFirmId) || firstHopIds.includes(r.targetFirmId));
    const secondHopIds = Array.from(
      new Set(
        secondHopRels
          .map((r: any) => (firstHopIds.includes(r.sourceFirmId) ? r.targetFirmId : r.sourceFirmId))
          .filter((id: any) => id !== rootFirm.id && !firstHopIds.includes(id)),
      ),
    ).slice(0, 6);

    const impacted = [
      { id: rootFirm.id, step: 0 },
      ...firstHopIds.map((id: any) => ({ id: String(id), step: 1 })),
      ...secondHopIds.map((id: any) => ({ id: String(id), step: 2 })),
    ];

    const affectedFirms = impacted.map(({ id, step }) => {
      const firm = firms.find((f: any) => f.id === id) || rootFirm;
      const decay = step === 0 ? 1 : step === 1 ? 0.62 : 0.34;
      const uplift = Math.round((18 + (input.delayDays || 60) * 0.32 + ((input.amount || 5000000) / 10000000) * 12) * weight * decay);
      const riskAfter = Math.min(99, firm.riskScore + uplift);
      return {
        firmId: firm.id,
        firmName: firm.name,
        riskBefore: firm.riskScore,
        riskAfter,
        loss: Math.round((input.amount || 5000000) * decay * 0.34 * weight),
        step,
      };
    });

    const expectedLoss = affectedFirms.reduce((s: number, f: any) => s + f.loss, 0);
    const cascadeProbability = Math.min(96, Math.round(38 * weight + firstHopIds.length * 4 + (input.delayDays || 60) * 0.2));
    const potentialDefaults = affectedFirms.filter((f: any) => f.riskAfter >= 82).length;
    const recoveryDays = Math.round(((input.durationDays || 90) * (100 - (input.recoveryRate || 45))) / 45) + 14;

    const resultPayload = {
      scenarioLabel: "HYPOTHETICAL / SCENARIO OUTPUT",
      disclaimer: "This is a modelled scenario simulation, not observed historical fact. Never feed simulated cascade outputs backward into ML training.",
      affectedFirms,
      affectedNodeCount: affectedFirms.length,
      networkExposure: expectedLoss,
      downstreamImpact: Math.round(expectedLoss * 1.45),
      propagatedRisk: cascadeProbability,
      cascadeSeverity: input.severity || "HIGH",
      potentialDefaults,
      cascadeProbability,
      expectedLoss,
      maximumImpact: Math.round(expectedLoss * 1.45),
      recoveryDays,
      propagationPath: [rootFirm.id, ...firstHopIds.slice(0, 3), ...secondHopIds.slice(0, 2)],
      timeline: Array.from({ length: 8 }, (_, i) => {
        const day = i * Math.max(4, Math.round((input.durationDays || 90) / 8));
        const ramp = Math.min(1, (i + 1) / 5);
        return {
          day,
          stressedFirms: Math.round(affectedFirms.length * ramp),
          loss: Math.round(expectedLoss * ramp * (i > 5 ? 1 - (i - 5) * 0.06 : 1)),
        };
      }),
      distribution: [
        { bucket: "No spread", probability: Math.max(2, 30 - Math.round(cascadeProbability * 0.3)) },
        { bucket: "1-2 firms", probability: 28 },
        { bucket: "3-5 firms", probability: Math.round(cascadeProbability * 0.42) },
        { bucket: "6+ firms", probability: Math.round(cascadeProbability * 0.28) },
      ],
      recommendationIds: ["REC-001", "REC-002", "REC-003"],
    };

    let scenario = null;
    if (input.scenarioId) {
      scenario = await ScenarioRepository.findById(input.scenarioId, organizationId);
      if (!scenario) {
        throw { status: 404, message: "This resource is not available in your organization." };
      }
    }

    if (!scenario) {
      const scCount = await ScenarioRepository.count(organizationId);
      const scenarioId = `SCN-${organizationId}-${String(scCount + 1).padStart(3, "0")}`;
      scenario = await ScenarioRepository.create({
        id: scenarioId,
        organizationId,
        name: input.name || `Simulation Shock ${rootFirm.name}`,
        type: input.type || "BUYER_PAYMENT_DELAY",
        affectedFirmId: rootFirm.id,
        severity: input.severity || "HIGH",
        delayDays: input.delayDays || 60,
        amount: input.amount || 5000000,
        durationDays: input.durationDays || 90,
        recoveryRate: input.recoveryRate || 45,
      });
    }

    const runCount = await SimulationRepository.count(organizationId);
    const runId = `SIM-${organizationId}-${String(runCount + 1).padStart(3, "0")}`;

    const run = await SimulationRepository.create({
      id: runId,
      organizationId,
      scenarioId: scenario.id,
      rootFirmId: rootFirm.id,
      status: "COMPLETED",
      cascadeRisk: cascadeProbability,
      expectedLoss,
      maximumImpact: Math.round(expectedLoss * 1.45),
      completedAt: new Date(),
      result: JSON.stringify(resultPayload),
    });

    return {
      id: run.id,
      scenario: {
        ...run.scenario,
        createdAt: run.scenario.createdAt.toISOString().slice(0, 10),
      },
      startedAt: run.startedAt.toISOString(),
      status: run.status,
      result: resultPayload,
    };
  }
}
