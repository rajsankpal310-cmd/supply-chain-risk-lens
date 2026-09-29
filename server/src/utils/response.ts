import { Response } from "express";

export function sendSuccess<T>(res: Response, data: T, statusCode = 200) {
  return res.status(statusCode).json({
    success: true,
    data,
  });
}

export function sendPaginated<T>(
  res: Response,
  data: T[],
  page: number,
  limit: number,
  total: number,
  statusCode = 200,
) {
  const totalPages = Math.ceil(total / limit) || 1;
  return res.status(statusCode).json({
    success: true,
    data: {
      items: data,
      total,
      page,
      pageSize: limit,
      totalPages,
    },
    pagination: {
      page,
      limit,
      total,
      totalPages,
    },
  });
}

export function sendError(res: Response, message: string, statusCode = 500, code = "INTERNAL_ERROR") {
  return res.status(statusCode).json({
    success: false,
    error: {
      code,
      message,
    },
  });
}
