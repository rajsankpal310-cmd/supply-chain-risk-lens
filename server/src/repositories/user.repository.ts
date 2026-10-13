import { prisma } from "../config/database";

export class UserRepository {
  static async findByEmail(email: string) {
    return prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
      include: { organization: true },
    });
  }

  static async findById(id: string) {
    return prisma.user.findUnique({
      where: { id },
      include: { organization: true },
    });
  }

  static async create(data: {
    fullName: string;
    email: string;
    passwordHash: string;
    companyName: string;
    industry: string;
    companySize: string;
    role: string;
    avatarInitials: string;
    organizationId: string;
  }) {
    return prisma.user.create({
      data: {
        ...data,
        email: data.email.trim().toLowerCase(),
      },
      include: { organization: true },
    });
  }

  static async findByOrganization(organizationId: string) {
    return prisma.user.findMany({
      where: { organizationId },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        fullName: true,
        email: true,
        companyName: true,
        role: true,
        avatarInitials: true,
        isActive: true,
        createdAt: true,
      },
    });
  }

  static async deleteByIdAndOrg(id: string, organizationId: string) {
    return prisma.user.deleteMany({
      where: { id, organizationId },
    });
  }

  static async count() {
    return prisma.user.count();
  }
}
