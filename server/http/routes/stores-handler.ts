import { NextResponse } from 'next/server';
import { getCommerceCommands } from '../adapters';
import { resolveSession, buildSessionCookieHeader } from '../sessions/session-manager';
import { handleServerError } from '../errors/http-errors';

export async function handleGetStores(request: Request): Promise<NextResponse> {
  try {
    const session = resolveSession(request.headers.get('cookie'));
    const adapter = getCommerceCommands();
    const stores = await adapter.listStores();

    const response = NextResponse.json({ stores });
    if (session.isNew) {
      response.headers.set('Set-Cookie', buildSessionCookieHeader(session.sessionId));
    }
    return response;
  } catch (err) {
    return handleServerError(err);
  }
}
