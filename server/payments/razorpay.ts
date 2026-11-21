import 'server-only';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import type { Database } from '../db/database.ts';
import { recordCapturedPayment } from '../commerce/commands.ts';

export const checkoutCurrency = 'INR';

const providerOrder = z.object({
  id: z.string().regex(/^order_[A-Za-z0-9]+$/),
  receipt: z.string(),
  amount: z.number().int(),
  currency: z.string(),
});
const providerPayment = z.object({
  id: z.string().regex(/^pay_[A-Za-z0-9]+$/),
  order_id: providerOrder.shape.id,
  amount: z.number().int().positive(),
  currency: z.string(),
  status: z.string(),
  captured: z.boolean(),
});
const providerRefund = z.object({
  id: z.string().regex(/^rfnd_[A-Za-z0-9]+$/),
  status: z.enum(['pending', 'processed', 'failed']),
});

export function paymentConfig() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!keyId || !/^rzp_(test|live)_/.test(keyId) || !keySecret || !webhookSecret) return null;
  if (keyId.startsWith('rzp_live_') && process.env.ST_ENABLE_LIVE_PAYMENTS !== 'true') return null;
  return { keyId, keySecret, webhookSecret };
}

export function validSignature(body: string | Buffer, signature: string | null, secret: string) {
  if (!signature || !/^[a-fA-F0-9]{64}$/.test(signature)) return false;
  return timingSafeEqual(Buffer.from(signature, 'hex'), createHmac('sha256', secret).update(body).digest());
}

export function createRazorpay(config: NonNullable<ReturnType<typeof paymentConfig>>) {
  async function request(path: string, init?: RequestInit) {
    const res = await fetch(`https://api.razorpay.com/v1${path}`, {
      ...init,
      headers: {
        Authorization: 'Basic ' + Buffer.from(`${config.keyId}:${config.keySecret}`).toString('base64'),
        'Content-Type': 'application/json',
        ...init?.headers,
      },
      signal: AbortSignal.timeout(5000),
      cache: 'no-store',
    });
    if (!res.ok) throw new Error(`Payment provider returned HTTP ${res.status}`);
    return res.json() as Promise<unknown>;
  }
  return {
    async order(receipt: string, amount: number) {
      const orders = z.object({ items: z.array(providerOrder) }).parse(
        await request(`/orders?receipt=${encodeURIComponent(receipt)}`));
      const existing = orders.items.find(item => item.receipt === receipt);
      const result = existing ?? providerOrder.parse(await request('/orders', {
        method: 'POST', body: JSON.stringify({ receipt, amount, currency: checkoutCurrency }),
      }));
      if (result.receipt !== receipt || result.amount !== amount || result.currency !== checkoutCurrency) {
        throw new Error('Provider order does not match checkout');
      }
      return result.id;
    },
    async payments(orderId: string) {
      return z.object({ items: z.array(providerPayment) }).parse(
        await request(`/orders/${encodeURIComponent(orderId)}/payments`)).items;
    },
    async refund(paymentId: string, amount: number, refundId: string | null) {
      const path = `/payments/${encodeURIComponent(paymentId)}/refund`;
      return providerRefund.parse(refundId
        ? await request(`${path}s/${encodeURIComponent(refundId)}`)
        : await request(path, {
          method: 'POST',
          headers: { 'X-Refund-Idempotency': `st_${paymentId}` },
          body: JSON.stringify({ amount, speed: 'normal' }),
        }));
    },
  };
}

export async function syncPayment(db: Database, provider: ReturnType<typeof createRazorpay>, orderId: string) {
  const payments = await provider.payments(orderId);
  for (const payment of payments) {
    if (payment.order_id !== orderId || !payment.captured || payment.status === 'refunded') continue;
    await recordCapturedPayment(db, {
      id: payment.id, providerOrderId: orderId, amountPaise: payment.amount, currency: payment.currency,
    });
  }
  const pending = payments.some(payment => payment.status === 'authorized' || payment.status === 'created');
  await db.transact(client => client.query(
    'UPDATE payment_attempts SET last_checked_at = clock_timestamp(), provider_pending = $2 WHERE provider_order_id = $1',
    [orderId, pending],
  ));
}

export async function reconcilePayments(db: Database, config: NonNullable<ReturnType<typeof paymentConfig>>) {
  const provider = createRazorpay(config);
  const { rows } = await db.transact(client => client.query<{ provider_order_id: string }>(`
    WITH due AS (
      SELECT reservation_id FROM payment_attempts
      WHERE provider_order_id IS NOT NULL AND next_check_at <= clock_timestamp()
      ORDER BY next_check_at LIMIT 6 FOR UPDATE SKIP LOCKED
    )
    UPDATE payment_attempts p SET next_check_at = clock_timestamp() +
      CASE WHEN p.created_at > clock_timestamp() - interval '5 minutes' THEN interval '10 seconds'
      WHEN p.created_at > clock_timestamp() - interval '1 day' THEN interval '10 minutes' ELSE interval '1 day' END
    FROM due WHERE p.reservation_id = due.reservation_id RETURNING p.provider_order_id`));
  for (const attempt of rows) {
    await syncPayment(db, provider, attempt.provider_order_id).catch(() => {
      console.error('[payments] Capture reconciliation failed');
    });
  }
  const refunds = await db.transact(client => client.query<{
    provider_payment_id: string; amount_paise: number; refund_id: string | null;
  }>(`SELECT provider_payment_id, amount_paise, refund_id FROM payment_captures
      WHERE refund_status = 'pending' ORDER BY provider_payment_id LIMIT 10`));
  for (const refund of refunds.rows) {
    try {
      const result = await provider.refund(refund.provider_payment_id, refund.amount_paise, refund.refund_id);
      await db.transact(client => client.query(
        "UPDATE payment_captures SET refund_id = $2, refund_status = $3 WHERE provider_payment_id = $1 AND refund_status = 'pending'",
        [refund.provider_payment_id, result.id, result.status],
      ));
    } catch {
      console.error('[payments] Refund reconciliation failed');
    }
  }
}
