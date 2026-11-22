import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ACCOUNT_COOKIE, ACCOUNT_MAX_AGE, readAccount, shopperId, registerAccount, authenticateAccount, issueAccountSession, revokeAccountSession } from '@server/http/auth/email-session';
import { findMerchant } from '@server/http/auth/merchant';
import { handleServerError, HttpError } from '@server/http/errors/http-errors';
import { validateMutationOrigin } from '@server/http/security/csrf';
import { parseBoundedJson } from '@server/http/security/payload-bounds';
import { buildSessionCookieHeader, resolveSession } from '@server/http/sessions/session-manager';
import { getCommerceDatabase } from '@server/db/runtime';

const input = z.object({ email: z.email().max(254), password: z.string().min(8).max(128), mode: z.enum(['signin','register']).optional(), bag: z.enum(['guest','account']).optional(), merchant: z.boolean().optional() });
const cookie = { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' as const, path: '/' };
const noStore = { 'Cache-Control': 'no-store' };
export async function GET(request: Request) {
  try {
    const user = await readAccount(request.headers.get('cookie'));
    return NextResponse.json(user ? { authenticated: true, email: user.email } : { authenticated: false }, { headers: noStore });
  } catch (error) { return handleServerError(error); }
}

export async function POST(request: Request) {
  try {
    validateMutationOrigin(request);
    const parsed = input.safeParse(await parseBoundedJson(request));
    if (!parsed.success) throw new HttpError('VALIDATION_ERROR', 'Invalid sign-in request.');
    const { email, password, mode, bag, merchant } = parsed.data;
    const claims = mode === 'register' ? await registerAccount(email.toLowerCase(), password) : await authenticateAccount(email.toLowerCase(), password);
    if (merchant && !await findMerchant(claims.uid)) {
      throw new HttpError('FORBIDDEN', 'This account has no active merchant branch.');
    }
    // Issue the session only after all authorization and cart reconciliation checks.
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
          // The shop service role has INSERT and DELETE on cart_lines but not UPDATE.
          // Copy first and remove the guest rows within the same transaction.
          await client.query(
            'INSERT INTO cart_lines (cart_id, product_id, quantity) SELECT $2::uuid, product_id, quantity FROM cart_lines WHERE cart_id = $1::uuid',
            [from.id, to.id],
          );
          await client.query('DELETE FROM cart_lines WHERE cart_id = $1', [from.id]);
        }
        return null;
      });
      if (conflict) return NextResponse.json({ bags: conflict }, { status: 409, headers: noStore });
    }
    const response = new NextResponse(null, { status: 204, headers: noStore });
    response.cookies.set(ACCOUNT_COOKIE, await issueAccountSession(claims.uid), { ...cookie, maxAge: ACCOUNT_MAX_AGE });
    return response;
  } catch (error) {
    return handleServerError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    validateMutationOrigin(request);
    await revokeAccountSession(request.headers.get('cookie'));
    const response = new NextResponse(null, { status: 204, headers: noStore });
    response.cookies.set(ACCOUNT_COOKIE, '', { ...cookie, maxAge: 0 });
    const guest = resolveSession();
    response.headers.append('Set-Cookie', buildSessionCookieHeader(guest.sessionId));
    return response;
  } catch (error) {
    return handleServerError(error);
  }
}
