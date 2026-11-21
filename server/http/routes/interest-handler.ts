import { NextResponse } from 'next/server';
import { getCommerceCommands } from '../adapters';
import { buildSessionCookieHeader } from '../sessions/session-manager';
import { resolveShopper } from '../auth/shopper';
import { validateMutationOrigin } from '../security/csrf';
import { parseBoundedJson } from '../security/payload-bounds';
import { saveInterestSchema } from '../validation/schemas';
import { handleServerError, HttpError } from '../errors/http-errors';

export async function handlePostInterest(request: Request): Promise<NextResponse> {
  try {
    validateMutationOrigin(request);
    const session = await resolveShopper(request.headers.get('cookie'));

    const rawBody = await parseBoundedJson(request);
    const parsed = saveInterestSchema.safeParse(rawBody);
    if (!parsed.success) {
      throw new HttpError(
        'VALIDATION_ERROR',
        'Invalid stock interest payload',
        400,
        parsed.error.format()
      );
    }

    const adapter = getCommerceCommands();
    await adapter.saveInterest(
      session.sessionId,
      parsed.data.storeId,
      parsed.data.productId
    );

    const response = NextResponse.json({ saved: true }, { status: 201 });
    if (session.isNew) {
      response.headers.set('Set-Cookie', buildSessionCookieHeader(session.sessionId));
    }
    return response;
  } catch (err) {
    return handleServerError(err);
  }
}
