import { Request, Response, NextFunction } from "express";
import { TransactionService } from "../services/transaction.service";
import { sendPaginated, sendSuccess } from "../utils/response";

export class TransactionController {
  static async getTransactions(req: Request, res: Response, next: NextFunction) {
    try {
      const organizationId = (req as any).user.organizationId;
      const query = {
        search: (req.query['search'] as string) || req.body?.search,
        status: (req.query['status'] as string) || req.body?.status,
        risk: (req.query['risk'] as string) || req.body?.risk,
        buyerId: (req.query['buyerId'] as string) || req.body?.buyerId,
        supplierId: (req.query['supplierId'] as string) || req.body?.supplierId,
        from: (req.query['from'] as string) || req.body?.from,
        to: (req.query['to'] as string) || req.body?.to,
        sortBy: (req.query['sortBy'] as string) || req.body?.sortBy || "invoiceDate",
        sortDir: ((req.query['sortOrder'] as any) || (req.query['sortDir'] as any) || req.body?.sortOrder || req.body?.sortDir || "desc") as "asc" | "desc",
        page: Number(req.query['page'] || req.body?.page || 1),
        pageSize: Number(req.query['pageSize'] || req.query['limit'] || req.body?.pageSize || 10),
      };

      const result = await TransactionService.getTransactions(organizationId, query);
      return sendPaginated(res, result.items, result.page, result.pageSize, result.total);
    } catch (error) {
      next(error);
    }
  }

  static async getTransactionById(req: Request, res: Response, next: NextFunction) {
    try {
      const organizationId = (req as any).user.organizationId;
      const transaction = await TransactionService.getTransactionById(organizationId, String(req.params['id']));
      return sendSuccess(res, transaction);
    } catch (error) {
      next(error);
    }
  }

  static async getRelatedTransactions(req: Request, res: Response, next: NextFunction) {
    try {
      const organizationId = (req as any).user.organizationId;
      const related = await TransactionService.getRelatedTransactions(organizationId, String(req.params['id']));
      return sendSuccess(res, related);
    } catch (error) {
      next(error);
    }
  }

  static async createTransaction(req: Request, res: Response, next: NextFunction) {
    try {
      const organizationId = (req as any).user.organizationId;
      const created = await TransactionService.createTransaction(organizationId, req.body);
      return sendSuccess(res, created, 201);
    } catch (error) {
      next(error);
    }
  }

  static async updateTransaction(req: Request, res: Response, next: NextFunction) {
    try {
      const organizationId = (req as any).user.organizationId;
      const updated = await TransactionService.updateTransaction(organizationId, String(req.params['id']), req.body);
      return sendSuccess(res, updated);
    } catch (error) {
      next(error);
    }
  }

  static async deleteTransaction(req: Request, res: Response, next: NextFunction) {
    try {
      const organizationId = (req as any).user.organizationId;
      const result = await TransactionService.deleteTransaction(organizationId, String(req.params['id']));
      return sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }
}
