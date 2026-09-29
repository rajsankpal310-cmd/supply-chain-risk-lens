import { prisma } from "../config/database";

export class PredictionRepository {
  static async findMany(organizationId: string, where: any = {}, orderBy: any = { probability: "desc" }) {
    return prisma.prediction.findMany({
      where: { ...where, organizationId },
      orderBy,
      include: { firm: true },
    });
  }

  static async findById(id: string, organizationId?: string) {
    if (organizationId) {
      return prisma.prediction.findFirst({
        where: { id, organizationId },
        include: { firm: true },
      });
    }
    return prisma.prediction.findUnique({
      where: { id },
      include: { firm: true },
    });
  }

  static async create(data: any) {
    return prisma.prediction.create({ data });
  }

  static async deleteMany(organizationId: string, where: any = {}) {
    return prisma.prediction.deleteMany({
      where: { ...where, organizationId },
    });
  }

  static async count(organizationId: string) {
    return prisma.prediction.count({ where: { organizationId } });
  }
}
