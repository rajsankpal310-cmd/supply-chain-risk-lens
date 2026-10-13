import { IndianSmeSupplyChainGraph } from "../network/indianSmeNetworkEngine";

export interface CascadeSimulationResult {
  scenarioId: string;
  scenarioClassification: "HYPOTHETICAL_SCENARIO";
  shockTriggerNodeId: string;
  shockDelayDays: number;
  simulatedRounds: number;
  totalDistressedNodes: number;
  totalAtRiskExposureINR: number;
  propagationPath: Array<{
    round: number;
    nodeId: string;
    nodeType: string;
    liquidityShortfallINR: number;
    cause: string;
  }>;
  disclaimer: string;
}

export class IndianSmeCascadeEngine {
  /**
   * Simulates hypothetical liquidity shock contagion through observed network topology.
   * Labeled strictly as HYPOTHETICAL_SCENARIO to prevent confusion with historical fact.
   */
  static simulateCascade(
    graph: IndianSmeSupplyChainGraph,
    triggerBuyerId: string,
    shockDelayDays: number = 60
  ): CascadeSimulationResult {
    const triggerNode = graph.nodes.find((n) => n.id === triggerBuyerId);
    if (!triggerNode) {
      throw new Error(`Shock trigger node ${triggerBuyerId} not found in Indian SME graph.`);
    }

    const path: CascadeSimulationResult["propagationPath"] = [];
    const distressedNodes = new Set<string>([triggerBuyerId]);
    let atRiskExposure = 0;

    // Round 1: Immediate suppliers directly exposed to this buyer
    const directSuppliers = graph.edges.filter((e) => e.target === triggerBuyerId);
    path.push({
      round: 0,
      nodeId: triggerBuyerId,
      nodeType: triggerNode.type,
      liquidityShortfallINR: triggerNode.outstandingOverdueINR || 500000,
      cause: `Hypothetical default/severe delay of ${shockDelayDays} days initiated by buyer`,
    });

    for (const edge of directSuppliers) {
      distressedNodes.add(edge.source);
      const supplierNode = graph.nodes.find((n) => n.id === edge.source);
      const edgeExposure = edge.totalVolumeINR * edge.dependencyRatio;
      atRiskExposure += edgeExposure;

      path.push({
        round: 1,
        nodeId: edge.source,
        nodeType: supplierNode?.type || "SME",
        liquidityShortfallINR: Number(edgeExposure.toFixed(2)),
        cause: `Receivables freeze from key buyer ${triggerBuyerId} (${(edge.dependencyRatio * 100).toFixed(1)}% revenue dependency)`,
      });
    }

    return {
      scenarioId: `SCENARIO-HYP-${Date.now().toString().slice(-6)}`,
      scenarioClassification: "HYPOTHETICAL_SCENARIO",
      shockTriggerNodeId: triggerBuyerId,
      shockDelayDays,
      simulatedRounds: directSuppliers.length > 0 ? 2 : 1,
      totalDistressedNodes: distressedNodes.size,
      totalAtRiskExposureINR: Number(atRiskExposure.toFixed(2)),
      propagationPath: path,
      disclaimer:
        "CRITICAL GOVERNANCE NOTICE: Cascade outputs represent a HYPOTHETICAL counterfactual stress scenario, NOT observed historical contagion. Intended strictly for preemptive working capital and risk mitigation planning.",
    };
  }
}
