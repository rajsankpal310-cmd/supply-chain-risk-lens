import { prisma } from "../config/database";

export class RecommendationRepository {
  static async findAll(organizationId: string, where: any = {}) {
    return prisma.recommendation.findMany({
      where: { ...where, organizationId },
      orderBy: { confidence: "desc" },
    });
  }

  static async findById(id: string, organizationId?: string) {
    if (organizationId) {
      return prisma.recommendation.findFirst({
        where: { id, organizationId },
      });
    }
    return prisma.recommendation.findUnique({ where: { id } });
  }

  static async create(data: any) {
    return prisma.recommendation.create({ data });
  }

  static async upsert(id: string, update: any, create: any) {
    return prisma.recommendation.upsert({
      where: { id },
      update,
      create,
    });
  }

  static async update(id: string, organizationId: string, patch: any) {
    const rec = await this.findById(id, organizationId);
    if (!rec) return null;
    return prisma.recommendation.update({ where: { id }, data: patch });
  }

  static async count(organizationId: string) {
    return prisma.recommendation.count({ where: { organizationId } });
  }

  static async deleteMany(organizationId: string, where: any = {}) {
    return prisma.recommendation.deleteMany({
      where: { ...where, organizationId },
    });
  }
}
