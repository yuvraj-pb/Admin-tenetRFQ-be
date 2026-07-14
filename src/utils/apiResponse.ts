import { NextFunction, Request, Response } from "express";

/** FE ApiResponse<T> = { success, message, data }. */
export const successResponse = (
  res: Response,
  message: string,
  data: unknown = {},
  status = 200,
) => res.status(status).json({ success: true, message, data });

export const errorResponse = (
  res: Response,
  message: string | undefined,
  status = 400,
  code: string | null = null,
  errors?: Record<string, string>,
) =>
  res.status(status).json({
    success: false,
    message,
    ...(code ? { code } : {}),
    ...(errors ? { errors } : {}),
  });

/**
 * FE PaginatedResponse<T> reads top-level { data, pagination }.
 */
export const paginatedResponse = (
  res: Response,
  message: string,
  rows: unknown[],
  { page, limit, total }: { page: number; limit: number; total: number },
) =>
  res.status(200).json({
    success: true,
    message,
    data: rows,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
      hasNext: page * limit < total,
      hasPrev: page > 1,
    },
  });

/** Wraps an async handler so thrown errors go to the global error handler. */
export const apiCallWrapper =
  (asyncFunction: Function) =>
  (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(asyncFunction(req, res, next)).catch(next);
  };
