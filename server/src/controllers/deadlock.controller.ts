import { Request, Response, NextFunction } from "express";
import { DeadlockService } from "../services/deadlock.service";
import { sendSuccess } from "../utils/response";

export class DeadlockController {
  static async getDeadlocks(req: Request, res: Response, next: NextFunction) {
    try {
      const organizationId = (req as any).user.organizationId;
      const deadlocks = await DeadlockService.getDeadlocks(organizationId);
      return sendSuccess(res, deadlocks);
    } catch (error) {
      next(error);
    }
  }

  static async getDeadlockById(req: Request, res: Response, next: NextFunction) {
    try {
      const organizationId = (req as any).user.organizationId;
      const deadlock = await DeadlockService.getDeadlockById(organizationId, String(req.params['id']));
      return sendSuccess(res, deadlock);
    } catch (error) {
      next(error);
    }
  }

  static async resolveDeadlock(req: Request, res: Response, next: NextFunction) {
    try {
      const organizationId = (req as any).user.organizationId;
      const resolved = await DeadlockService.resolveDeadlock(organizationId, String(req.params['id']));
      return sendSuccess(res, resolved);
    } catch (error) {
      next(error);
    }
  }
}
