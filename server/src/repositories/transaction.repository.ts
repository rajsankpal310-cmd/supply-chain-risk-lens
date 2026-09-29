import { prisma } from "../config/database";

export class TransactionRepository {
  static async findMany(
    organizationId: string,
    where: any = {},
    orderBy: any = { invoiceDate: "desc" },
    skip = 0,
    take = 10
  ) {
    return prisma.transaction.findMany({
      where: { ...where, organizationId },
      orderBy,
      skip,
      take,
      include: { buyer: true, sme: true, supplier: true },
    });
  }

  static async count(organizationId: string, where: any = {}) {
    return prisma.transaction.count({
      where: { ...where, organizationId },
    });
  }

  static async findById(id: string, organizationId?: string) {
    if (organizationId) {
      return prisma.transaction.findFirst({
        where: { id, organizationId },
        include: { buyer: true, sme: true, supplier: true },
      });
    }
    return prisma.transaction.findUnique({
      where: { id },
      include: { buyer: true, sme: true, supplier: true },
    });
  }

  static async create(data: any) {
    return prisma.transaction.create({ data });
  }

  static async upsert(id: string, update: any, create: any) {
    return prisma.transaction.upsert({
      where: { id },
      update,
      create,
    });
  }

  static async update(id: string, organizationId: string, patch: any) {
    const txn = await this.findById(id, organizationId);
    if (!txn) return null;
    return prisma.transaction.update({
      where: { id },
      data: patch,
      include: { buyer: true, sme: true, supplier: true },
    });
  }

  static async delete(id: string, organizationId: string) {
    const txn = await this.findById(id, organizationId);
    if (!txn) return null;
    return prisma.transaction.delete({ where: { id } });
  }

  static async findAllForFirm(organizationId: string, firmId: string, limit = 25) {
    return prisma.transaction.findMany({
      where: {
        organizationId,
        OR: [{ smeId: firmId }, { buyerId: firmId }, { supplierId: firmId }],
      },
      take: limit,
      orderBy: { invoiceDate: "desc" },
      include: { buyer: true, sme: true, supplier: true },
    });
  }
}
