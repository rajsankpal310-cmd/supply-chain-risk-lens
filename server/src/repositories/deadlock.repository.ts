import { prisma } from "../config/database";

export class DeadlockRepository {
  static async findAll(organizationId: string) {
    return prisma.deadlock.findMany({
      where: { organizationId },
      orderBy: { detectedAt: "desc" },
    });
  }

  static async findById(id: string, organizationId?: string) {
    if (organizationId) {
      return prisma.deadlock.findFirst({ where: { id, organizationId } });
    }
    return prisma.deadlock.findUnique({ where: { id } });
  }

  static async create(data: any) {
    return prisma.deadlock.create({ data });
  }

  static async upsert(id: string, update: any, create: any) {
    return prisma.deadlock.upsert({
      where: { id },
      update,
      create,
    });
  }

  static async update(id: string, organizationId: string, patch: any) {
    const deadlock = await this.findById(id, organizationId);
    if (!deadlock) return null;
    return prisma.deadlock.update({ where: { id }, data: patch });
  }

  static async count(organizationId: string) {
    return prisma.deadlock.count({ where: { organizationId } });
  }

  static async deleteAll(organizationId: string) {
    return prisma.deadlock.deleteMany({ where: { organizationId } });
  }
}
