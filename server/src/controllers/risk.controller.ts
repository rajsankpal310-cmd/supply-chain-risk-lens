import { Request, Response, NextFunction } from "express";
import { RiskService } from "../services/risk.service";
import { sendSuccess } from "../utils/response";

export class RiskController {
  static async getOverview(req: Request, res: Response, next: NextFunction) {
    try {
      const organizationId = (req as any).user.organizationId;
      const overview = await RiskService.getOverview(organizationId);
      return sendSuccess(res, overview);
    } catch (error) {
      next(error);
    }
  }

  static async getFirmRisk(req: Request, res: Response, next: NextFunction) {
    try {
      const organizationId = (req as any).user.organizationId;
      const risk = await RiskService.getFirmRisk(organizationId, String(req.params['id']));
      return sendSuccess(res, risk);
    } catch (error) {
      next(error);
    }
  }
}
