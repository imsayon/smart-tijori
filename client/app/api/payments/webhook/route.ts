import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getCommerceDatabase } from '@server/db/runtime';
import { handleServerError, HttpError } from '@server/http/errors/http-errors';
import { createRazorpay, paymentConfig, syncPayment, validSignature } from '@server/payments/razorpay';

const notification = z.object({
  event: z.string(),
  payload: z.object({
    payment: z.object({ entity: z.object({ order_id: z.string().regex(/^order_[A-Za-z0-9]+$/) }) }).optional(),
  }),
});

export async function POST(request: Request) {
  try {
    const config = paymentConfig();
    if (!config || process.env.SMARTTIJORI_DEMO_MODE === 'true') throw new HttpError('DEPENDENCY_UNAVAILABLE', 'Payment service unavailable.');
    const reader = request.body?.getReader();
    if (!reader) throw new HttpError('VALIDATION_ERROR', 'Missing webhook body.');
    const chunks = [];
    let length = 0;
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      length += chunk.value.byteLength;
      if (length > 64 * 1024) {
        await reader.cancel();
        throw new HttpError('VALIDATION_ERROR', 'Webhook body too large.', 413);
      }
      chunks.push(chunk.value);
    }
    const body = Buffer.concat(chunks);
    if (!validSignature(body, request.headers.get('x-razorpay-signature'), config.webhookSecret)) {
      throw new HttpError('FORBIDDEN', 'Invalid webhook signature.');
    }
    const event = notification.safeParse(JSON.parse(body.toString('utf8')));
    if (!event.success) throw new HttpError('VALIDATION_ERROR', 'Invalid webhook payload.');
    if (event.data.event === 'payment.captured' && event.data.payload.payment) {
      const db = getCommerceDatabase();
      const orderId = event.data.payload.payment.entity.order_id;
      const known = await db.transact(client => client.query(
        'SELECT 1 FROM payment_attempts WHERE provider_order_id = $1', [orderId]));
      if (known.rowCount) await syncPayment(db, createRazorpay(config), orderId);
    }
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return handleServerError(error);
  }
}
