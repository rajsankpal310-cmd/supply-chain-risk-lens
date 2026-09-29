import { Response, NextFunction } from "express";
import { AuthRequest, UserRole } from "../types/index";
import { sendError } from "../utils/response";

export function authorize(...allowedRoles: UserRole[]) {
  return (req: any, res: Response, next: NextFunction) => {
    if (!req.user) {
      return sendError(res, "User not authenticated", 401, "UNAUTHORIZED");
    }

    if (!allowedRoles.includes(req.user.role)) {
      return sendError(
        res,
        `Role ${req.user.role} is not authorized to access this resource`,
        403,
        "FORBIDDEN",
      );
    }

    next();
  };
}
