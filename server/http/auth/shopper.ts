import { HttpError } from '../errors/http-errors';
import { ACCOUNT_COOKIE, readAccount, shopperId } from './email-session';
import { parseCookies, resolveSession } from '../sessions/session-manager';

export async function resolveShopper(cookie?: string | null) {
  if (cookie && parseCookies(cookie)[ACCOUNT_COOKIE]) {
    const user = await readAccount(cookie);
    if (!user) throw new HttpError('FORBIDDEN', 'Please sign in again.', 401);
    return { sessionId: shopperId(user.uid), isNew: false };
  }
  return resolveSession(cookie);
}
