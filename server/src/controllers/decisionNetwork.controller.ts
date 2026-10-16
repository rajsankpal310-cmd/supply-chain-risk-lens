import { Request, Response, NextFunction } from "express";
import { DecisionEngineService } from "../services/decisionEngine.service";
import { DecisionNetworkRepository } from "../repositories/decisionNetwork.repository";
import { sendSuccess } from "../utils/response";

export class DecisionNetworkController {
  static async getOverview(req: Request, res: Response, next: NextFunction) {
    try {
      const organizationId = (req as any).user.organizationId;
      const overview = await DecisionEngineService.getOverview(organizationId);
      return sendSuccess(res, overview);
    } catch (error) {
      next(error);
    }
  }

  static async getNodeContext(req: Request, res: Response, next: NextFunction) {
    try {
      const organizationId = (req as any).user.organizationId;
      const firmId = String(req.params.firmId);
      const nodeContext = await DecisionEngineService.getNodeDecisionContext(organizationId, firmId);
      return sendSuccess(res, nodeContext);
    } catch (error) {
      next(error);
    }
  }

  static async createRun(req: Request, res: Response, next: NextFunction) {
    try {
      const organizationId = (req as any).user.organizationId;
      const run = await DecisionEngineService.evaluateOrganization(organizationId);
      return sendSuccess(res, run, 201);
    } catch (error) {
      next(error);
    }
  }

  static async getRunById(req: Request, res: Response, next: NextFunction) {
    try {
      const organizationId = (req as any).user.organizationId;
      const runId = String(req.params.runId);
      const run = await DecisionNetworkRepository.findRunById(runId, organizationId);
      if (!run) {
        throw { status: 404, message: "This decision evaluation run is not available in your organization." };
      }
      return sendSuccess(res, run);
    } catch (error) {
      next(error);
    }
  }

  static async simulateRun(req: Request, res: Response, next: NextFunction) {
    try {
      const organizationId = (req as any).user.organizationId;
      const runId = String(req.params.runId);
      const { actionId } = req.body;

      if (!actionId) {
        throw { status: 400, message: "actionId is required in request body to simulate an intervention." };
      }

      const simulation = await DecisionEngineService.simulateAction(organizationId, runId, String(actionId));
      return sendSuccess(res, simulation);
    } catch (error) {
      next(error);
    }
  }

  static async reviewOption(req: Request, res: Response, next: NextFunction) {
    try {
      const user = (req as any).user;
      const organizationId = user.organizationId;
      const optionId = String(req.params.optionId);
      const { decision, reason } = req.body;

      if (!decision) {
        throw { status: 400, message: "decision ('APPROVED', 'REJECTED', 'DEFERRED') is required." };
      }

      const reviewResult = await DecisionEngineService.reviewAction(
        organizationId,
        optionId,
        user,
        decision,
        reason
      );
      return sendSuccess(res, reviewResult);
    } catch (error) {
      next(error);
    }
  }
}
