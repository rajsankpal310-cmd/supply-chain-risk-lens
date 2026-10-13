import { Request, Response, NextFunction } from "express";

export const MAX_UPLOAD_BYTES = 100 * 1024 * 1024; // 100 MB = 104,857,600 bytes
export const MAX_HTTP_PAYLOAD_BYTES = 250 * 1024 * 1024; // 250 MB for serialized JSON representations of 100 MB files
export const UPLOAD_SIZE_ERROR_MESSAGE = "File is too large. Maximum supported size is 100 MB.";

/**
 * Validates that incoming upload requests do not exceed the 100 MB threshold.
 * Checks both Content-Length HTTP header (for early rejection) and body file size metadata.
 */
export function validateUploadLimit(req: Request, res: Response, next: NextFunction) {
  const contentLength = req.headers["content-length"];
  if (contentLength && Number(contentLength) > MAX_HTTP_PAYLOAD_BYTES) {
    return res.status(413).json({
      success: false,
      error: {
        code: "PAYLOAD_TOO_LARGE",
        message: UPLOAD_SIZE_ERROR_MESSAGE,
      },
    });
  }

  // Also validate declared file size metadata if passed in JSON body
  const declaredSize =
    req.body?.fileSize ??
    req.body?.size ??
    req.body?.metadata?.fileSize ??
    req.body?.rawFileSize;

  if (declaredSize !== undefined && Number(declaredSize) > MAX_UPLOAD_BYTES) {
    return res.status(413).json({
      success: false,
      error: {
        code: "PAYLOAD_TOO_LARGE",
        message: UPLOAD_SIZE_ERROR_MESSAGE,
      },
    });
  }

  next();
}
