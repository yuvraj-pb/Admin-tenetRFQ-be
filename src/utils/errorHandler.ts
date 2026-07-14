import { NextFunction, Request, Response } from "express";
import { errorResponse } from "./apiResponse";

export const globalErrorHandler = (
  error: any,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  const status = Number(error?.statusCode) || 500;
  const code = error?.code ?? null;
  const message = error?.message || "Internal server error";
  if (status >= 500) console.error(error);
  errorResponse(res, message, status, code);
};
