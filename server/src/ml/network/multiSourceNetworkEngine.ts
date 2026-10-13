/**
 * NEXUS-CFR Multi-Source Network Intelligence Engine
 * Phase 11: Real Multi-Dataset Intelligence & Network Risk Isolation
 *
 * Grounded strictly in authentic graph relationships:
 * 1. Fulton Network: Real Vendor -> Municipal Department Procurement Graph
 * 2. BPI Network: Real Vendor -> Enterprise Company Purchasing Graph
 * 3. Mendeley Network: Isolated Simulated Benchmark Graph
 * 4. Tenant Network: Isolated Demo Graph
 *
 * STRICT GOVERNANCE RULE:
 * Absolutely NO cross-source edges. Each network is strictly topologically isolated.
 */

import fs from "fs";
import path from "path";

export interface NetworkNodeMetric {
  nodeId: string;
  nodeName: string;
  nodeType: "VENDOR" | "BUYER_DEPARTMENT" | "ENTERPRISE_COMPANY";
  domain: "FULTON_MUNICIPAL" | "BPI_ENTERPRISE" | "MENDELEY_SIMULATED" | "TENANT_DEMO";
  inDegree: number;
  outDegree: number;
  totalDegree: number;
  weightedDegree: number;
  concentrationHHI: number;
  dependencyRatio: number;
  centralityScore: number;
  isHub: boolean;
  connectedPartners: string[];
}

export interface DomainNetworkSummary {
  domain: string;
  sourceProvenance: string;
  totalNodes: number;
  totalEdges: number;
  totalVolume: number;
  density: number;
  identifiedHubs: string[];
  topNodesByCentrality: NetworkNodeMetric[];
  averageDependency: number;
}

export class MultiSourceNetworkEngine {
  private static cachedFultonSummary: DomainNetworkSummary | null = null;
  private static cachedBPISummary: DomainNetworkSummary | null = null;

