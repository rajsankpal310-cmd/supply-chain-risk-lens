import { Request, Response, NextFunction } from "express";
import { UploadService } from "../services/upload.service";
import { sendError, sendPaginated, sendSuccess } from "../utils/response";

export class UploadController {
  static async inspectSchema(req: Request, res: Response, next: NextFunction) {
    try {
      const { headers, rows, mapping, userOverrides } = req.body;
      const targetRows = rows || [];
      const targetHeaders = headers || (targetRows.length > 0 ? Object.keys(targetRows[0]) : []);
      const overrides = userOverrides || mapping || {};

      if (targetRows.length === 0 && targetHeaders.length === 0) {
        return sendError(res, "No headers or rows provided for schema inspection.", 400, "BAD_REQUEST");
      }

      const result = UploadService.inspectSchema(targetHeaders, targetRows, overrides);
      return sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }

  static async inspect(req: Request, res: Response, next: NextFunction) {
    return UploadController.inspectSchema(req, res, next);
  }

  static async validateDataset(req: Request, res: Response, next: NextFunction) {
    try {
      const organizationId = (req as any).user.organizationId;
      const { rows, transactions, mapping } = req.body;
      const targetRows = rows || transactions;

      if (!targetRows || !Array.isArray(targetRows) || targetRows.length === 0) {
        return sendError(res, "No data rows provided for validation.", 400, "BAD_REQUEST");
      }

      const result = await UploadService.validateDataset(organizationId, targetRows, mapping || {});
      const safeRowResults = result.rowResults.length > 500
        ? result.rowResults.slice(0, 500)
        : result.rowResults;

      return sendSuccess(res, {
        scorecard: result.scorecard,
        rowResults: safeRowResults,
      });
    } catch (error) {
      next(error);
    }
  }

  static async validate(req: Request, res: Response, next: NextFunction) {
    return UploadController.validateDataset(req, res, next);
  }

  static async importTransactions(req: Request, res: Response, next: NextFunction) {
    try {
      const organizationId = (req as any).user.organizationId;
      const userId = (req as any).user?.id || (req as any).user?.email || "system";
      const {
        transactions,
        rows,
        mapping,
        sourceType,
        sourceName,
        sourceOrg,
        sourceUrl,
        datasetVersion,
        license,
        dataGranularity,
        sourceDate,
      } = req.body;

      const rawRows = transactions || rows;
      if (!rawRows || !Array.isArray(rawRows) || rawRows.length === 0) {
        return sendError(
          res,
          "No valid transaction records provided for import. Expected a non-empty 'transactions' or 'rows' array.",
          400,
          "BAD_REQUEST"
        );
      }

      const metadata = {
        sourceType: sourceType || "PRIMARY_TRANSACTION",
        sourceName: sourceName || "Direct CSV Ingestion",
        sourceOrg: sourceOrg || null,
        sourceUrl: sourceUrl || null,
        datasetVersion: datasetVersion || null,
        license: license || null,
        dataGranularity: dataGranularity || "TRANSACTION_LEVEL",
        sourceDate: sourceDate || null,
        importedBy: userId,
        fileSize: req.body?.fileSize || null,
      };

      const result = await UploadService.importTransactions(
        organizationId,
        userId,
        rawRows,
        mapping || {},
        metadata
      );

      return sendSuccess(res, result, 201);
    } catch (error) {
      next(error);
    }
  }

  static async getImportBatches(req: Request, res: Response, next: NextFunction) {
    try {
      const organizationId = (req as any).user.organizationId;
      const page = Number(req.query.page || 1);
      const pageSize = Number(req.query.pageSize || req.query.limit || 20);

      const result = await UploadService.getImportBatches(organizationId, page, pageSize);
      return sendPaginated(res, result.items, result.page, result.pageSize, result.total);
    } catch (error) {
      next(error);
    }
  }

  static async getBatches(req: Request, res: Response, next: NextFunction) {
    return UploadController.getImportBatches(req, res, next);
  }

  static async getImportBatchById(req: Request, res: Response, next: NextFunction) {
    try {
      const organizationId = (req as any).user.organizationId;
      const batchId = String(req.params.id);

      const batch = await UploadService.getImportBatchById(organizationId, batchId);
      return sendSuccess(res, batch);
    } catch (error) {
      next(error);
    }
  }

  static async getBatchById(req: Request, res: Response, next: NextFunction) {
    return UploadController.getImportBatchById(req, res, next);
  }
}
