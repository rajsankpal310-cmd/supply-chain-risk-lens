import { Request, Response, NextFunction } from "express";
import { OptimizationService } from "../services/optimization.service";
import { sendSuccess } from "../utils/response";

export class OptimizationController {
  static async runOptimization(req: Request, res: Response, next: NextFunction) {
    try {
      const organizationId = (req as any).user.organizationId;
      const budget = Number(req.body.budget || 1000000);
      const result = await OptimizationService.runOptimization(organizationId, budget);
      return sendSuccess(res, result, 201);
    } catch (error) {
      next(error);
    }
  }

  static async getOptimizationById(req: Request, res: Response, next: NextFunction) {
    try {
      const organizationId = (req as any).user.organizationId;
      const run = await OptimizationService.getOptimizationById(organizationId, String(req.params['id']));
      return sendSuccess(res, run);
    } catch (error) {
      next(error);
    }
  }
}
