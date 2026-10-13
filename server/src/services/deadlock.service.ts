import { DeadlockRepository } from "../repositories/deadlock.repository";
import { FirmRepository } from "../repositories/firm.repository";
import { RelationshipRepository } from "../repositories/relationship.repository";

export class DeadlockService {
  static async getDeadlocks(organizationId: string) {
    await this.detectAndPersistDeadlocks(organizationId);
    const deadlocks = await DeadlockRepository.findAll(organizationId);
    return deadlocks.map((d: any) => {
      const parsed = typeof d.chain === "string" ? JSON.parse(d.chain) : d.chain;
      const chainDetails = parsed?.chainDetails || (Array.isArray(parsed) ? parsed : []);
      return {
        ...d,
        chain: chainDetails,
        rootRiskNode: parsed?.rootRiskNode || { id: d.rootFirmId, name: d.rootFirmName, riskScore: d.deadlockRisk, riskLevel: d.severity },
        bottleneckEntity: parsed?.bottleneckEntity,
        connectedNodes: parsed?.connectedNodes || chainDetails,
        possibleCascade: parsed?.possibleCascade,
        deadlockSeverity: parsed?.deadlockSeverity || d.severity,
        detectedAt: d.detectedAt.toISOString().slice(0, 10),
      };
    });
  }

  static async getDeadlockById(organizationId: string, id: string) {
    const d = await DeadlockRepository.findById(id, organizationId);
    if (!d) throw { status: 404, message: "This resource is not available in your organization." };
    const parsed = typeof d.chain === "string" ? JSON.parse(d.chain) : d.chain;
    const chainDetails = parsed?.chainDetails || (Array.isArray(parsed) ? parsed : []);
    return {
      ...d,
      chain: chainDetails,
      rootRiskNode: parsed?.rootRiskNode || { id: d.rootFirmId, name: d.rootFirmName, riskScore: d.deadlockRisk, riskLevel: d.severity },
      bottleneckEntity: parsed?.bottleneckEntity,
      connectedNodes: parsed?.connectedNodes || chainDetails,
      possibleCascade: parsed?.possibleCascade,
      deadlockSeverity: parsed?.deadlockSeverity || d.severity,
      detectedAt: d.detectedAt.toISOString().slice(0, 10),
    };
  }

  static async resolveDeadlock(organizationId: string, id: string) {
    const deadlock = await DeadlockRepository.findById(id, organizationId);
    if (!deadlock) throw { status: 404, message: "This resource is not available in your organization." };

    const newRisk = Math.round(deadlock.deadlockRisk * 0.45);
    const updated = await DeadlockRepository.update(id, organizationId, {
      resolved: true,
      status: "RESOLVED",
      deadlockRisk: newRisk,
      severity: newRisk >= 80 ? "CRITICAL" : newRisk >= 62 ? "HIGH" : newRisk >= 40 ? "MEDIUM" : "LOW",
      resolvedAt: new Date(),
    });

    return {
      ...updated,
      chain: typeof updated!.chain === "string" ? JSON.parse(updated!.chain) : updated!.chain,
      detectedAt: updated!.detectedAt.toISOString().slice(0, 10),
    };
  }

  /** Algorithmic DFS Cycle Detection for circular payment dependencies scoped to organization */
  static async detectAndPersistDeadlocks(organizationId: string) {
    const firms = await FirmRepository.findAll(organizationId);
    const relationships = await RelationshipRepository.findAll(organizationId);

    const adjMap = new Map<string, Array<{ targetId: string; value: number }>>();
    for (const f of firms) adjMap.set(f.id, []);

    for (const r of relationships) {
      if (adjMap.has(r.sourceFirmId)) {
        adjMap.get(r.sourceFirmId)!.push({ targetId: r.targetFirmId, value: r.avgTransactionValue });
      }
    }

    const visited = new Set<string>();
    const recStack = new Set<string>();
    const path: string[] = [];
    const detectedCycles: string[][] = [];

    const dfs = (nodeId: string) => {
      visited.add(nodeId);
      recStack.add(nodeId);
      path.push(nodeId);

      const neighbors = adjMap.get(nodeId) || [];
      for (const edge of neighbors) {
        if (!visited.has(edge.targetId)) {
          dfs(edge.targetId);
        } else if (recStack.has(edge.targetId)) {
          const cycleStartIndex = path.indexOf(edge.targetId);
          if (cycleStartIndex !== -1) {
            const cyclePath = path.slice(cycleStartIndex);
            if (cyclePath.length >= 2) {
              detectedCycles.push(cyclePath);
            }
          }
        }
      }

      path.pop();
      recStack.delete(nodeId);
    };

    for (const f of firms) {
      if (!visited.has(f.id)) {
        dfs(f.id);
      }
    }

    let deadlockIndex = 1;
    for (const cycle of detectedCycles.slice(0, 5)) {
      const rootId = cycle[0]!;
      const rootFirm = firms.find((f) => f.id === rootId);
      if (!rootFirm) continue;

      let maxStressFirm = rootFirm;
      const chainDetails = cycle.map((fId) => {
        const firmObj = firms.find((f) => f.id === fId);
        if (firmObj && firmObj.financialStress > (maxStressFirm?.financialStress || 0)) {
          maxStressFirm = firmObj;
        }
        return {
          firmId: fId,
          firmName: firmObj ? firmObj.name : fId,
          owesAmount: firmObj ? Math.round(firmObj.outstandingAmount * 0.4) : 500000,
          stress: firmObj ? firmObj.financialStress : 60,
          riskScore: firmObj ? firmObj.riskScore : 50,
          riskLevel: firmObj ? firmObj.riskLevel : "MEDIUM",
          isHighRisk: firmObj ? firmObj.riskScore >= 62 : false,
        };
      });

      const totalExposure = chainDetails.reduce((s, c) => s + c.owesAmount, 0);
      const deadlockId = `DLK-${organizationId}-${String(deadlockIndex++).padStart(3, "0")}`;
      const deadlockRisk = Math.min(99, Math.round(rootFirm.riskScore * 0.7 + cycle.length * 8));
      const severity = deadlockRisk >= 80 ? "CRITICAL" : deadlockRisk >= 62 ? "HIGH" : deadlockRisk >= 40 ? "MEDIUM" : "LOW";

      const dbPayload = {
        rootFirmId: rootFirm.id,
        rootFirmName: rootFirm.name,
        severity,
        deadlockRisk,
        chain: JSON.stringify({
          chainDetails,
          rootRiskNode: {
            id: rootFirm.id,
            name: rootFirm.name,
            riskScore: rootFirm.riskScore,
            riskLevel: rootFirm.riskLevel,
          },
          bottleneckEntity: {
            id: maxStressFirm.id,
            name: maxStressFirm.name,
            financialStress: maxStressFirm.financialStress,
          },
          connectedNodes: chainDetails,
          exposure: totalExposure,
          possibleCascade: {
            cascadeRisk: Math.min(99, Math.round(deadlockRisk * 0.85)),
            affectedEntitiesCount: cycle.length,
            estimatedContagionLoss: Math.round(totalExposure * 1.35),
          },
          deadlockSeverity: severity,
        }),
        totalExposure,
        estimatedImpact: Math.round(totalExposure * 1.35),
        organizationId,
      };

      await DeadlockRepository.upsert(
        deadlockId,
        dbPayload,
        {
          id: deadlockId,
          ...dbPayload,
          status: "OPEN",
          resolved: false,
        },
      );
    }
  }
}
