import { Request, Response, NextFunction } from "express";
import { GovernanceService } from "../services/governance.service";
import { sendSuccess } from "../utils/response";

export class GovernanceController {
  static async getAuditReport(req: Request, res: Response, next: NextFunction) {
    try {
      const organizationId = (req as any).user!.organizationId;
      const report = await GovernanceService.getAuditReport(organizationId);
      return sendSuccess(res, report);
    } catch (error) {
      next(error);
    }
  }
}
