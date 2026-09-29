import { prisma } from "../config/database";

export class FirmRepository {
  static async findAll(organizationId: string, where: any = {}) {
    return prisma.firm.findMany({
      where: { ...where, organizationId },
      orderBy: { riskScore: "desc" },
    });
  }

  static async findById(id: string, organizationId?: string) {
    if (organizationId) {
      return prisma.firm.findFirst({
        where: { id, organizationId },
      });
    }
    return prisma.firm.findUnique({ where: { id } });
  }

  static async create(data: any) {
    return prisma.firm.create({ data });
  }

  static async update(id: string, organizationId: string, patch: any) {
    const firm = await this.findById(id, organizationId);
    if (!firm) return null;
    return prisma.firm.update({ where: { id }, data: patch });
  }

  static async updateMetrics(id: string, metrics: any) {
    return prisma.firm.update({ where: { id }, data: metrics });
  }

  static async delete(id: string, organizationId: string) {
    const firm = await this.findById(id, organizationId);
    if (!firm) return null;
    return prisma.firm.delete({ where: { id } });
  }

  static async count(organizationId: string, where: any = {}) {
    return prisma.firm.count({
      where: { ...where, organizationId },
    });
  }
}
