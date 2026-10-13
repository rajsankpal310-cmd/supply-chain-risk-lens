import { CascadeSimulationResult } from "../simulation/indianSmeCascadeEngine";
import { SmePredictionOutput } from "../pipeline/indianSmeMLPipeline";
import { SmeNetworkEdge } from "../network/indianSmeNetworkEngine";

export interface SmeResolutionAction {
  id: string;
  type:
    | "PAYMENT_PRIORITIZATION"
    | "TREDS_INVOICE_FINANCING"
    | "CREDIT_LINE_CONSIDERATION"
    | "PAYMENT_RESCHEDULING"
    | "BUYER_DIVERSIFICATION"
    | "LIQUIDITY_BUFFER_ALLOCATION";
  title: string;
  trigger: string;
  evidence: string;
  reason: string;
  expectedImpact: string;
  confidence: number;
  source: string;
  model: string;
  limitations: string;
  disclaimer: "DECISION_SUPPORT_ONLY_NO_EXECUTION";
}

export interface ResolutionPlan {
  planId: string;
  generatedAt: string;
  status: "ACTIVE_RECOMMENDATIONS";
  operationalMode: "DECISION_SUPPORT_ONLY";
  recommendations: SmeResolutionAction[];
  governanceAttestation: string;
}

export class IndianSmeResolutionEngine {
  /**
   * Generates tailored Indian SME risk mitigation strategies from observed ML predictions and network topology.
   * STRICTLY NON-TRANSACTIONAL DECISION SUPPORT.
   */
  static generateResolutions(
    predictions: SmePredictionOutput[],
    edges: SmeNetworkEdge[],
    cascadeScenario?: CascadeSimulationResult
  ): ResolutionPlan {
    const recommendations: SmeResolutionAction[] = [];

    // 1. TReDS Invoice Financing Recommendation
    const criticalInvoices = predictions.filter((p) => p.riskTier === "CRITICAL" || p.predictedDelayDays > 25);
    if (criticalInvoices.length > 0) {
      recommendations.push({
        id: `ACT-TREDS-${Date.now().toString().slice(-4)}`,
        type: "TREDS_INVOICE_FINANCING",
        title: "TReDS Institutional Factoring Consideration",
        trigger: `${criticalInvoices.length} invoices identified with elevated payment delay risk (predicted delay > 25 days)`,
        evidence: `Model ${criticalInvoices[0].modelId} flagged invoices [${criticalInvoices.map((i) => i.transaction_id).slice(0, 3).join(", ")}] with average delay probability ${((criticalInvoices.reduce((acc, i) => acc + i.paymentDelayProbability, 0) / criticalInvoices.length) * 100).toFixed(1)}%.`,
        reason:
          "Discounting accepted invoices via an RBI-licensed TReDS platform (RXIL/M1xchange/Invoicemart) converts delayed receivables into instant liquidity without recourse.",
        expectedImpact: "Immediate liquidity realization within T+1 settlement cycle, eliminating working capital drag.",
        confidence: 0.89,
        source: "Indian SME ML Target & Counterparty Evaluation",
        model: criticalInvoices[0].modelId,
        limitations: "Requires buyer acceptance on TReDS platform and registration under MSME Udyam scheme.",
        disclaimer: "DECISION_SUPPORT_ONLY_NO_EXECUTION",
      });
    }

    // 2. Buyer Concentration & Diversification
    const highConcentrationEdge = edges.find((e) => e.dependencyRatio > 0.4);
    if (highConcentrationEdge) {
      recommendations.push({
        id: `ACT-DIV-${Date.now().toString().slice(-4)}`,
        type: "BUYER_DIVERSIFICATION",
        title: "Counterparty Dependency Mitigation & Buyer Diversification",
        trigger: `Single buyer ${highConcentrationEdge.target} accounts for ${(highConcentrationEdge.dependencyRatio * 100).toFixed(1)}% of SME revenue`,
        evidence: `Supply chain network analysis reveals critical dependency ratio of ${(highConcentrationEdge.dependencyRatio * 100).toFixed(1)}% exceeding the 35% safe diversification ceiling.`,
        reason:
          "High buyer concentration creates severe fragility if the anchor buyer experiences credit delays or restructuring.",
        expectedImpact: "Reduces maximum liquidity cascade risk exposure by spreading trade volume across multiple counterparties.",
        confidence: 0.84,
        source: "Indian SME Network Engine Topology",
        model: "SME-COUNTERPARTY-CENTRALITY-V1",
        limitations: "Client acquisition cycle may require 30 to 90 days lead time.",
        disclaimer: "DECISION_SUPPORT_ONLY_NO_EXECUTION",
      });
    }

    // 3. Liquidity Buffer Allocation from Cascade Scenario
    if (cascadeScenario && cascadeScenario.totalAtRiskExposureINR > 0) {
      recommendations.push({
        id: `ACT-BUF-${Date.now().toString().slice(-4)}`,
        type: "LIQUIDITY_BUFFER_ALLOCATION",
        title: "Preemptive Working Capital Liquidity Buffer Allocation",
        trigger: `Hypothetical stress scenario ${cascadeScenario.scenarioId} indicates potential shock of ₹${cascadeScenario.totalAtRiskExposureINR.toLocaleString()}`,
        evidence: `Contagion path traces shock from trigger ${cascadeScenario.shockTriggerNodeId} across ${cascadeScenario.totalDistressedNodes} nodes.`,
        reason:
          "Preemptive allocation of revolving overdraft or standby credit buffer insulates operations from cascading delayed payments.",
        expectedImpact: "Prevents secondary vendor defaults and safeguards statutory MSMED compliance.",
        confidence: 0.81,
        source: "Indian SME Cascade Simulation Engine",
        model: "SME-CASCADE-SIM-V1",
        limitations: "Buffer sizing is based on hypothetical scenario assumptions, not deterministic historical fact.",
        disclaimer: "DECISION_SUPPORT_ONLY_NO_EXECUTION",
      });
    }

    return {
      planId: `RES-PLAN-${Date.now().toString().slice(-6)}`,
      generatedAt: new Date().toISOString(),
      status: "ACTIVE_RECOMMENDATIONS",
      operationalMode: "DECISION_SUPPORT_ONLY",
      recommendations,
      governanceAttestation:
        "DECISION SUPPORT ONLY: NEXUS-CFR does not execute financial transactions, disburse funds, or initiate legal recovery. All recommendations require authorized human financial review.",
    };
  }
}
