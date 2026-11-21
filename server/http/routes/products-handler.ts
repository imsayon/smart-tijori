import { NextResponse } from 'next/server';
import { getCommerceCommands } from '../adapters';
import { handleServerError, HttpError } from '../errors/http-errors';
import { productFilterSchema } from '../validation/schemas';

export async function handleGetProducts(request: Request): Promise<NextResponse> {
  try {
    const url = new URL(request.url);

    const queryParams: Record<string, string> = {};
    for (const [key, value] of url.searchParams.entries()) {
      queryParams[key] = value;
    }

    const parsed = productFilterSchema.safeParse(queryParams);
    if (!parsed.success) {
      throw new HttpError('VALIDATION_ERROR', 'Invalid query parameters', 400, parsed.error.format());
    }

    const { storeId = 'blr-01', q, category, minPricePaise, maxPricePaise, city } = parsed.data;

    const adapter = getCommerceCommands();
    const items = await adapter.getProductOffers(storeId, {
      q,
      category,
      minPricePaise,
      maxPricePaise,
      city,
    });

    // Max 24 per contract
    const offers = url.searchParams.get('includeUnavailable') === 'false'
      ? items.filter((offer) => offer.available > 0) : items;
    const boundedItems = offers.slice(0, 24);

    return NextResponse.json({ items: boundedItems });
  } catch (err) {
    return handleServerError(err);
  }
}
