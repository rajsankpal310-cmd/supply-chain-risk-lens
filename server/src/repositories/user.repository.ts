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

  static async count() {
    return prisma.user.count();
  }
}
