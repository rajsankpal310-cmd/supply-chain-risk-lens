import { Request, Response, NextFunction } from "express";
import { DashboardService } from "../services/dashboard.service";
import { sendSuccess } from "../utils/response";

export class DashboardController {
  static async getSummary(req: Request, res: Response, next: NextFunction) {
    try {
      const user = (req as any).user;
      const organizationId = user.organizationId;
      const userRole = user.role;
      const summary = await DashboardService.getSummary(organizationId, userRole);
      return sendSuccess(res, summary);
    } catch (error) {
      next(error);
    }
  }
}
