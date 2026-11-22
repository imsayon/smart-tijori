import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ACCOUNT_COOKIE, ACCOUNT_MAX_AGE, firebaseAuth, shopperId } from '@server/http/auth/firebase-session';
import { findMerchant } from '@server/http/auth/merchant';
import { handleServerError, HttpError } from '@server/http/errors/http-errors';
import { validateMutationOrigin } from '@server/http/security/csrf';
import { parseBoundedJson } from '@server/http/security/payload-bounds';
import { buildSessionCookieHeader, resolveSession } from '@server/http/sessions/session-manager';
import { getCommerceDatabase } from '@server/db/runtime';

const input = z.object({ token: z.string().min(1).max(8192), bag: z.enum(['guest', 'account']).optional(), merchant: z.boolean().optional() });
const cookie = { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' as const, path: '/' };

export async function POST(request: Request) {
  try {
    validateMutationOrigin(request);
    const parsed = input.safeParse(await parseBoundedJson(request));
    if (!parsed.success) throw new HttpError('VALIDATION_ERROR', 'Invalid sign-in request.');
    const { token, bag, merchant } = parsed.data;
    const auth = firebaseAuth();
    const claims = await auth.verifyIdToken(token, true).catch(() => null);
    if (!claims || !claims.email_verified || Date.now() / 1000 - claims.auth_time > 300) {
      throw new HttpError('FORBIDDEN', 'Verify your email, then sign in again.', 401);
    }
    if (merchant && !await findMerchant(claims.uid)) {
      throw new HttpError('FORBIDDEN', 'This Google account has no active merchant branch. Use the account assigned to your branch.');
    }
    const session = await auth.createSessionCookie(token, { expiresIn: ACCOUNT_MAX_AGE * 1000 });
    const guest = resolveSession(request.headers.get('cookie'));
    if (!merchant && !guest.isNew) {
      const account = shopperId(claims.uid);
      const conflict = await getCommerceDatabase().transact(async client => {
        await client.query('INSERT INTO carts (owner_id) VALUES ($1) ON CONFLICT DO NOTHING', [account]);
        const { rows } = await client.query<{ id: string; owner_id: string; store_id: string | null }>(
          'SELECT id, owner_id, store_id FROM carts WHERE owner_id = ANY($1) ORDER BY owner_id FOR UPDATE',
          [[guest.sessionId, account]],
        );
        const from = rows.find(row => row.owner_id === guest.sessionId);
        const to = rows.find(row => row.owner_id === account)!;
        if (!from?.store_id) return null;
        const lines = await client.query<{ cart_id: string; quantity: number }>(
          'SELECT cart_id, quantity FROM cart_lines WHERE cart_id = ANY($1::uuid[])', [[from.id, to.id]],
        );
        const count = (id: string) => lines.rows.filter(row => row.cart_id === id).reduce((sum, row) => sum + row.quantity, 0);
        if (!count(from.id)) return null;
        const active = await client.query(
          "SELECT 1 FROM reservations WHERE cart_id = ANY($1::uuid[]) AND status = 'ACTIVE' AND expires_at > clock_timestamp()",
          [[from.id, to.id]],
        );
        if (active.rowCount) throw new HttpError('HOLD_NOT_ACTIVE', 'Finish your current reservation before switching bags.');
        if (count(to.id) && !bag) {
          return { guest: { branch: from.store_id, quantity: count(from.id) }, account: { branch: to.store_id, quantity: count(to.id) } };
        }
        if (bag !== 'account') {
          await client.query('DELETE FROM cart_lines WHERE cart_id = $1', [to.id]);
          await client.query('UPDATE carts SET store_id = $2 WHERE id = $1', [to.id, from.store_id]);
          await client.query('UPDATE cart_lines SET cart_id = $2 WHERE cart_id = $1', [from.id, to.id]);
        }
        return null;
      });
      if (conflict) return NextResponse.json({ bags: conflict }, { status: 409 });
    }
    const response = new NextResponse(null, { status: 204 });
    response.cookies.set(ACCOUNT_COOKIE, session, { ...cookie, maxAge: ACCOUNT_MAX_AGE });
    return response;
  } catch (error) {
    return handleServerError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    validateMutationOrigin(request);
    const response = new NextResponse(null, { status: 204 });
    response.cookies.set(ACCOUNT_COOKIE, '', { ...cookie, maxAge: 0 });
    const guest = resolveSession();
    response.headers.append('Set-Cookie', buildSessionCookieHeader(guest.sessionId));
    return response;
  } catch (error) {
    return handleServerError(error);
  }
}