  /**
   * Builds the authentic Fulton County procurement network.
   * Edges: Vendor -> Municipal Department
   */
  public static getFultonNetwork(): DomainNetworkSummary {
    if (this.cachedFultonSummary) return this.cachedFultonSummary;

    const dataPath = path.resolve(__dirname, "../../../data/acquisition/fulton_vendor_payments_raw.json");
    if (!fs.existsSync(dataPath)) {
      throw new Error(`Fulton data not found at ${dataPath}`);
    }

    const payload = JSON.parse(fs.readFileSync(dataPath, "utf8"));
    const records = Array.isArray(payload) ? payload : (payload.records || []);

    const nodes = new Map<string, {
      name: string;
      type: "VENDOR" | "BUYER_DEPARTMENT";
      inDegree: number;
      outDegree: number;
      volume: number;
      edges: Map<string, number>;
    }>();

    let totalNetworkVolume = 0;
    let edgeCount = 0;

    for (const r of records) {
      const vendorName = (r.vendor_legal_name || r.Vendor_Name || r.vendor_name || "UNKNOWN_VENDOR").trim();
      const deptName = (r.department_name || r.Department || r.dept || "GENERAL_MUNICIPAL").trim();
      const amount = Math.max(0, parseFloat(r.amount || r.Invoice_Amount) || 0);

      totalNetworkVolume += amount;

      // Vendor Node
      if (!nodes.has(vendorName)) {
        nodes.set(vendorName, {
          name: vendorName,
          type: "VENDOR",
          inDegree: 0,
          outDegree: 0,
          volume: 0,
          edges: new Map()
        });
      }
      const vNode = nodes.get(vendorName)!;
      vNode.volume += amount;
      vNode.edges.set(deptName, (vNode.edges.get(deptName) || 0) + amount);

      // Department Node
      if (!nodes.has(deptName)) {
        nodes.set(deptName, {
          name: deptName,
          type: "BUYER_DEPARTMENT",
          inDegree: 0,
          outDegree: 0,
          volume: 0,
          edges: new Map()
        });
      }
      const dNode = nodes.get(deptName)!;
      dNode.volume += amount;
      dNode.edges.set(vendorName, (dNode.edges.get(vendorName) || 0) + amount);
    }

    // Compute metrics
    const metrics: NetworkNodeMetric[] = [];
    const maxDegreePossible = Math.max(1, nodes.size - 1);

    for (const [id, n] of nodes.entries()) {
      const degree = n.edges.size;
      edgeCount += degree;

      // HHI Concentration
      let hhi = 0;
      if (n.volume > 0) {
        for (const vol of n.edges.values()) {
          const share = vol / n.volume;
          hhi += share * share;
        }
      } else {
        hhi = 1.0;
      }

      // Dependency ratio: node volume / network volume
      const dependency = totalNetworkVolume > 0 ? n.volume / totalNetworkVolume : 0;
      const centrality = degree / maxDegreePossible;

      metrics.push({
        nodeId: id,
        nodeName: id,
        nodeType: n.type,
        domain: "FULTON_MUNICIPAL",
        inDegree: n.type === "BUYER_DEPARTMENT" ? degree : 0,
        outDegree: n.type === "VENDOR" ? degree : 0,
        totalDegree: degree,
        weightedDegree: Math.round(n.volume * 100) / 100,
        concentrationHHI: Math.round(hhi * 1000) / 1000,
        dependencyRatio: Math.round(dependency * 10000) / 10000,
        centralityScore: Math.round(centrality * 10000) / 10000,
        isHub: degree >= 15 || dependency >= 0.05,
        connectedPartners: Array.from(n.edges.keys()).slice(0, 10)
      });
    }

    metrics.sort((a, b) => b.weightedDegree - a.weightedDegree);

    const hubs = metrics.filter(m => m.isHub).map(m => m.nodeName);
    const avgDep = metrics.reduce((acc, m) => acc + m.dependencyRatio, 0) / (metrics.length || 1);

    this.cachedFultonSummary = {
      domain: "FULTON_MUNICIPAL_PROCUREMENT",
      sourceProvenance: "VERIFIED_REAL",
      totalNodes: nodes.size,
      totalEdges: Math.round(edgeCount / 2),
      totalVolume: Math.round(totalNetworkVolume * 100) / 100,
      density: Math.round((edgeCount / (nodes.size * (nodes.size - 1) || 1)) * 10000) / 10000,
      identifiedHubs: hubs,
      topNodesByCentrality: metrics.slice(0, 50),
      averageDependency: Math.round(avgDep * 10000) / 10000
    };

    return this.cachedFultonSummary;
  }

