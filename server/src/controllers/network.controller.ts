import { Request, Response, NextFunction } from "express";
import { NetworkService } from "../services/network.service";
import { sendSuccess } from "../utils/response";

export class NetworkController {
  static async getNetwork(req: Request, res: Response, next: NextFunction) {
    try {
      const organizationId = (req as any).user.organizationId;
      const network = await NetworkService.getNetwork(organizationId);
      return sendSuccess(res, network);
    } catch (error) {
      next(error);
    }
  }
}
