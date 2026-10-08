import type { NextFunction, Request, Response } from "express";
import type { ApiErrorCode } from "@mtm/shared";

export class AppError extends Error {
  readonly status: number;
  readonly code: ApiErrorCode;

  constructor(status: number, code: ApiErrorCode, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function notFound(message = "Task not found"): AppError {
  return new AppError(404, "NOT_FOUND", message);
}

export function validationError(message: string): AppError {
  return new AppError(400, "VALIDATION_ERROR", message);
}

export function invalidActor(): AppError {
  return new AppError(400, "INVALID_ACTOR", "Actor is not in the predefined list");
}

export function invalidTransition(from: string, to: string): AppError {
  return new AppError(
    409,
    "INVALID_TRANSITION",
    `Cannot change status from ${from} to ${to}`,
  );
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof AppError) {
    res.status(err.status).json({ error: { code: err.code, message: err.message } });
    return;
  }
  console.error(err);
  res.status(500).json({
    error: { code: "INTERNAL_ERROR", message: "Unexpected server error" },
  });
}
