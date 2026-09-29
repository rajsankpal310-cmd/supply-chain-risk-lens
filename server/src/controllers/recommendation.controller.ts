import { Request, Response, NextFunction } from "express";
import { RecommendationService } from "../services/recommendation.service";
import { sendSuccess } from "../utils/response";

export class RecommendationController {
  static async getRecommendations(req: Request, res: Response, next: NextFunction) {
    try {
      const organizationId = (req as any).user.organizationId;
      const firmId = req.query['firmId'] as string | undefined;
      const recs = await RecommendationService.getRecommendations(organizationId, firmId);
      return sendSuccess(res, recs);
    } catch (error) {
      next(error);
    }
  }

  static async setStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const organizationId = (req as any).user.organizationId;
      const { status } = req.body;
      const updated = await RecommendationService.setStatus(organizationId, String(req.params['id']), status);
      return sendSuccess(res, updated);
    } catch (error) {
      next(error);
    }
  }
}