  /**
   * Builds the authentic BPI enterprise purchasing network.
   * Edges: Vendor -> Enterprise Company Code
   */
  public static getBPINetwork(): DomainNetworkSummary {
    if (this.cachedBPISummary) return this.cachedBPISummary;

    const dataPath = path.resolve(__dirname, "../../../data/acquisition/bpi_canonical_stream_sample.json");
    if (!fs.existsSync(dataPath)) {
      throw new Error(`BPI canonical stream data not found at ${dataPath}`);
    }

    const payload = JSON.parse(fs.readFileSync(dataPath, "utf8"));
    const cases = payload.cases || [];

    const nodes = new Map<string, {
      name: string;
      type: "VENDOR" | "ENTERPRISE_COMPANY";
      volume: number;
      edges: Map<string, number>;
    }>();

    let totalVolume = 0;
    let edgeCount = 0;

    for (const c of cases) {
      const vId = c.vendor_id || "vendor_unknown";
      const cId = c.company_id || "company_unknown";
      const val = Math.max(0, c.monetary_value || 100);

      totalVolume += val;

      if (!nodes.has(vId)) {
        nodes.set(vId, { name: vId, type: "VENDOR", volume: 0, edges: new Map() });
      }
      const vNode = nodes.get(vId)!;
      vNode.volume += val;
      vNode.edges.set(cId, (vNode.edges.get(cId) || 0) + val);

      if (!nodes.has(cId)) {
        nodes.set(cId, { name: cId, type: "ENTERPRISE_COMPANY", volume: 0, edges: new Map() });
      }
      const cNode = nodes.get(cId)!;
      cNode.volume += val;
      cNode.edges.set(vId, (cNode.edges.get(vId) || 0) + val);
    }

    const metrics: NetworkNodeMetric[] = [];
    const maxDegree = Math.max(1, nodes.size - 1);

    for (const [id, n] of nodes.entries()) {
      const degree = n.edges.size;
      edgeCount += degree;

      let hhi = 0;
      if (n.volume > 0) {
        for (const vol of n.edges.values()) {
          const share = vol / n.volume;
          hhi += share * share;
        }
      } else {
        hhi = 1.0;
      }

      const dependency = totalVolume > 0 ? n.volume / totalVolume : 0;
      const centrality = degree / maxDegree;

      metrics.push({
        nodeId: id,
        nodeName: id,
        nodeType: n.type,
        domain: "BPI_ENTERPRISE",
        inDegree: n.type === "ENTERPRISE_COMPANY" ? degree : 0,
        outDegree: n.type === "VENDOR" ? degree : 0,
        totalDegree: degree,
        weightedDegree: Math.round(n.volume * 100) / 100,
        concentrationHHI: Math.round(hhi * 1000) / 1000,
        dependencyRatio: Math.round(dependency * 10000) / 10000,
        centralityScore: Math.round(centrality * 10000) / 10000,
        isHub: degree >= 10 || dependency >= 0.05,
        connectedPartners: Array.from(n.edges.keys()).slice(0, 10)
      });
    }

    metrics.sort((a, b) => b.weightedDegree - a.weightedDegree);

    this.cachedBPISummary = {
      domain: "BPI_ENTERPRISE_ERP",
      sourceProvenance: "VERIFIED_REAL_STREAMING",
      totalNodes: nodes.size,
      totalEdges: Math.round(edgeCount / 2),
      totalVolume: Math.round(totalVolume * 100) / 100,
      density: Math.round((edgeCount / (nodes.size * (nodes.size - 1) || 1)) * 10000) / 10000,
      identifiedHubs: metrics.filter(m => m.isHub).map(m => m.nodeName),
      topNodesByCentrality: metrics.slice(0, 50),
      averageDependency: Math.round((metrics.reduce((acc, m) => acc + m.dependencyRatio, 0) / (metrics.length || 1)) * 10000) / 10000
    };

    return this.cachedBPISummary;
  }

