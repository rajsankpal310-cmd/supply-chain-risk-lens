import { Request, Response, NextFunction } from "express";
import { sendError } from "../utils/response";

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction) {
  const status = (err as any).status || (err as any).statusCode || 500;

  // Intercept Express body-parser entity.too.large (413)
  if ((err as any).type === "entity.too.large" || status === 413 || err.message?.includes("too large")) {
    return res.status(413).json({
      success: false,
      error: {
        code: "PAYLOAD_TOO_LARGE",
        message: "File is too large. Maximum supported size is 100 MB.",
      },
    });
  }

  console.error("Unhandled Server Error:", err);
  const message = err.message || "An unexpected error occurred";
  const code = (err as any).code || (status === 409 ? "CONFLICT" : status === 422 ? "UNPROCESSABLE_ENTITY" : status === 400 ? "BAD_REQUEST" : "INTERNAL_SERVER_ERROR");
  return sendError(res, message, status, code);
}
