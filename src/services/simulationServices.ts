import { USE_MOCK_API, apiClient, mockDelay, resolve } from "@/api/client";
import { ENDPOINTS } from "@/api/contracts";
import * as db from "@/mocks/data";
import { networkService } from "@/services/analyticsServices";
import type { Deadlock, Scenario, ScenarioInput, SimulationResult, SimulationRun } from "@/types";
import { riskLevelFromScore } from "@/utils/format";

let scenarioStore: Scenario[] = [...db.scenarios];
let simulationStore: SimulationRun[] = [];

const SEVERITY_WEIGHT = { LOW: 0.5, MEDIUM: 0.75, HIGH: 1, CRITICAL: 1.3 } as const;

function computeResult(scenario: Scenario): SimulationResult {
  const weight = SEVERITY_WEIGHT[scenario.severity];
  const root = db.firmById(scenario.affectedFirmId) ?? db.firms[0]!;
  const firstHop = networkService.getNeighbours(root.id);
  const secondHop = firstHop.flatMap((id) => networkService.getNeighbours(id)).filter((id) => id !== root.id && !firstHop.includes(id));
  const uniqueSecond = Array.from(new Set(secondHop)).slice(0, 6);

  const impacted = [
    { id: root.id, step: 0 },
    ...firstHop.map((id) => ({ id, step: 1 })),
    ...uniqueSecond.map((id) => ({ id, step: 2 })),
  ];

  const affectedFirms = impacted.map(({ id, step }) => {
    const firm = db.firmById(id) ?? root;
    const decay = step === 0 ? 1 : step === 1 ? 0.62 : 0.34;
    const uplift = Math.round((18 + scenario.delayDays * 0.32 + (scenario.amount / 10000000) * 12) * weight * decay);
    const riskAfter = Math.min(99, firm.riskScore + uplift);
    return {
      firmId: firm.id,
      firmName: firm.name,
      riskBefore: firm.riskScore,
      riskAfter,
      loss: Math.round(scenario.amount * decay * 0.34 * weight),
      step,
    };
  });

  const expectedLoss = affectedFirms.reduce((s, f) => s + f.loss, 0);
  const cascadeProbability = Math.min(96, Math.round(38 * weight + firstHop.length * 4 + scenario.delayDays * 0.2));
  const potentialDefaults = affectedFirms.filter((f) => f.riskAfter >= 82).length;
  const recoveryDays = Math.round((scenario.durationDays * (100 - scenario.recoveryRate)) / 45) + 14;

  return {
    affectedFirms,
    potentialDefaults,
    cascadeProbability,
    expectedLoss,
    maximumImpact: Math.round(expectedLoss * 1.45),
    recoveryDays,
    propagationPath: [root.id, ...firstHop.slice(0, 3), ...uniqueSecond.slice(0, 2)],
    timeline: Array.from({ length: 8 }, (_, i) => {
      const day = i * Math.max(4, Math.round(scenario.durationDays / 8));
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
    recommendationIds: db.recommendations.slice(0, 3).map((r) => r.id),
  };
}

export const scenarioService = {
  getScenarios: () => resolve<Scenario[]>(ENDPOINTS.scenarios, () => scenarioStore),
  async saveScenario(input: ScenarioInput): Promise<Scenario> {
    if (!USE_MOCK_API) return apiClient.post<Scenario>(ENDPOINTS.scenarios, input);
    await mockDelay(400);
    const created: Scenario = { ...input, id: `SCN-${String(scenarioStore.length + 1).padStart(3, "0")}`, createdAt: new Date().toISOString().slice(0, 10) };
    scenarioStore = [created, ...scenarioStore];
    return created;
  },
  async deleteScenario(id: string) {
    await mockDelay(200);
    scenarioStore = scenarioStore.filter((s) => s.id !== id);
  },
};

export const SIMULATION_STAGES = [
  "Preparing scenario",
  "Building network",
  "Applying shock",
  "Simulating propagation",
  "Calculating impact",
  "Generating recommendations",
  "Complete",
] as const;

export const simulationService = {
  getSimulations: () => resolve<SimulationRun[]>(ENDPOINTS.simulations, () => simulationStore),
  getSimulationById: (id: string) => resolve<SimulationRun | undefined>(ENDPOINTS.simulation(id), () => simulationStore.find((s) => s.id === id)),

  /** Mock progress mirrors the future BullMQ worker stages exposed over SSE. */
  async runSimulation(input: ScenarioInput, onStage?: (stageIndex: number) => void): Promise<SimulationRun> {
    const scenario: Scenario = { ...input, id: `SCN-RUN-${simulationStore.length + 1}`, createdAt: new Date().toISOString().slice(0, 10) };
    if (!USE_MOCK_API) return apiClient.post<SimulationRun>(ENDPOINTS.runScenario(scenario.id), input);

    for (let i = 0; i < SIMULATION_STAGES.length; i++) {
      onStage?.(i);
      await mockDelay(i === SIMULATION_STAGES.length - 1 ? 200 : 480);
    }
    const run: SimulationRun = {
      id: `SIM-${String(simulationStore.length + 1).padStart(3, "0")}`,
      scenario,
      startedAt: new Date().toISOString(),
      status: "COMPLETED",
      result: computeResult(scenario),
    };
    simulationStore = [run, ...simulationStore];
    return run;
  },
};

export const deadlockService = {
  getDeadlocks: () => resolve<Deadlock[]>(ENDPOINTS.deadlocks, () => deadlockStore),
  getDeadlockById: (id: string) => resolve<Deadlock | undefined>(ENDPOINTS.deadlock(id), () => deadlockStore.find((d) => d.id === id)),
  async resolveDeadlock(id: string): Promise<Deadlock> {
    await mockDelay(600);
    deadlockStore = deadlockStore.map((d) =>
      d.id === id ? { ...d, resolved: true, deadlockRisk: Math.round(d.deadlockRisk * 0.45), severity: riskLevelFromScore(Math.round(d.deadlockRisk * 0.45)) } : d,
    );
    return deadlockStore.find((d) => d.id === id)!;
  },
};

let deadlockStore: Deadlock[] = [...db.deadlocks];
