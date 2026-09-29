import { prisma } from "../config/database";

export class ReportRepository {
  static async findAll(organizationId: string, where: any = {}, orderBy: any = { createdAt: "asc" }) {
    return prisma.report.findMany({
      where: { ...where, organizationId },
      orderBy,
    });
  }

  static async findById(id: string, organizationId?: string) {
    if (organizationId) {
      return prisma.report.findFirst({
        where: { id, organizationId },
      });
    }
    return prisma.report.findUnique({ where: { id } });
  }

  static async update(id: string, organizationId: string, patch: any) {
    const report = await this.findById(id, organizationId);
    if (!report) return null;
    return prisma.report.update({ where: { id }, data: patch });
  }

  static async create(data: any) {
    return prisma.report.create({ data });
  }

  static async count(organizationId: string, where: any = {}) {
    return prisma.report.count({
      where: { ...where, organizationId },
    });
  }

  static async deleteMany(organizationId: string, where: any = {}) {
    return prisma.report.deleteMany({
      where: { ...where, organizationId },
    });
  }
}
