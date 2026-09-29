import { DeadlockRepository } from "../repositories/deadlock.repository";
import { FirmRepository } from "../repositories/firm.repository";
import { RelationshipRepository } from "../repositories/relationship.repository";

export class DeadlockService {
  static async getDeadlocks(organizationId: string) {
    await this.detectAndPersistDeadlocks(organizationId);
    const deadlocks = await DeadlockRepository.findAll(organizationId);
    return deadlocks.map((d: any) => ({
      ...d,
      chain: typeof d.chain === "string" ? JSON.parse(d.chain) : d.chain,
      detectedAt: d.detectedAt.toISOString().slice(0, 10),
    }));
  }

  static async getDeadlockById(organizationId: string, id: string) {
    const d = await DeadlockRepository.findById(id, organizationId);
    if (!d) throw { status: 404, message: "This resource is not available in your organization." };
    return {
      ...d,
      chain: typeof d.chain === "string" ? JSON.parse(d.chain) : d.chain,
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

      const chainDetails = cycle.map((fId) => {
        const firmObj = firms.find((f) => f.id === fId);
        return {
          firmId: fId,
          firmName: firmObj ? firmObj.name : fId,
          owesAmount: firmObj ? Math.round(firmObj.outstandingAmount * 0.4) : 500000,
          stress: firmObj ? firmObj.financialStress : 60,
        };
      });

      const totalExposure = chainDetails.reduce((s, c) => s + c.owesAmount, 0);
      const deadlockId = `DLK-${organizationId}-${String(deadlockIndex++).padStart(3, "0")}`;
      const deadlockRisk = Math.min(99, Math.round(rootFirm.riskScore * 0.7 + cycle.length * 8));

      await DeadlockRepository.upsert(
        deadlockId,
        {
          rootFirmId: rootFirm.id,
          rootFirmName: rootFirm.name,
          deadlockRisk,
          severity: deadlockRisk >= 80 ? "CRITICAL" : deadlockRisk >= 62 ? "HIGH" : deadlockRisk >= 40 ? "MEDIUM" : "LOW",
          chain: JSON.stringify(chainDetails),
          totalExposure,
          estimatedImpact: Math.round(totalExposure * 1.35),
          organizationId,
        },
        {
          id: deadlockId,
          organizationId,
          rootFirmId: rootFirm.id,
          rootFirmName: rootFirm.name,
          severity: deadlockRisk >= 80 ? "CRITICAL" : deadlockRisk >= 62 ? "HIGH" : deadlockRisk >= 40 ? "MEDIUM" : "LOW",
          deadlockRisk,
          chain: JSON.stringify(chainDetails),
          totalExposure,
          estimatedImpact: Math.round(totalExposure * 1.35),
          status: "OPEN",
          resolved: false,
        },
      );
    }
  }
}
