import { prisma } from "../config/database";

export class ScenarioRepository {
  static async findMany(organizationId: string, where: any = {}, orderBy: any = { createdAt: "desc" }) {
    return prisma.scenario.findMany({
      where: { ...where, organizationId },
      orderBy,
    });
  }

  static async findById(id: string, organizationId?: string) {
    if (organizationId) {
      return prisma.scenario.findFirst({
        where: { id, organizationId },
      });
    }
    return prisma.scenario.findUnique({ where: { id } });
  }

  static async create(data: any) {
    return prisma.scenario.create({ data });
  }

  static async update(id: string, organizationId: string, patch: any) {
    const scenario = await this.findById(id, organizationId);
    if (!scenario) return null;
    return prisma.scenario.update({ where: { id }, data: patch });
  }

  static async delete(id: string, organizationId: string) {
    const scenario = await this.findById(id, organizationId);
    if (!scenario) return null;
    return prisma.scenario.delete({ where: { id } });
  }

  static async count(organizationId: string, where: any = {}) {
    return prisma.scenario.count({
      where: { ...where, organizationId },
    });
  }
}
