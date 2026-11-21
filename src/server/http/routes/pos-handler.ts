import { NextResponse } from 'next/server';
import { getCommerceCommands } from '../adapters';
import { verifyOperatorSession } from '../auth/operator-guard';
import { validateMutationOrigin } from '../security/csrf';
import { parseBoundedJson } from '../security/payload-bounds';
import { posSaleRequestSchema } from '../validation/schemas';
import { handleServerError, HttpError, jsonError } from '../errors/http-errors';

/**
 * POST /api/pos/sale
 *
 * Dedicated participating-POS barcode sale authorization endpoint.
 *
 * Security & Boundary Rules:
 * 1. Must verify operator session via st_ops_session cookie or Bearer token.
 * 2. Operator identity is derived strictly from the verified session, NEVER from the request body.
 * 3. Enforces CSRF mutation origin check and 32KB JSON payload bound.
 * 4. Requires Idempotency-Key header to prevent duplicate stock debits on POS scanner retries.
 * 5. Calls adapter.authorizePosSale() — does NOT implement stock allocation inside this route.
 * 6. Maps authoritative conflicts into clear, actionable cashier feedback.
 */
export async function handlePostPosSale(request: Request): Promise<NextResponse> {
  try {
    // 1. Origin / CSRF check
    validateMutationOrigin(request);

    // 2. Authenticate operator session (role: store_operator)
    const operator = verifyOperatorSession(request);

    // 3. Idempotency Key validation
    const operationKey =
      request.headers.get('idempotency-key') ||
      request.headers.get('x-operation-key');

    if (!operationKey || operationKey.trim() === '') {
      throw new HttpError(
        'VALIDATION_ERROR',
        'Idempotency-Key header is required for POS sale authorization',
        400
      );
    }

    // 4. Bounded body & schema validation
    const rawBody = await parseBoundedJson(request);
    const parsed = posSaleRequestSchema.safeParse(rawBody);
    if (!parsed.success) {
      throw new HttpError(
        'VALIDATION_ERROR',
        'Invalid POS sale payload',
        400,
        parsed.error.format()
      );
    }

    // 5. Operator-to-Store authorization enforcement
    // An operator assigned to a store cannot authorize sales for a different store.
    // If operator has no store assignment, reject cross-store actions (unrestricted access denied).
    if (!operator.storeId) {
      throw new HttpError(
        'FORBIDDEN',
        'Operator has no assigned store and cannot authorize POS sales',
        403
      );
    }

    if (operator.storeId !== parsed.data.storeId) {
      throw new HttpError(
        'FORBIDDEN',
        `Operator assigned to store '${operator.storeId}' is not authorized to execute sales for store '${parsed.data.storeId}'`,
        403
      );
    }

    // 6. Invoke authoritative commerce command (Sayon's PostgreSQL in prod, Fixture in tests)
    // Server-side operator identity injection (ignoring any client-supplied operatorId)
    const adapter = getCommerceCommands();
    const outcome = await adapter.authorizePosSale({
      storeId: parsed.data.storeId,
      barcode: parsed.data.barcode.trim(),
      quantity: parsed.data.quantity,
      operatorId: operator.operatorId,
      operationKey: operationKey.trim(),
    });

    // 7. Handle authoritative outcome
    if (!outcome.ok) {
      // Map domain error code to appropriate HTTP status and message
      const status =
        outcome.code === 'IDEMPOTENCY_CONFLICT'
          ? 409
          : outcome.code === 'STOCK_LOCKED_ONLINE'
          ? 409
          : outcome.code === 'STOCK_UNAVAILABLE'
          ? 409
          : outcome.code === 'BARCODE_UNKNOWN'
          ? 404
          : 400;

      return jsonError(outcome.code, outcome.message, status, outcome.details);
    }

    // 7. Successful sale confirmation
    return NextResponse.json(
      {
        sale: outcome,
      },
      {
        status: 200,
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
        },
      }
    );
  } catch (error) {
    return handleServerError(error);
  }
}
