/**
 * NEXUS-CFR Hypothetical Contagion & Cascade Engine
 * Phase 11: Real Multi-Dataset Intelligence & Network Risk Simulation
 *
 * Simulates stress-testing scenarios across authentic entity graphs.
 *
 * STRICT GOVERNANCE MANDATE:
 * Every simulation result is explicitly labeled: HYPOTHETICAL_SCENARIO.
 * It is NEVER represented as historical contagion, empirical fact, or predicted bankruptcy.
 */

import { MultiSourceNetworkEngine, DomainNetworkSummary, NetworkNodeMetric } from "../network/multiSourceNetworkEngine";

export interface CascadeSimulationRequest {
  triggerNodeId: string;
  domain: "FULTON_MUNICIPAL" | "BPI_ENTERPRISE";
  initialShockLatencyDays: number;
  monetaryShockExposure?: number;
  liquidityBufferRatio?: number; // 0.0 - 1.0 (default 0.2 = 20% working capital buffer)
}

export interface CascadeStep {
  tier: number;
  entityId: string;
  entityType: string;
  preShockExposure: number;
  shockTransmitted: number;
  bufferAbsorbed: number;
  residualShock: number;
  impactSeverity: "LOW" | "MODERATE" | "HIGH" | "CRITICAL";
  hypotheticalDelayDays: number;
}

export interface CascadeSimulationResult {
  simulationId: string;
  scenarioType: "HYPOTHETICAL_SCENARIO";
  disclaimer: string;
  domain: string;
  triggerEntity: string;
  initialDelayShockDays: number;
  totalNetworkEntitiesAtRisk: number;
  totalSystemicExposureShock: number;
  cascadeDepthTiers: number;
  affectedEntities: CascadeStep[];
  mitigationRecommendations: string[];
}

export class CascadeEngine {
  public static simulateCascade(params: CascadeSimulationRequest): CascadeSimulationResult {
    const {
      triggerNodeId,
      domain,
      initialShockLatencyDays,
      monetaryShockExposure,
      liquidityBufferRatio = 0.20
    } = params;

    const simulationId = `SIM-CASCADE-${Date.now().toString(36).toUpperCase()}`;

    // Get authentic isolated graph
    const networkSummary: DomainNetworkSummary =
      domain === "FULTON_MUNICIPAL"
        ? MultiSourceNetworkEngine.getFultonNetwork()
        : MultiSourceNetworkEngine.getBPINetwork();

    const triggerNode = networkSummary.topNodesByCentrality.find(n => n.nodeId === triggerNodeId)
      || networkSummary.topNodesByCentrality[0];

    const actualTriggerId = triggerNode ? triggerNode.nodeId : triggerNodeId;
    const initialExposure = monetaryShockExposure || (triggerNode ? triggerNode.weightedDegree : 50000);

    const affected: CascadeStep[] = [];

    // Tier 0: The trigger entity
    affected.push({
      tier: 0,
      entityId: actualTriggerId,
      entityType: triggerNode ? triggerNode.nodeType : "TRIGGER_ENTITY",
      preShockExposure: initialExposure,
      shockTransmitted: initialExposure,
      bufferAbsorbed: 0,
      residualShock: initialExposure,
      impactSeverity: "CRITICAL",
      hypotheticalDelayDays: initialShockLatencyDays
    });

    // Tier 1: Direct trading partners from authentic graph
    const directPartners = triggerNode ? triggerNode.connectedPartners : [];
    let systemicExposure = initialExposure;

    for (const partnerId of directPartners.slice(0, 8)) {
      const partnerNode = networkSummary.topNodesByCentrality.find(n => n.nodeId === partnerId);
      const partnerVolume = partnerNode ? partnerNode.weightedDegree : initialExposure * 0.3;
      const dependency = partnerNode ? partnerNode.dependencyRatio : 0.05;

      const shockShare = initialExposure * (dependency > 0 ? dependency : 0.15);
      const buffer = shockShare * liquidityBufferRatio;
      const residual = Math.max(0, shockShare - buffer);
      systemicExposure += residual;

      const partnerDelay = Math.round(initialShockLatencyDays * (1 - liquidityBufferRatio) * 0.7);
      const severity: "LOW" | "MODERATE" | "HIGH" | "CRITICAL" =
        residual > 50000 ? "CRITICAL" : residual > 20000 ? "HIGH" : residual > 5000 ? "MODERATE" : "LOW";

      affected.push({
        tier: 1,
        entityId: partnerId,
        entityType: partnerNode ? partnerNode.nodeType : "TRADING_PARTNER",
        preShockExposure: Math.round(partnerVolume * 100) / 100,
        shockTransmitted: Math.round(shockShare * 100) / 100,
        bufferAbsorbed: Math.round(buffer * 100) / 100,
        residualShock: Math.round(residual * 100) / 100,
        impactSeverity: severity,
        hypotheticalDelayDays: partnerDelay
      });
    }

    const mitigations = [
      "Prioritize working-capital bridge financing for high-dependency Tier-1 suppliers.",
      "Activate early settlement discounts (dynamic discounting) to buffer liquidity.",
      "Review multi-sourcing options to prevent single-hub contagion."
    ];

    return {
      simulationId,
      scenarioType: "HYPOTHETICAL_SCENARIO",
      disclaimer: "MATHEMATICAL SIMULATION ONLY. This scenario models hypothetical stress transmission through authentic network topology. It does NOT represent observed historical contagion or real-world insolvency.",
      domain: networkSummary.domain,
      triggerEntity: actualTriggerId,
      initialDelayShockDays: initialShockLatencyDays,
      totalNetworkEntitiesAtRisk: affected.length,
      totalSystemicExposureShock: Math.round(systemicExposure * 100) / 100,
      cascadeDepthTiers: directPartners.length > 0 ? 1 : 0,
      affectedEntities: affected,
      mitigationRecommendations: mitigations
    };
  }
}
