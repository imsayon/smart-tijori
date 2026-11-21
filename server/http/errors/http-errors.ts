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

  // Diagnose failures without exposing database queries, credentials, or Error.message.
  // Keep this a strict allowlist: driver messages can contain SQL text and secret values.
  const message = err instanceof Error ? err.message : '';
  const reason = message === 'SESSION_SECRET must contain at least 32 characters.'
    ? 'session_secret_not_configured'
    : message === 'Set an explicit SmartTijori schema starting with st_'
      ? 'commerce_schema_not_configured'
      : err instanceof Error && err.name === 'ServiceConfigurationError'
        ? 'service_configuration_invalid'
        : 'unclassified';
  const rawCode = err && typeof err === 'object' && 'code' in err ? err.code : undefined;
  const sqlState = typeof rawCode === 'string' && /^[0-9A-Z]{5}$/.test(rawCode)
    ? rawCode : undefined;
  console.error('[Internal Server Error]', {
    kind: err instanceof Error ? err.name : typeof err,
    reason,
    ...(sqlState ? { sqlState } : {}),
  });
  return jsonError(
    'DEPENDENCY_UNAVAILABLE',
    'An unexpected service error occurred. Please try again.',
    500
  );
}
