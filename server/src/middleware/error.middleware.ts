import { Request, Response, NextFunction } from "express";
import { sendError } from "../utils/response";

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction) {
  console.error("Unhandled Server Error:", err);
  const status = (err as any).status || 500;
  const message = err.message || "An unexpected error occurred";
  return sendError(res, message, status, "INTERNAL_SERVER_ERROR");
}
