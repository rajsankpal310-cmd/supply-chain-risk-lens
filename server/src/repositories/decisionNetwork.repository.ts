import { prisma } from "../config/database";

export class DecisionNetworkRepository {
  static async findLatestRun(organizationId: string) {
    return prisma.decisionRun.findFirst({
      where: { organizationId },
      orderBy: { evaluatedAt: "desc" },
      include: {
        candidateActions: {
          include: {
            reviews: {
              orderBy: { reviewedAt: "desc" },
            },
          },
          orderBy: { score: "desc" },
        },
      },
    });
  }

  static async findRunById(id: string, organizationId: string) {
    return prisma.decisionRun.findFirst({
      where: { id, organizationId },
      include: {
        candidateActions: {
          include: {
            reviews: {
              orderBy: { reviewedAt: "desc" },
            },
          },
          orderBy: { score: "desc" },
        },
      },
    });
  }

  static async createRun(data: {
    organizationId: string;
    algorithmVersion?: string;
    inputSnapshot?: string;
    metricsSummary?: string;
    candidateActions?: any;
  }) {
    return prisma.decisionRun.create({
      data: {
        organizationId: data.organizationId,
        algorithmVersion: data.algorithmVersion || "v1.0-deterministic",
        inputSnapshot: data.inputSnapshot,
        metricsSummary: data.metricsSummary,
        status: "COMPLETED",
        candidateActions: data.candidateActions
          ? {
              create: data.candidateActions,
            }
          : undefined,
      },
      include: {
        candidateActions: {
          include: {
            reviews: {
              orderBy: { reviewedAt: "desc" },
            },
          },
          orderBy: { score: "desc" },
        },
      },
    });
  }

  static async findCandidateActions(organizationId: string, filter: any = {}) {
    return prisma.candidateAction.findMany({
      where: { ...filter, organizationId },
      include: {
        reviews: {
          orderBy: { reviewedAt: "desc" },
        },
      },
      orderBy: { score: "desc" },
    });
  }

  static async findCandidateActionById(id: string, organizationId: string) {
    return prisma.candidateAction.findFirst({
      where: { id, organizationId },
      include: {
        decisionRun: true,
        reviews: {
          orderBy: { reviewedAt: "desc" },
        },
      },
    });
  }

  static async updateCandidateActionStatus(id: string, organizationId: string, status: string) {
    const action = await this.findCandidateActionById(id, organizationId);
    if (!action) return null;
    return prisma.candidateAction.update({
      where: { id },
      data: { status },
      include: {
        reviews: {
          orderBy: { reviewedAt: "desc" },
        },
      },
    });
  }

  static async createReview(data: {
    organizationId: string;
    candidateActionId: string;
    reviewerId: string;
    reviewerName: string;
    decision: string;
    reason?: string;
  }) {
    return prisma.decisionReview.create({
      data,
    });
  }

  static async findReviews(organizationId: string) {
    return prisma.decisionReview.findMany({
      where: { organizationId },
      orderBy: { reviewedAt: "desc" },
      include: {
        candidateAction: true,
      },
    });
  }
}
