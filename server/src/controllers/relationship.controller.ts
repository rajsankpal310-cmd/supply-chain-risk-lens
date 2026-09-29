import { Request, Response, NextFunction } from "express";
import { RelationshipService } from "../services/relationship.service";
import { sendSuccess } from "../utils/response";

export class RelationshipController {
  static async getRelationships(req: Request, res: Response, next: NextFunction) {
    try {
      const organizationId = (req as any).user.organizationId;
      const rels = await RelationshipService.getRelationships(organizationId);
      return sendSuccess(res, rels);
    } catch (error) {
      next(error);
    }
  }

  static async getRelationshipById(req: Request, res: Response, next: NextFunction) {
    try {
      const organizationId = (req as any).user.organizationId;
      const rel = await RelationshipService.getRelationshipById(organizationId, String(req.params['id']));
      return sendSuccess(res, rel);
    } catch (error) {
      next(error);
    }
  }

  static async createRelationship(req: Request, res: Response, next: NextFunction) {
    try {
      const organizationId = (req as any).user.organizationId;
      const created = await RelationshipService.createRelationship(organizationId, req.body);
      return sendSuccess(res, created, 201);
    } catch (error) {
      next(error);
    }
  }

  static async updateRelationship(req: Request, res: Response, next: NextFunction) {
    try {
      const organizationId = (req as any).user.organizationId;
      const updated = await RelationshipService.updateRelationship(organizationId, String(req.params['id']), req.body);
      return sendSuccess(res, updated);
    } catch (error) {
      next(error);
    }
  }

  static async deleteRelationship(req: Request, res: Response, next: NextFunction) {
    try {
      const organizationId = (req as any).user.organizationId;
      const result = await RelationshipService.deleteRelationship(organizationId, String(req.params['id']));
      return sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }
}
