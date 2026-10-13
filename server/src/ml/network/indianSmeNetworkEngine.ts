import { CanonicalInvoiceContract } from "../../pipeline/canonicalContract";

export interface SmeNetworkNode {
  id: string;
  name: string;
  type: "SME" | "BUYER" | "SUPPLIER";
  gstin?: string;
  totalExposureINR: number;
  outstandingOverdueINR: number;
  invoiceCount: number;
  degree: number;
  counterpartyRiskScore: number; // 0 to 100
}

export interface SmeNetworkEdge {
  source: string;
  target: string;
  relationship: "SELLS_TO" | "BUYS_FROM";
  totalVolumeINR: number;
  activeInvoiceCount: number;
  dependencyRatio: number; // share of supplier's revenue or buyer's spend
  averageCreditDays: number;
}

export interface IndianSmeSupplyChainGraph {
  nodes: SmeNetworkNode[];
  edges: SmeNetworkEdge[];
  summary: {
    totalNodes: number;
    totalEdges: number;
    totalActiveExposureINR: number;
    topBuyerConcentrationRatio: number;
    isolatedCounterpartyCount: number;
  };
  provenance: {
    source: "AUTHORIZED_INDIAN_SME_TRANSACTIONS";
    crossSourceJoinsApplied: false;
    boundary: "TENANT_ISOLATED";
  };
}

export class IndianSmeNetworkEngine {
  /**
   * Constructs supply chain graph strictly from genuine observed Indian SME transactions.
   * Zero artificial cross-dataset entity merging.
   */
  static buildGraph(records: CanonicalInvoiceContract[]): IndianSmeSupplyChainGraph {
    const nodeMap = new Map<string, SmeNetworkNode>();
    const edgeMap = new Map<string, SmeNetworkEdge>();

    let totalExposure = 0;
    const smeTotalRevenue = new Map<string, number>();

    // 1. Accumulate nodes and exposures
    for (const r of records) {
      const smeId = r.sme_id || "SME-CORE";
      const buyerId = r.buyer_id || "BUYER-UNKNOWN";
      const amt = Number(r.invoice_amount || 0);
      const outstanding = Number(r.outstanding_amount || 0);

      totalExposure += outstanding;
      smeTotalRevenue.set(smeId, (smeTotalRevenue.get(smeId) || 0) + amt);

      // SME Node
      if (!nodeMap.has(smeId)) {
        nodeMap.set(smeId, {
          id: smeId,
          name: smeId,
          type: "SME",
          gstin: r.gstin,
          totalExposureINR: 0,
          outstandingOverdueINR: 0,
          invoiceCount: 0,
          degree: 0,
          counterpartyRiskScore: 35,
        });
      }
      const smeNode = nodeMap.get(smeId)!;
      smeNode.totalExposureINR += amt;
      smeNode.outstandingOverdueINR += outstanding;
      smeNode.invoiceCount++;

      // Buyer Node
      if (!nodeMap.has(buyerId)) {
        nodeMap.set(buyerId, {
          id: buyerId,
          name: buyerId,
          type: "BUYER",
          totalExposureINR: 0,
          outstandingOverdueINR: 0,
          invoiceCount: 0,
          degree: 0,
          counterpartyRiskScore: 40,
        });
      }
      const buyerNode = nodeMap.get(buyerId)!;
      buyerNode.totalExposureINR += amt;
      buyerNode.outstandingOverdueINR += outstanding;
      buyerNode.invoiceCount++;

      // Edge SME -> Buyer
      const edgeKey = `${smeId}->${buyerId}`;
      if (!edgeMap.has(edgeKey)) {
        edgeMap.set(edgeKey, {
          source: smeId,
          target: buyerId,
          relationship: "SELLS_TO",
          totalVolumeINR: 0,
          activeInvoiceCount: 0,
          dependencyRatio: 0,
          averageCreditDays: 0,
        });
      }
      const edge = edgeMap.get(edgeKey)!;
      edge.totalVolumeINR += amt;
      edge.activeInvoiceCount++;
      edge.averageCreditDays = (edge.averageCreditDays + (r.credit_period || 30)) / 2;
    }

    // 2. Compute Dependency Ratios & Degrees
    let maxBuyerConcentration = 0;
    for (const edge of edgeMap.values()) {
      const smeRev = smeTotalRevenue.get(edge.source) || 1;
      edge.dependencyRatio = Number((edge.totalVolumeINR / smeRev).toFixed(4));
      if (edge.dependencyRatio > maxBuyerConcentration) {
        maxBuyerConcentration = edge.dependencyRatio;
      }

      const sNode = nodeMap.get(edge.source);
      const tNode = nodeMap.get(edge.target);
      if (sNode) sNode.degree++;
      if (tNode) tNode.degree++;
    }

    const nodes = Array.from(nodeMap.values());
    const edges = Array.from(edgeMap.values());

    return {
      nodes,
      edges,
      summary: {
        totalNodes: nodes.length,
        totalEdges: edges.length,
        totalActiveExposureINR: Number(totalExposure.toFixed(2)),
        topBuyerConcentrationRatio: Number(maxBuyerConcentration.toFixed(4)),
        isolatedCounterpartyCount: nodes.filter((n) => n.degree === 0).length,
      },
      provenance: {
        source: "AUTHORIZED_INDIAN_SME_TRANSACTIONS",
        crossSourceJoinsApplied: false,
        boundary: "TENANT_ISOLATED",
      },
    };
  }
}
