import { NextResponse } from 'next/server';
import type { ErrorCode, ApiError } from '@/contracts';

export const HTTP_STATUS_MAP: Record<ErrorCode, number> = {
  VALIDATION_ERROR: 400,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  STOCK_LOCKED_ONLINE: 409,
  ORDER_ALREADY_PLACED: 409,
  STOCK_UNAVAILABLE: 409,
  HOLD_EXPIRED: 409,
  HOLD_NOT_ACTIVE: 409,
  IDEMPOTENCY_CONFLICT: 409,
  DEPENDENCY_UNAVAILABLE: 503,
};

export class HttpError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details?: unknown;

  constructor(code: ErrorCode, message: string, status?: number, details?: unknown) {
    super(message);
    this.name = 'HttpError';
    this.code = code;
    this.status = status ?? HTTP_STATUS_MAP[code] ?? 500;
    this.details = details;
  }
}

export function formatErrorResponse(code: ErrorCode, message: string, details?: unknown): { error: ApiError & { details?: unknown } } {
  return {
    error: {
      code,
      message,
      ...(details !== undefined ? { details } : {}),
    },
  };
}

export function jsonError(
  code: ErrorCode,
  message: string,
  statusOverride?: number,
  details?: unknown,
  headers?: HeadersInit
): NextResponse {
  const status = statusOverride ?? HTTP_STATUS_MAP[code] ?? 500;
  return NextResponse.json(formatErrorResponse(code, message, details), {
    status,
    headers,
  });
}

export function handleServerError(err: unknown): NextResponse {
  if (err && typeof err === 'object' && 'digest' in err && typeof (err as { digest?: string }).digest === 'string' && (err as { digest: string }).digest.startsWith('NEXT_')) {
    throw err;
  }

  if (err instanceof HttpError) {
    return jsonError(err.code, err.message, err.status, err.details);
  }

  // Map genuine infrastructure/dependency failures to HTTP 503
  if (
    (err instanceof Error && err.name === 'DependencyUnavailableError') ||
    (typeof err === 'object' && err !== null && 'code' in err && (err as { code: unknown }).code === 'DEPENDENCY_UNAVAILABLE' && (err as { status?: number }).status === 503)
  ) {
    console.error('[Dependency Unavailable]', { kind: err instanceof Error ? err.name : typeof err });
    return jsonError(
      'DEPENDENCY_UNAVAILABLE',
      'Recovery service temporarily unavailable',
      503
    );
  }

  // Never leak raw database queries, credentials, or internal stack traces to the client
  // Do not log the raw Error: driver messages may contain credentials or SQL text.
  console.error('[Internal Server Error]', { kind: err instanceof Error ? err.name : typeof err });
  return jsonError(
    'DEPENDENCY_UNAVAILABLE',
    'An unexpected service error occurred. Please try again.',
    500
  );
}
