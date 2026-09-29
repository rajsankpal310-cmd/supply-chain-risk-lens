import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "../config/database";
import { env } from "../config/env";
import { UserRepository } from "../repositories/user.repository";
import { AuthenticatedUser } from "../types/index";

export class AuthService {
  static async login(email: string, password: string) {
    const user = await UserRepository.findByEmail(email);

    if (!user) {
      throw { status: 401, message: "Incorrect email or password." };
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      throw { status: 401, message: "Incorrect email or password." };
    }

    const org = (user as any).organization;
    const organizationId = org ? org.id : (user as any).organizationId;
    const organizationName = org ? org.name : user.companyName;

    const authUser: AuthenticatedUser = {
      id: user.id,
      email: user.email,
      role: user.role as any,
      fullName: user.fullName,
      companyName: user.companyName,
      organizationId,
      organizationName,
    };

    const token = jwt.sign(authUser, env.JWT_SECRET, {
      expiresIn: env.JWT_EXPIRES_IN as any,
    });

    const userPayload = {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      companyName: user.companyName,
      industry: user.industry,
      companySize: user.companySize,
      role: user.role,
      avatarInitials: user.avatarInitials,
      organizationId,
      organizationName,
    };

    return { user: userPayload, token };
  }

  static async register(data: {
    fullName: string;
    companyName: string;
    email: string;
    password: string;
    industry?: string;
    companySize?: string;
  }) {
    const existing = await UserRepository.findByEmail(data.email);

    if (existing) {
      throw { status: 400, message: "User with this email already exists." };
    }

    const passwordHash = await bcrypt.hash(data.password, 10);
    const initials = data.fullName
      .split(" ")
      .map((n) => n[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();

    // Create organization for the registering company
    const orgCode = `ORG_${Date.now()}`;
    const organization = await prisma.organization.create({
      data: {
        name: data.companyName,
        code: orgCode,
        status: "ACTIVE",
      },
    });

    const user = await UserRepository.create({
      fullName: data.fullName,
      companyName: data.companyName,
      email: data.email,
      passwordHash,
      industry: data.industry || "Manufacturing",
      companySize: data.companySize || "11-50",
      role: "SME_ADMIN",
      avatarInitials: initials,
      organizationId: organization.id,
    });

    const authUser: AuthenticatedUser = {
      id: user.id,
      email: user.email,
      role: user.role as any,
      fullName: user.fullName,
      companyName: user.companyName,
      organizationId: organization.id,
      organizationName: organization.name,
    };

    const token = jwt.sign(authUser, env.JWT_SECRET, {
      expiresIn: env.JWT_EXPIRES_IN as any,
    });

    const userPayload = {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      companyName: user.companyName,
      industry: user.industry,
      companySize: user.companySize,
      role: user.role,
      avatarInitials: user.avatarInitials,
      organizationId: organization.id,
      organizationName: organization.name,
    };

    return { user: userPayload, token };
  }

  static async getCurrentUser(userId: string) {
    const user = await UserRepository.findById(userId);

    if (!user) {
      throw { status: 404, message: "User not found." };
    }

    const org = (user as any).organization;
    const organizationId = org ? org.id : (user as any).organizationId;
    const organizationName = org ? org.name : user.companyName;

    return {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      companyName: user.companyName,
      industry: user.industry,
      companySize: user.companySize,
      role: user.role,
      avatarInitials: user.avatarInitials,
      organizationId,
      organizationName,
    };
  }
}
