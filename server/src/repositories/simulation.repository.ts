import { prisma } from "../config/database";

export class SimulationRepository {
  static async findMany(organizationId: string, where: any = {}, orderBy: any = { createdAt: "desc" }) {
    return prisma.simulationRun.findMany({
      where: { ...where, organizationId },
      orderBy,
      include: { scenario: true },
    });
  }

  static async findById(id: string, organizationId?: string) {
    if (organizationId) {
      return prisma.simulationRun.findFirst({
        where: { id, organizationId },
        include: { scenario: true },
      });
    }
    return prisma.simulationRun.findUnique({
      where: { id },
      include: { scenario: true },
    });
  }

  static async create(data: any) {
    return prisma.simulationRun.create({
      data,
      include: { scenario: true },
    });
  }

  static async count(organizationId: string, where: any = {}) {
    return prisma.simulationRun.count({
      where: { ...where, organizationId },
    });
  }
}
