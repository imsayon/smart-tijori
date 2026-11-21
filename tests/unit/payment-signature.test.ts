import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { validSignature } from '@server/payments/razorpay';

describe('payment webhook signature', () => {
  it('authenticates the exact raw body', () => {
    const body = Buffer.from('{"event":"payment.captured"}');
    const secret = 'local-signature-test';
    const signature = createHmac('sha256', secret).update(body).digest('hex');
    expect(validSignature(body, signature, secret)).toBe(true);
    expect(validSignature(Buffer.concat([body, Buffer.from(' ')]), signature, secret)).toBe(false);
    expect(validSignature(body, 'not-a-signature', secret)).toBe(false);
  });
});
