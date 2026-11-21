import { NextResponse } from 'next/server';
import { getCommerceCommands } from '../adapters';
import { resolveSession, buildSessionCookieHeader } from '../sessions/session-manager';
import { validateMutationOrigin } from '../security/csrf';
import { parseBoundedJson } from '../security/payload-bounds';
import { createHoldSchema } from '../validation/schemas';
import { handleServerError, HttpError, jsonError } from '../errors/http-errors';

export async function handlePostReservations(request: Request): Promise<NextResponse> {
  try {
    validateMutationOrigin(request);
    const session = resolveSession(request.headers.get('cookie'));

    const operationKey =
      request.headers.get('idempotency-key') ||
      request.headers.get('x-operation-key');

    if (!operationKey || operationKey.trim() === '') {
      throw new HttpError(
        'VALIDATION_ERROR',
        'Idempotency-Key header is required for reservations',
        400
      );
    }

    const rawBody = await parseBoundedJson(request);
    const parsed = createHoldSchema.safeParse(rawBody);
    if (!parsed.success) {
      throw new HttpError(
        'VALIDATION_ERROR',
        'Invalid reservation payload',
        400,
        parsed.error.format()
      );
    }

    const adapter = getCommerceCommands();
    const result = await adapter.createHold(
      session.sessionId,
      parsed.data.cartId,
      operationKey.trim()
    );

    if (!result.ok) {
      return jsonError(
        'STOCK_UNAVAILABLE',
        'One or more items in your cart are no longer available in the requested quantity.',
        409,
        { unavailableProducts: result.unavailableProducts }
      );
    }

    const response = NextResponse.json(result.hold, { status: 201 });
    if (session.isNew) {
      response.headers.set('Set-Cookie', buildSessionCookieHeader(session.sessionId));
    }
    return response;
  } catch (err) {
    return handleServerError(err);
  }
}

export async function handleGetReservation(
  request: Request,
  holdId: string
): Promise<NextResponse> {
  try {
    const session = resolveSession(request.headers.get('cookie'));
    const adapter = getCommerceCommands();
    const hold = await adapter.getHold(session.sessionId, holdId);

    if (!hold) {
      throw new HttpError('NOT_FOUND', 'Reservation not found or not visible to this session', 404);
    }

    const response = NextResponse.json(hold);
    if (session.isNew) {
      response.headers.set('Set-Cookie', buildSessionCookieHeader(session.sessionId));
    }
    return response;
  } catch (err) {
    return handleServerError(err);
  }
}

export async function handleDeleteReservation(
  request: Request,
  holdId: string
): Promise<NextResponse> {
  try {
    validateMutationOrigin(request);
    const session = resolveSession(request.headers.get('cookie'));
    const adapter = getCommerceCommands();
    const hold = await adapter.releaseHold(session.sessionId, holdId);

    if (!hold) {
      throw new HttpError('NOT_FOUND', 'Reservation not found or not visible to this session', 404);
    }

    const response = NextResponse.json(hold);
    if (session.isNew) {
      response.headers.set('Set-Cookie', buildSessionCookieHeader(session.sessionId));
    }
    return response;
  } catch (err) {
    return handleServerError(err);
  }
}
