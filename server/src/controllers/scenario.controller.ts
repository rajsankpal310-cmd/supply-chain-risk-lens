import { Request, Response, NextFunction } from "express";
import { ScenarioService } from "../services/scenario.service";
import { SimulationService } from "../services/simulation.service";
import { sendSuccess } from "../utils/response";

export class ScenarioController {
  static async getScenarios(req: Request, res: Response, next: NextFunction) {
    try {
      const organizationId = (req as any).user.organizationId;
      const scenarios = await ScenarioService.getScenarios(organizationId);
      return sendSuccess(res, scenarios);
    } catch (error) {
      next(error);
    }
  }

  static async getScenarioById(req: Request, res: Response, next: NextFunction) {
    try {
      const organizationId = (req as any).user.organizationId;
      const scenario = await ScenarioService.getScenarioById(organizationId, String(req.params['id']));
      return sendSuccess(res, scenario);
    } catch (error) {
      next(error);
    }
  }

  static async createScenario(req: Request, res: Response, next: NextFunction) {
    try {
      const organizationId = (req as any).user.organizationId;
      const scenario = await ScenarioService.createScenario(organizationId, req.body);
      return sendSuccess(res, scenario, 201);
    } catch (error) {
      next(error);
    }
  }

  static async updateScenario(req: Request, res: Response, next: NextFunction) {
    try {
      const organizationId = (req as any).user.organizationId;
      const scenario = await ScenarioService.updateScenario(organizationId, String(req.params['id']), req.body);
      return sendSuccess(res, scenario);
    } catch (error) {
      next(error);
    }
  }

  static async deleteScenario(req: Request, res: Response, next: NextFunction) {
    try {
      const organizationId = (req as any).user.organizationId;
      const result = await ScenarioService.deleteScenario(organizationId, String(req.params['id']));
      return sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }

  static async runScenario(req: Request, res: Response, next: NextFunction) {
    try {
      const organizationId = (req as any).user.organizationId;
      const run = await SimulationService.runSimulation(organizationId, {
        scenarioId: String(req.params['id']),
        ...req.body,
      });
      return sendSuccess(res, run, 201);
    } catch (error) {
      next(error);
    }
  }
}
