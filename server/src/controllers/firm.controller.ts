import { Request, Response, NextFunction } from "express";
import { FirmService } from "../services/firm.service";
import { sendSuccess } from "../utils/response";

export class FirmController {
  static async getFirms(req: Request, res: Response, next: NextFunction) {
    try {
      const organizationId = (req as any).user.organizationId;
      const firms = await FirmService.getFirms(organizationId, req.query);
      return sendSuccess(res, firms);
    } catch (error) {
      next(error);
    }
  }

  static async getFirmById(req: Request, res: Response, next: NextFunction) {
    try {
      const organizationId = (req as any).user.organizationId;
      const firm = await FirmService.getFirmById(organizationId, String(req.params['id']));
      return sendSuccess(res, firm);
    } catch (error) {
      next(error);
    }
  }

  static async getFirmTransactions(req: Request, res: Response, next: NextFunction) {
    try {
      const organizationId = (req as any).user.organizationId;
      const txns = await FirmService.getFirmTransactions(organizationId, String(req.params['id']));
      return sendSuccess(res, txns);
    } catch (error) {
      next(error);
    }
  }

  static async getFirmRelationships(req: Request, res: Response, next: NextFunction) {
    try {
      const organizationId = (req as any).user.organizationId;
      const rels = await FirmService.getFirmRelationships(organizationId, String(req.params['id']));
      return sendSuccess(res, rels);
    } catch (error) {
      next(error);
    }
  }

  static async createFirm(req: Request, res: Response, next: NextFunction) {
    try {
      const organizationId = (req as any).user.organizationId;
      const firm = await FirmService.createFirm(organizationId, req.body);
      return sendSuccess(res, firm, 201);
    } catch (error) {
      next(error);
    }
  }

  static async updateFirm(req: Request, res: Response, next: NextFunction) {
    try {
      const organizationId = (req as any).user.organizationId;
      const updated = await FirmService.updateFirm(organizationId, String(req.params['id']), req.body);
      return sendSuccess(res, updated);
    } catch (error) {
      next(error);
    }
  }

  static async deleteFirm(req: Request, res: Response, next: NextFunction) {
    try {
      const organizationId = (req as any).user.organizationId;
      const result = await FirmService.deleteFirm(organizationId, String(req.params['id']));
      return sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }
}
