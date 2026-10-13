import { Request, Response, NextFunction } from "express";
import { AuthService } from "../services/auth.service";
import { AuthRequest } from "../types/index";
import { sendSuccess } from "../utils/response";

export class AuthController {
  static async login(req: Request, res: Response, next: NextFunction) {
    try {
      const { email, password } = req.body;
      const result = await AuthService.login(email, password);
      return sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }

  static async register(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await AuthService.register(req.body);
      return sendSuccess(res, result, 201);
    } catch (error) {
      next(error);
    }
  }

  static async me(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const result = await AuthService.getCurrentUser(req.user!.id);
      return sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }

  static async listUsers(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const users = await AuthService.getOrganizationUsers(req.user!.organizationId);
      return sendSuccess(res, users);
    } catch (error) {
      next(error);
    }
  }

  static async createTeamUser(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { fullName, email, password, role } = req.body;
      const user = await AuthService.createTeamUser(
        {
          id: req.user!.id,
          organizationId: req.user!.organizationId,
          companyName: req.user!.companyName,
        },
        { fullName, email, password, role }
      );
      return sendSuccess(res, user, 201);
    } catch (error) {
      next(error);
    }
  }

  static async deleteTeamUser(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const id = String(req.params.id);
      const result = await AuthService.removeTeamUser(req.user!.id, req.user!.organizationId, id);
      return sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }
}
