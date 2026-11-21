import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createCommerceCommands } from '@server/commerce/commands';
import { MAX_RESTOCK } from '@server/contracts/commerce';
import { getCommerceDatabase } from '@server/db/runtime';
import { requireMerchant } from '@server/http/auth/merchant';
import { handleServerError, HttpError } from '@server/http/errors/http-errors';
import { validateMutationOrigin } from '@server/http/security/csrf';
import { parseBoundedJson } from '@server/http/security/payload-bounds';

const input = z.object({
  productId: z.string().regex(/^[a-z0-9][a-z0-9-]{0,63}$/),
  quantity: z.number().int().min(1).max(MAX_RESTOCK),
}).strict();

export async function POST(request: Request) {
  try {
    validateMutationOrigin(request);
    const operator = await requireMerchant(request);
    const storeId = operator.storeId;
    if (!storeId) throw new HttpError('FORBIDDEN', 'An active branch membership is required.');
    if (process.env.SMARTTIJORI_DEMO_MODE === 'true') {
      throw new HttpError('DEPENDENCY_UNAVAILABLE', 'Restock requires the live inventory service.');
    }
    const key = request.headers.get('idempotency-key')?.trim();
    const parsed = input.safeParse(await parseBoundedJson(request));
    if (!key || !parsed.success) throw new HttpError('VALIDATION_ERROR', 'Provide a product and a valid restock quantity.');
    const result = await createCommerceCommands(getCommerceDatabase()).restock(
      { kind: 'operator', id: operator.operatorId, storeIds: [storeId] },
      { storeId, ...parsed.data, key },
    );
    if (!result.ok) throw new HttpError(result.error.code, result.error.message);
    return NextResponse.json(result.value, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return handleServerError(error);
  }
}
