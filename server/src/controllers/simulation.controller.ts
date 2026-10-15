import { Request, Response, NextFunction } from "express";
import { SimulationService } from "../services/simulation.service";
import { sendSuccess } from "../utils/response";

export class SimulationController {
  static async getSimulations(req: Request, res: Response, next: NextFunction) {
    try {
      const organizationId = (req as any).user.organizationId;
      const simulations = await SimulationService.getSimulations(organizationId);
      return sendSuccess(res, simulations);
    } catch (error) {
      next(error);
    }
  }

  static async getSimulationById(req: Request, res: Response, next: NextFunction) {
    try {
      const organizationId = (req as any).user.organizationId;
      const simulation = await SimulationService.getSimulationById(organizationId, String(req.params['id']));
      return sendSuccess(res, simulation);
    } catch (error) {
      next(error);
    }
  }

  static async runSimulation(req: Request, res: Response, next: NextFunction) {
    try {
      const organizationId = (req as any).user.organizationId;
      const run = await SimulationService.runSimulation(organizationId, req.body);
      return sendSuccess(res, run, 201);
    } catch (error) {
      next(error);
    }
  }
}
