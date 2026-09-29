import { Request, Response, NextFunction } from "express";
import { AlertService } from "../services/alert.service";
import { sendSuccess } from "../utils/response";

export class AlertController {
  static async getAlerts(req: Request, res: Response, next: NextFunction) {
    try {
      const organizationId = (req as any).user.organizationId;
      const alerts = await AlertService.getAlerts(organizationId);
      return sendSuccess(res, alerts);
    } catch (error) {
      next(error);
    }
  }

  static async markRead(req: Request, res: Response, next: NextFunction) {
    try {
      const organizationId = (req as any).user.organizationId;
      const read = req.body?.read !== undefined ? Boolean(req.body.read) : true;
      const alert = await AlertService.markRead(organizationId, String(req.params['id']), read);
      return sendSuccess(res, alert);
    } catch (error) {
      next(error);
    }
  }

  static async markAllRead(req: Request, res: Response, next: NextFunction) {
    try {
      const organizationId = (req as any).user.organizationId;
      const alerts = await AlertService.markAllRead(organizationId);
      return sendSuccess(res, alerts);
    } catch (error) {
      next(error);
    }
  }

  static async archive(req: Request, res: Response, next: NextFunction) {
    try {
      const organizationId = (req as any).user.organizationId;
      const alert = await AlertService.archive(organizationId, String(req.params['id']));
      return sendSuccess(res, alert);
    } catch (error) {
      next(error);
    }
  }
}
