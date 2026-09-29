import { Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { AuthRequest, AuthenticatedUser } from "../types/index";
import { sendError } from "../utils/response";

export function authenticate(req: any, res: Response, next: NextFunction) {
  const authHeader = req.headers?.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return sendError(res, "Authentication token missing or invalid", 401, "UNAUTHORIZED");
  }

  const token = authHeader.split(" ")[1];
  if (!token) {
    return sendError(res, "Authentication token missing", 401, "UNAUTHORIZED");
  }

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as AuthenticatedUser;
    if (!decoded || !decoded.organizationId) {
      return sendError(res, "Authentication token missing organization context", 401, "UNAUTHORIZED");
    }
    req.user = decoded;
    next();
  } catch (error) {
    return sendError(res, "Invalid or expired authentication token", 401, "UNAUTHORIZED");
  }
}
