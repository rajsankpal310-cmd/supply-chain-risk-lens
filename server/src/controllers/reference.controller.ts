import { Request, Response, NextFunction } from "express";
import { ReferenceService } from "../services/reference.service";
import { sendSuccess } from "../utils/response";

export class ReferenceController {
  static getSectorBenchmarks(req: Request, res: Response, next: NextFunction) {
    try {
      const benchmarks = ReferenceService.getSectorBenchmarks();
      return sendSuccess(res, benchmarks);
    } catch (error) {
      next(error);
    }
  }
}
