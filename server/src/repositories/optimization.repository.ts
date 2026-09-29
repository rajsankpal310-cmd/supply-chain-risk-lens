import { prisma } from "../config/database";

export class OptimizationRepository {
  static async findById(id: string, organizationId?: string) {
    if (organizationId) {
      return prisma.optimizationRun.findFirst({
        where: { id, organizationId },
      });
    }
    return prisma.optimizationRun.findUnique({ where: { id } });
  }

  static async create(data: any) {
    return prisma.optimizationRun.create({ data });
  }

  static async count(organizationId: string, where: any = {}) {
    return prisma.optimizationRun.count({
      where: { ...where, organizationId },
    });
  }
}
