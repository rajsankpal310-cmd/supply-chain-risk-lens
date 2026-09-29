import { prisma } from "../config/database";

export class AlertRepository {
  static async findAll(organizationId: string, where: any = {}, orderBy: any = { date: "desc" }) {
    return prisma.alert.findMany({
      where: { ...where, organizationId },
      orderBy,
    });
  }

  static async findById(id: string, organizationId?: string) {
    if (organizationId) {
      return prisma.alert.findFirst({
        where: { id, organizationId },
      });
    }
    return prisma.alert.findUnique({ where: { id } });
  }

  static async create(data: any) {
    return prisma.alert.create({ data });
  }

  static async update(id: string, organizationId: string, patch: any) {
    const alert = await this.findById(id, organizationId);
    if (!alert) return null;
    return prisma.alert.update({ where: { id }, data: patch });
  }

  static async updateMany(organizationId: string, data: any, where: any = {}) {
    return prisma.alert.updateMany({
      where: { ...where, organizationId },
      data,
    });
  }

  static async deleteMany(organizationId: string, where: any = {}) {
    return prisma.alert.deleteMany({
      where: { ...where, organizationId },
    });
  }
}
