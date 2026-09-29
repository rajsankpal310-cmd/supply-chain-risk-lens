import { ScenarioRepository } from "../repositories/scenario.repository";

export class ScenarioService {
  static async getScenarios(organizationId: string) {
    const scenarios = await ScenarioRepository.findMany(organizationId, {}, { createdAt: "desc" });
    return scenarios.map((s: any) => ({
      ...s,
      createdAt: s.createdAt.toISOString().slice(0, 10),
    }));
  }

  static async getScenarioById(organizationId: string, id: string) {
    const scenario = await ScenarioRepository.findById(id, organizationId);
    if (!scenario) throw { status: 404, message: "This resource is not available in your organization." };
    return {
      ...scenario,
      createdAt: scenario.createdAt.toISOString().slice(0, 10),
    };
  }

  static async createScenario(organizationId: string, data: any) {
    const count = await ScenarioRepository.count(organizationId);
    const id = data.id || `SCN-${String(count + 1).padStart(3, "0")}`;

    const scenario = await ScenarioRepository.create({
      id,
      organizationId,
      name: data.name,
      type: data.type || "BUYER_PAYMENT_DELAY",
      affectedFirmId: data.affectedFirmId,
      severity: data.severity || "HIGH",
      delayDays: data.delayDays || 60,
      amount: data.amount || 5000000,
      durationDays: data.durationDays || 90,
      recoveryRate: data.recoveryRate || 45,
    });

    return {
      ...scenario,
      createdAt: scenario.createdAt.toISOString().slice(0, 10),
    };
  }

  static async updateScenario(organizationId: string, id: string, patch: any) {
    const existing = await ScenarioRepository.findById(id, organizationId);
    if (!existing) throw { status: 404, message: "This resource is not available in your organization." };
    delete patch.organizationId;
    const scenario = await ScenarioRepository.update(id, organizationId, patch);
    return {
      ...scenario,
      createdAt: scenario!.createdAt.toISOString().slice(0, 10),
    };
  }

  static async deleteScenario(organizationId: string, id: string) {
    const existing = await ScenarioRepository.findById(id, organizationId);
    if (!existing) throw { status: 404, message: "This resource is not available in your organization." };
    await ScenarioRepository.delete(id, organizationId);
    return { success: true };
  }
}
