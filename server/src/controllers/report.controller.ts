import { Request, Response, NextFunction } from "express";
import { ReportService } from "../services/report.service";
import { sendSuccess } from "../utils/response";

export class ReportController {
  static async getReports(req: Request, res: Response, next: NextFunction) {
    try {
      const organizationId = (req as any).user.organizationId;
      const reports = await ReportService.getReports(organizationId);
      return sendSuccess(res, reports);
    } catch (error) {
      next(error);
    }
  }

  static async generate(req: Request, res: Response, next: NextFunction) {
    try {
      const organizationId = (req as any).user.organizationId;
      const report = await ReportService.generate(organizationId, String(req.params['id']));
      return sendSuccess(res, report);
    } catch (error) {
      next(error);
    }
  }
}
