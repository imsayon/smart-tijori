import { NextResponse } from 'next/server';
import { getCommerceCommands } from '../adapters';
import { buildSessionCookieHeader } from '../sessions/session-manager';
import { resolveShopper } from '../auth/shopper';
import { validateMutationOrigin } from '../security/csrf';
import { parseBoundedJson } from '../security/payload-bounds';
import { updateCartSchema } from '../validation/schemas';
import { handleServerError, HttpError } from '../errors/http-errors';

export async function handleGetCart(request: Request): Promise<NextResponse> {
  try {
    const session = await resolveShopper(request.headers.get('cookie'));
    const adapter = getCommerceCommands();
    const cart = await adapter.getCart(session.sessionId);

    const response = NextResponse.json(cart);
    if (session.isNew) {
      response.headers.set('Set-Cookie', buildSessionCookieHeader(session.sessionId));
    }
    return response;
  } catch (err) {
    return handleServerError(err);
  }
}

export async function handlePutCart(request: Request): Promise<NextResponse> {
  try {
    validateMutationOrigin(request);
    const session = await resolveShopper(request.headers.get('cookie'));
    const rawBody = await parseBoundedJson(request);

    const parsed = updateCartSchema.safeParse(rawBody);
    if (!parsed.success) {
      throw new HttpError(
        'VALIDATION_ERROR',
        'Invalid cart update payload',
        400,
        parsed.error.format()
      );
    }

    const { storeId, lines } = parsed.data;
    const adapter = getCommerceCommands();
    const updatedCart = await adapter.updateCart(session.sessionId, storeId, lines);

    const response = NextResponse.json(updatedCart);
    if (session.isNew) {
      response.headers.set('Set-Cookie', buildSessionCookieHeader(session.sessionId));
    }
    return response;
  } catch (err) {
    return handleServerError(err);
  }
}
