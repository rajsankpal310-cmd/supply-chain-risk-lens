/**
 * NEXUS-CFR Network + ML Integration Bridge
 * Phase 4: Production ML Foundation
 *
 * Enforces strict conceptual separation between:
 * 1. ML Layer: "What is the estimated statistical risk of this transaction/firm?"
 * 2. Graph Layer: "Who depends on whom in the supply network topology?"
 * 3. Simulation Layer: "What happens to liquidity across nodes if this shock propagates?"
 * 4. Optimization Layer: "Which constrained liquidity intervention minimizes network systemic loss?"
 *
 * The ML model NEVER invents cascade dynamics. The cascade engine ingests validated ML risks
 * as exogenous node failure probabilities or shock vectors.
 */

export interface TransactionMlRiskScore {
  invoiceId: string;
  supplierId: string;
  buyerId: string;
  invoiceAmount: number;
  dueDate: string;
  calibratedDelayProbability: number;
  riskBand: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  isMlDerived: boolean;
}

export interface NodeAggregatedMlRisk {
  firmId: string;
  totalReceivableExposure: number;
  totalPayableExposure: number;
  weightedDelayProbability: number;
  highRiskInvoicesCount: number;
  firmStressBand: "STABLE" | "WATCHLIST" | "STRESSED" | "CRITICAL";
  derivedFromMlInference: boolean;
}

export interface NetworkCascadeShockVector {
  simulationRunId: string;
  originatingFirmId: string;
  initialMlFailureProbability: number;
  exogenousShockAmount: number;
  propagationRounds: number;
  impactedNodeIds: string[];
  totalModeledLiquidityShortfall: number;
  assumptions: {
    mlSource: string;
    graphVersion: string;
    workingCapitalBufferRatio: number;
    delayTransmissionFactor: number;
  };
}

export class NetworkMlBridge {
  /**
   * Aggregates individual invoice-level ML predictions to counterparty firm nodes.
   * Does NOT simulate cascade; solely maps transaction inferences to node exposure.
   */
  public static aggregateTransactionRisksToFirms(
    invoices: TransactionMlRiskScore[]
  ): Map<string, NodeAggregatedMlRisk> {
    const firmMap = new Map<string, NodeAggregatedMlRisk>();

    for (const inv of invoices) {
      // 1. Process Supplier side (Receivables at risk)
      let supNode = firmMap.get(inv.supplierId);
      if (!supNode) {
        supNode = {
          firmId: inv.supplierId,
          totalReceivableExposure: 0,
          totalPayableExposure: 0,
          weightedDelayProbability: 0,
          highRiskInvoicesCount: 0,
          firmStressBand: "STABLE",
          derivedFromMlInference: inv.isMlDerived,
        };
        firmMap.set(inv.supplierId, supNode);
      }
      supNode.totalReceivableExposure += inv.invoiceAmount;
      if (inv.riskBand === "HIGH" || inv.riskBand === "CRITICAL") {
        supNode.highRiskInvoicesCount++;
      }

      // 2. Process Buyer side (Payables obligations)
      let buyerNode = firmMap.get(inv.buyerId);
      if (!buyerNode) {
        buyerNode = {
          firmId: inv.buyerId,
          totalReceivableExposure: 0,
          totalPayableExposure: 0,
          weightedDelayProbability: 0,
          highRiskInvoicesCount: 0,
          firmStressBand: "STABLE",
          derivedFromMlInference: inv.isMlDerived,
        };
        firmMap.set(inv.buyerId, buyerNode);
      }
      buyerNode.totalPayableExposure += inv.invoiceAmount;
    }

    // Compute exposure-weighted delay probabilities and stress bands
    for (const [firmId, node] of firmMap.entries()) {
      const firmInvoices = invoices.filter((inv) => inv.supplierId === firmId);
      if (firmInvoices.length > 0 && node.totalReceivableExposure > 0) {
        let weightedProbSum = 0;
        for (const inv of firmInvoices) {
          weightedProbSum += inv.calibratedDelayProbability * (inv.invoiceAmount / node.totalReceivableExposure);
        }
        node.weightedDelayProbability = parseFloat(weightedProbSum.toFixed(4));
      }

      if (node.weightedDelayProbability >= 0.70 || node.highRiskInvoicesCount >= 3) {
        node.firmStressBand = "CRITICAL";
      } else if (node.weightedDelayProbability >= 0.45) {
        node.firmStressBand = "STRESSED";
      } else if (node.weightedDelayProbability >= 0.25) {
        node.firmStressBand = "WATCHLIST";
      } else {
        node.firmStressBand = "STABLE";
      }
    }

    return firmMap;
  }

  /**
   * Constructs an exogenous shock vector for the existing cascade simulation engine,
   * cleanly bridging ML prediction probability to scenario parameters.
   */
  public static constructCascadeInputFromMl(
    firmId: string,
    firmRisk: NodeAggregatedMlRisk,
    graphTopology: { edges: Array<{ source: string; target: string; weight: number }> },
    assumptions = { workingCapitalBufferRatio: 0.20, delayTransmissionFactor: 0.85 }
  ): NetworkCascadeShockVector {
    const simulationRunId = `SIM-ML-BRIDGE-${Date.now().toString(36).toUpperCase()}`;

    // Calculate potential liquidity deficit from predicted receivable delay
    const initialShockAmount = firmRisk.totalReceivableExposure * firmRisk.weightedDelayProbability;

    // Identify downstream suppliers directly dependent on this firm
    const downstreamEdges = graphTopology.edges.filter((e) => e.target === firmId);
    const impactedNodeIds = Array.from(new Set(downstreamEdges.map((e) => e.source)));

    return {
      simulationRunId,
      originatingFirmId: firmId,
      initialMlFailureProbability: firmRisk.weightedDelayProbability,
      exogenousShockAmount: Math.round(initialShockAmount),
      propagationRounds: impactedNodeIds.length > 0 ? 2 : 0,
      impactedNodeIds,
      totalModeledLiquidityShortfall: Math.round(initialShockAmount * assumptions.delayTransmissionFactor),
      assumptions: {
        mlSource: "PAYMENT_DELAY_RISK_LOGISTIC_REGRESSION_CALIBRATED",
        graphVersion: "TOPOLOGY_V2",
        ...assumptions,
      },
    };
  }
}
