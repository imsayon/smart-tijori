import { NextResponse } from 'next/server';
import { z } from 'zod';
import { readAccount, shopperId } from '@server/http/auth/firebase-session';
import { createCommerceCommands } from '@server/commerce/commands';
import { getCommerceDatabase } from '@server/db/runtime';
import { handleServerError, HttpError } from '@server/http/errors/http-errors';
import { validateMutationOrigin } from '@server/http/security/csrf';
import { checkoutCurrency, createRazorpay, paymentConfig } from '@server/payments/razorpay';

async function ownedCheckout(request: Request, id: string) {
  const user = await readAccount(request.headers.get('cookie'));
  if (!user) throw new HttpError('FORBIDDEN', 'Sign in to pay and keep track of your order.', 401);
  const parsed = z.uuid().safeParse(id);
  if (!parsed.success) throw new HttpError('NOT_FOUND', 'Checkout not found.');
  return { db: getCommerceDatabase(), owner: shopperId(user.uid), id: parsed.data.toLowerCase(), email: user.email };
}

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Context) {
  try {
    validateMutationOrigin(request);
    const config = paymentConfig();
    if (!config || process.env.SMARTTIJORI_DEMO_MODE === 'true') {
      throw new HttpError('DEPENDENCY_UNAVAILABLE', 'Online payments are unavailable.');
    }
    const { db, owner, id, email } = await ownedCheckout(request, (await params).id);
    const hold = await createCommerceCommands(db).getHold({ kind: 'shopper', id: owner }, id);
    if (!hold.ok) throw new HttpError(hold.error.code, hold.error.message);
    if (hold.value.status !== 'ACTIVE') throw new HttpError('HOLD_NOT_ACTIVE', 'Start a new reservation before paying.');
    const attempt = await db.transact(async client => {
      // The account cart is the shared lock for checkout attempts from separate tabs.
      await client.query('SELECT id FROM carts WHERE owner_id = $1 FOR UPDATE', [owner]);
      const unresolved = await client.query(`
        SELECT p.reservation_id FROM payment_attempts p JOIN reservations r ON r.id = p.reservation_id
        WHERE p.owner_id = $1 AND p.reservation_id <> $2 AND p.provider_order_id IS NOT NULL
          AND NOT EXISTS (SELECT 1 FROM payment_captures c WHERE c.reservation_id = p.reservation_id)
          AND (p.provider_pending OR p.last_checked_at IS NULL OR p.last_checked_at < r.expires_at + interval '2 minutes')
        LIMIT 1`, [owner, id]);
      if (unresolved.rowCount) throw new HttpError('HOLD_NOT_ACTIVE', 'Check your earlier payment under Orders before paying again.');
      const { rows } = await client.query<{ provider_order_id: string | null; amount_paise: number }>(`
        INSERT INTO payment_attempts AS p (reservation_id, owner_id, amount_paise)
        VALUES ($1, $2, $3) ON CONFLICT (reservation_id) DO UPDATE SET owner_id = p.owner_id
        WHERE p.owner_id = EXCLUDED.owner_id
        RETURNING provider_order_id, amount_paise`, [id, owner, hold.value.totalPaise]);
      if (!rows[0]) throw new HttpError('NOT_FOUND', 'Checkout not found.');
      return rows[0];
    });
    const provider = createRazorpay(config);
    const providerOrderId = attempt.provider_order_id ?? await provider.order(id, attempt.amount_paise);
    const active = await db.transact(async client => {
      const { rows } = await client.query<{ active: boolean }>(`
        UPDATE payment_attempts p SET provider_order_id = $2 FROM reservations r
        WHERE p.reservation_id = $1 AND p.reservation_id = r.id
          AND (p.provider_order_id IS NULL OR p.provider_order_id = $2)
        RETURNING (r.status = 'ACTIVE' AND r.expires_at > clock_timestamp()) AS active`, [id, providerOrderId]);
      return rows[0]?.active;
    });
    if (!active) throw new HttpError('HOLD_NOT_ACTIVE', 'This reservation expired before payment could start.');
    return NextResponse.json({
      providerOrderId, amount: attempt.amount_paise, currency: checkoutCurrency, key: config.keyId, email,
      testMode: config.keyId.startsWith('rzp_test_'),
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return handleServerError(error);
  }
}

export async function GET(request: Request, { params }: Context) {
  try {
    const { db, owner, id } = await ownedCheckout(request, (await params).id);
    const attempt = await db.transact(async client => {
      const { rows } = await client.query<{
        order_id: string | null; refund_status: string | null; active: boolean; can_retry: boolean;
      }>(`SELECT c.order_id, c.refund_status,
        (r.status = 'ACTIVE' AND r.expires_at > clock_timestamp()) AS active,
        (NOT p.provider_pending AND p.last_checked_at >= r.expires_at + interval '2 minutes') AS can_retry
        FROM payment_attempts p
        JOIN reservations r ON r.id = p.reservation_id
        LEFT JOIN payment_captures c ON c.reservation_id = p.reservation_id
        WHERE p.reservation_id = $1 AND p.owner_id = $2
        ORDER BY (c.refund_status = 'pending') DESC NULLS LAST, c.order_id NULLS LAST LIMIT 1`, [id, owner]);
      return rows[0];
    });
    if (!attempt) throw new HttpError('NOT_FOUND', 'Payment attempt not found.');
    return NextResponse.json({
      orderId: attempt.order_id, refundStatus: attempt.refund_status, active: attempt.active, canRetry: Boolean(attempt.can_retry) && !attempt.order_id && !attempt.refund_status,
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return handleServerError(error);
  }
}
