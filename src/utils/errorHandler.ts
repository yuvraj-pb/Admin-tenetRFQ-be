import { NextFunction, Request, Response } from "express";
import { errorResponse } from "./apiResponse";

export const globalErrorHandler = (
  error: any,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  const isHttp = Number.isFinite(Number(error?.statusCode));
  const status = isHttp ? Number(error.statusCode) : 500;
  const code = error?.code ?? null;
  if (status >= 500) console.error(error);
  const message =
    status >= 500 && !isHttp
      ? "Internal server error"
      : error?.message || "Internal server error";
  errorResponse(res, message, status, code);
};
