import { Request, Response, NextFunction } from "express";
import { PredictionService } from "../services/prediction.service";
import { sendSuccess } from "../utils/response";

export class PredictionController {
  static async getPredictions(req: Request, res: Response, next: NextFunction) {
    try {
      const organizationId = (req as any).user.organizationId;
      const firmId = req.query['firmId'] as string | undefined;
      const predictions = await PredictionService.getPredictions(organizationId, firmId);
      return sendSuccess(res, predictions);
    } catch (error) {
      next(error);
    }
  }

  static async getPredictionById(req: Request, res: Response, next: NextFunction) {
    try {
      const organizationId = (req as any).user.organizationId;
      const prediction = await PredictionService.getPredictionById(organizationId, String(req.params['id']));
      return sendSuccess(res, prediction);
    } catch (error) {
      next(error);
    }
  }
}
