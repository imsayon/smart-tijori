import { NextResponse } from 'next/server';
import { getCommerceCommands } from '../adapters';
import { buildSessionCookieHeader } from '../sessions/session-manager';
import { resolveShopper } from '../auth/shopper';
import { validateMutationOrigin } from '../security/csrf';
import { parseBoundedJson } from '../security/payload-bounds';
import { confirmOrderSchema } from '../validation/schemas';
import { handleServerError, HttpError } from '../errors/http-errors';

export async function handlePostOrders(request: Request): Promise<NextResponse> {
  try {
    validateMutationOrigin(request);
    if (process.env.NODE_ENV !== 'test' && process.env.SMARTTIJORI_DEMO_MODE !== 'true') {
      throw new HttpError('FORBIDDEN', 'Order confirmation requires verified payment.', 403);
    }
    const session = await resolveShopper(request.headers.get('cookie'));

    const operationKey =
      request.headers.get('idempotency-key') ||
      request.headers.get('x-operation-key');

    if (!operationKey || operationKey.trim() === '') {
      throw new HttpError(
        'VALIDATION_ERROR',
        'Idempotency-Key header is required for confirming orders',
        400
      );
    }

    const rawBody = await parseBoundedJson(request);
    const parsed = confirmOrderSchema.safeParse(rawBody);
    if (!parsed.success) {
      throw new HttpError(
        'VALIDATION_ERROR',
        'Invalid order confirmation payload',
        400,
        parsed.error.format()
      );
    }

    const adapter = getCommerceCommands();
    const order = await adapter.confirmOrder(
      session.sessionId,
      parsed.data.reservationId,
      operationKey.trim()
    );

    const response = NextResponse.json(order, { status: 201 });
    if (session.isNew) {
      response.headers.set('Set-Cookie', buildSessionCookieHeader(session.sessionId));
    }
    return response;
  } catch (err) {
    return handleServerError(err);
  }
}

export async function handleGetOrder(
  request: Request,
  orderId: string
): Promise<NextResponse> {
  try {
    const session = await resolveShopper(request.headers.get('cookie'));
    const adapter = getCommerceCommands();
    const order = await adapter.getOrder(session.sessionId, orderId);

    if (!order) {
      throw new HttpError('NOT_FOUND', 'Order not found or not visible to this session', 404);
    }

    const response = NextResponse.json(order);
    if (session.isNew) {
      response.headers.set('Set-Cookie', buildSessionCookieHeader(session.sessionId));
    }
    return response;
  } catch (err) {
    return handleServerError(err);
  }
}
