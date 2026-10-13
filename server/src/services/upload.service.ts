import { prisma } from "../config/database";
import { PipelineOrchestrator } from "../pipeline/pipelineOrchestrator";
import { ProvenanceMetadata } from "../pipeline/sourceClassifier";

export class UploadService {
  static inspect(headers: string[], rows: Record<string, any>[], userOverrides: Record<string, string> = {}) {
    return PipelineOrchestrator.inspect(headers, rows, userOverrides);
  }

  static inspectSchema(headers: string[], rows: Record<string, any>[], userOverrides: Record<string, string> = {}) {
    return PipelineOrchestrator.inspect(headers, rows, userOverrides);
  }

  static async validate(
    organizationId: string,
    rows: Record<string, any>[],
    mapping: Record<string, string> = {}
  ) {
    return PipelineOrchestrator.validate(organizationId, rows, mapping);
  }

  static async validateDataset(
    organizationId: string,
    rows: Record<string, any>[],
    mapping: Record<string, string> = {}
  ) {
    return PipelineOrchestrator.validate(organizationId, rows, mapping);
  }

  static async importTransactions(
    organizationId: string,
    arg2: any,
    arg3?: any,
    arg4?: any,
    arg5?: any
  ) {
    let userId = "system";
    let rows: Record<string, any>[] = [];
    let mapping: Record<string, string> = {};
    let metadata: ProvenanceMetadata | undefined;

    if (typeof arg2 === "string") {
      userId = arg2;
      rows = arg3 || [];
      mapping = arg4 || {};
      metadata = arg5;
    } else {
      rows = arg2 || [];
      metadata = arg3;
      mapping = arg4 || {};
      userId = arg5 || "system";
    }

    const result = await PipelineOrchestrator.executeImport(
      organizationId,
      userId,
      rows,
      mapping,
      metadata
    );

    return {
      imported: result.imported,
      batchId: result.batchId,
      rejected: result.rejected,
      duplicates: result.duplicates,
      qualityScore: result.qualityScore,
      qualityGrade: result.qualityGrade,
      scorecard: result.scorecard,
      errors: result.scorecard.rejectionReasons,
    };
  }

  static async getBatches(organizationId: string, page = 1, pageSize = 20) {
    const skip = (page - 1) * pageSize;
    const [batches, total] = await Promise.all([
      prisma.importBatch.findMany({
        where: { organizationId },
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize,
      }),
      prisma.importBatch.count({ where: { organizationId } }),
    ]);

    return {
      items: batches,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  static async getImportBatches(organizationId: string, page = 1, pageSize = 20) {
    return this.getBatches(organizationId, page, pageSize);
  }

  static async getBatchById(organizationId: string, id: string) {
    const batch = await prisma.importBatch.findFirst({
      where: { id, organizationId },
      include: {
        transactions: {
          take: 20,
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!batch) {
      throw { status: 404, message: "This resource is not available in your organization." };
    }

    return batch;
  }

  static async getImportBatchById(organizationId: string, id: string) {
    return this.getBatchById(organizationId, id);
  }
}