  /**
   * Returns explicit graph structure for Fulton County procurement network.
   * Nodes: Vendors & Municipal Departments
   * Edges: Supplies Municipal Department (strictly Vendor -> Department)
   */
  public static getFultonGraph(): {
    metadata: { vendorCount: number; buyerCount: number; totalNodes: number; totalEdges: number; domain: string };
    nodes: Array<{ id: string; name: string; type: "VENDOR" | "BUYER_DEPARTMENT" }>;
    edges: Array<{ source: string; target: string; relationshipType: string; amount: number }>;
  } {
    const dataPath = path.resolve(__dirname, "../../../data/acquisition/fulton_vendor_payments_raw.json");
    if (!fs.existsSync(dataPath)) {
      throw new Error(`Fulton data not found at ${dataPath}`);
    }

    const payload = JSON.parse(fs.readFileSync(dataPath, "utf8"));
    const records = Array.isArray(payload) ? payload : (payload.records || []);

    const vendorMap = new Set<string>();
    const buyerMap = new Set<string>();
    const edgeMap = new Map<string, { source: string; target: string; relationshipType: string; amount: number }>();

    for (const r of records) {
      const vendorName = (r.vendor_legal_name || r.Vendor_Name || r.vendor_name || "UNKNOWN_VENDOR").trim();
      const deptName = (r.department_name || r.Department || r.dept || "GENERAL_MUNICIPAL").trim();
      const amount = Math.max(0, parseFloat(r.amount || r.Invoice_Amount) || 0);

      vendorMap.add(vendorName);
      buyerMap.add(deptName);

      const edgeKey = `${vendorName}->${deptName}`;
      if (edgeMap.has(edgeKey)) {
        edgeMap.get(edgeKey)!.amount += amount;
      } else {
        edgeMap.set(edgeKey, {
          source: vendorName,
          target: deptName,
          relationshipType: "SUPPLIES_MUNICIPAL_DEPARTMENT",
          amount
        });
      }
    }

    const nodes: Array<{ id: string; name: string; type: "VENDOR" | "BUYER_DEPARTMENT" }> = [
      ...Array.from(vendorMap).map(v => ({ id: v, name: v, type: "VENDOR" as const })),
      ...Array.from(buyerMap).map(b => ({ id: b, name: b, type: "BUYER_DEPARTMENT" as const }))
    ];

    return {
      metadata: {
        vendorCount: vendorMap.size,
        buyerCount: buyerMap.size,
        totalNodes: nodes.length,
        totalEdges: edgeMap.size,
        domain: "FULTON_MUNICIPAL"
      },
      nodes,
      edges: Array.from(edgeMap.values())
    };
  }

  /**
   * Returns explicit graph structure for BPI Challenge 2019 enterprise purchasing network.
   * Nodes: Vendors & Enterprise Companies
   * Edges: Enterprise Purchase Order (strictly Vendor -> Enterprise Company)
   */
  public static getBPIGraph(): {
    metadata: { vendorCount: number; companyCount: number; totalNodes: number; totalEdges: number; domain: string };
    nodes: Array<{ id: string; name: string; type: "VENDOR" | "ENTERPRISE_COMPANY" }>;
    edges: Array<{ source: string; target: string; relationshipType: string; amount: number }>;
  } {
    const dataPath = path.resolve(__dirname, "../../../data/acquisition/bpi_canonical_stream_sample.json");
    if (!fs.existsSync(dataPath)) {
      throw new Error(`BPI data not found at ${dataPath}`);
    }

    const payload = JSON.parse(fs.readFileSync(dataPath, "utf8"));
    const cases = payload.cases || [];

    const vendorMap = new Set<string>();
    const companyMap = new Set<string>();
    const edgeMap = new Map<string, { source: string; target: string; relationshipType: string; amount: number }>();

    for (const c of cases) {
      const vId = c.vendor_id || "vendor_unknown";
      const cId = c.company_id || "company_unknown";
      const val = Math.max(0, c.monetary_value || 100);

      vendorMap.add(vId);
      companyMap.add(cId);

      const edgeKey = `${vId}->${cId}`;
      if (edgeMap.has(edgeKey)) {
        edgeMap.get(edgeKey)!.amount += val;
      } else {
        edgeMap.set(edgeKey, {
          source: vId,
          target: cId,
          relationshipType: "ENTERPRISE_PURCHASE_ORDER",
          amount: val
        });
      }
    }

    const nodes: Array<{ id: string; name: string; type: "VENDOR" | "ENTERPRISE_COMPANY" }> = [
      ...Array.from(vendorMap).map(v => ({ id: v, name: v, type: "VENDOR" as const })),
      ...Array.from(companyMap).map(c => ({ id: c, name: c, type: "ENTERPRISE_COMPANY" as const }))
    ];

    return {
      metadata: {
        vendorCount: vendorMap.size,
        companyCount: companyMap.size,
        totalNodes: nodes.length,
        totalEdges: edgeMap.size,
        domain: "BPI_ENTERPRISE"
      },
      nodes,
      edges: Array.from(edgeMap.values())
    };
  }
}

