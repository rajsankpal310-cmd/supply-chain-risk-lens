import { prisma } from "../config/database";

export class RelationshipRepository {
  static async findAll(organizationId: string, orderBy: any = { dependencyLevel: "desc" }) {
    return prisma.relationship.findMany({
      where: { organizationId },
      orderBy,
      include: { sourceFirm: true, targetFirm: true },
    });
  }

  static async findById(id: string, organizationId?: string) {
    if (organizationId) {
      return prisma.relationship.findFirst({
        where: { id, organizationId },
        include: { sourceFirm: true, targetFirm: true },
      });
    }
    return prisma.relationship.findUnique({
      where: { id },
      include: { sourceFirm: true, targetFirm: true },
    });
  }

  static async create(data: any) {
    return prisma.relationship.create({ data });
  }

  static async update(id: string, organizationId: string, patch: any) {
    const rel = await this.findById(id, organizationId);
    if (!rel) return null;
    return prisma.relationship.update({
      where: { id },
      data: patch,
      include: { sourceFirm: true, targetFirm: true },
    });
  }

  static async delete(id: string, organizationId: string) {
    const rel = await this.findById(id, organizationId);
    if (!rel) return null;
    return prisma.relationship.delete({ where: { id } });
  }

  static async count(organizationId: string, where: any = {}) {
    return prisma.relationship.count({
      where: { ...where, organizationId },
    });
  }

  static async findForFirm(organizationId: string, firmId: string) {
    return prisma.relationship.findMany({
      where: {
        organizationId,
        OR: [{ sourceFirmId: firmId }, { targetFirmId: firmId }],
      },
      include: { sourceFirm: true, targetFirm: true },
    });
  }
}
