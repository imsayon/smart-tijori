import { NextResponse } from 'next/server';
import { getCommerceCommands } from '../adapters';
import { requireMerchant } from '../auth/merchant';
import { handleServerError, HttpError, jsonError } from '../errors/http-errors';
import { validateMutationOrigin } from '../security/csrf';
import { parseBoundedJson } from '../security/payload-bounds';
import { posSaleRequestSchema } from '../validation/schemas';

export async function handlePostPosSale(request: Request): Promise<NextResponse> {
  try {
    validateMutationOrigin(request);
    const operator = await requireMerchant(request);
    const key = request.headers.get('idempotency-key')?.trim();
    if (!key) throw new HttpError('VALIDATION_ERROR', 'Idempotency-Key is required.');

    const parsed = posSaleRequestSchema.safeParse(await parseBoundedJson(request));
    if (!parsed.success) throw new HttpError('VALIDATION_ERROR', 'Invalid POS sale payload.');
    if (operator.storeId !== parsed.data.storeId) {
      throw new HttpError('FORBIDDEN', 'Operator is not assigned to this branch.');
    }

    const adapter = getCommerceCommands();
    const result = await adapter.authorizePosSale(
      { kind: 'operator', id: operator.operatorId, storeIds: [operator.storeId] },
      { ...parsed.data, key },
    );
    if (!result.ok) return jsonError(result.error.code, result.error.message, undefined, result.error.productIds);
    return NextResponse.json({ sale: result.value }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return handleServerError(error);
  }
}
