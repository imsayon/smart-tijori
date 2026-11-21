import { NextResponse } from 'next/server';
import { getCommerceCommands } from '../adapters';
import { buildSessionCookieHeader } from '../sessions/session-manager';
import { resolveShopper } from '../auth/shopper';
import { validateMutationOrigin } from '../security/csrf';
import { parseBoundedJson } from '../security/payload-bounds';
import { recoveryRequestSchema } from '../validation/schemas';
import { handleServerError, HttpError } from '../errors/http-errors';
import type { RecoveryResult, RecoveryCandidate, RecoveryConstraints } from '@/contracts';
import { getGeminiAdapter } from '../../../ai/gemini-adapter';
import type { ShopperIntent } from '../../../ai/intent-schema';

function normalizePurpose(input: string): string {
  return input.trim().toLocaleLowerCase('en-IN').replace(/[^a-z0-9]+/g, ' ').trim();
}

function normalizePack(pack?: { quantity: number; unit: string }): RecoveryConstraints['minPack'] {
  if (!pack || !Number.isFinite(pack.quantity) || pack.quantity <= 0) return undefined;
  if (pack.unit === 'kg') return { quantity: pack.quantity * 1000, unit: 'g' };
  if (pack.unit === 'l') return { quantity: pack.quantity * 1000, unit: 'ml' };
  if (pack.unit === 'g' || pack.unit === 'ml' || pack.unit === 'count') return { quantity: pack.quantity, unit: pack.unit };
  return undefined;
}


export async function handlePostRecovery(request: Request): Promise<NextResponse> {
  try {
    validateMutationOrigin(request);
    const session = await resolveShopper(request.headers.get('cookie'));

    const rawBody = await parseBoundedJson(request);
    const parsed = recoveryRequestSchema.safeParse(rawBody);
    if (!parsed.success) {
      throw new HttpError(
        'VALIDATION_ERROR',
        'Invalid recovery request payload',
        400,
        parsed.error.format()
      );
    }

    const { storeId, unavailableProductId, quantity, text, explicitConstraints } = parsed.data;
    const adapter = getCommerceCommands();

    // Look up current offers for this store
    const allOffers = await adapter.getProductOffers(storeId);
    const unavailableOffer = allOffers.find((o) => o.productId === unavailableProductId);

    // Models only extract intent; branch/stock/quantity/purpose stay server-authoritative.
    let extracted: ShopperIntent | null = null;
    if (text?.trim()) {
      const model = getGeminiAdapter();
      if (model.isConfigured()) {
        try {
          extracted = await model.extractIntent(text.trim(), { explicitConstraints });
        } catch {
          // A model failure never prevents deterministic, fact-checked recovery.
        }
      }
    }

    const constraints: RecoveryConstraints = {
      purpose: explicitConstraints?.purpose ?? unavailableOffer?.purpose ?? extracted?.purpose ?? 'general',
      maxPricePaise:
        explicitConstraints?.maxPricePaise ?? extracted?.maxPricePaise ??
        (unavailableOffer ? Math.round(unavailableOffer.pricePaise * 1.3) : undefined),
      minPack: normalizePack(explicitConstraints?.minPack) ?? normalizePack(extracted?.minPack) ?? unavailableOffer?.pack,
      requiredAttributes: {
        ...(extracted?.requiredAttributes ?? {}),
        ...(explicitConstraints?.requiredAttributes ?? {}),
        ...(unavailableOffer?.attributes ?? {}),
      },
      preferences: explicitConstraints?.preferences ?? extracted?.preferences ?? [],
    };

    // Candidate discovery may be stale; PostgreSQL offers are always rechecked before recommendations.
    let indexedIds: Set<string> | null = null;
    if (process.env.ST_CATALOG_SOURCE === 'opensearch') {
      try {
        const { searchProducts } = await import('../../discovery/search-service');
        const result = await searchProducts({
          storeId, q: (unavailableOffer?.purpose ?? constraints.purpose).replaceAll('-', ' '),
          includeUnavailable: true, limit: 24,
        });
        indexedIds = new Set(result.items.map(item => item.productId));
      } catch {
        // A temporarily unavailable search projection cannot loosen stock constraints.
      }
    }

    // Candidates must be from the same store, available in the requested quantity, and distinct.
    const candidateOffers = allOffers.filter(
      (o) => o.storeId === storeId && o.productId !== unavailableProductId && o.available >= quantity
    );

    const eligibleCandidates: RecoveryCandidate[] = [];

    for (const candidate of candidateOffers) {
      if (normalizePurpose(candidate.purpose) !== normalizePurpose(constraints.purpose)) continue;
      if (constraints.maxPricePaise !== undefined && candidate.pricePaise > constraints.maxPricePaise) continue;
      if (constraints.minPack && (
        normalizePack(candidate.pack)?.unit !== constraints.minPack.unit ||
        (normalizePack(candidate.pack)?.quantity ?? 0) < constraints.minPack.quantity
      )) continue;
      if (Object.entries(constraints.requiredAttributes ?? {}).some(([key, value]) => String(candidate.attributes[key] ?? '').toLocaleLowerCase('en-IN') !== String(value).toLocaleLowerCase('en-IN'))) continue;

      // Formulate factual reasons
      const reasons: string[] = [];
      if (unavailableOffer) {
        if (candidate.pricePaise < unavailableOffer.pricePaise) {
          const savings = Math.round((unavailableOffer.pricePaise - candidate.pricePaise) / 100);
          reasons.push(`₹${savings} lower price than original item`);
        } else if (candidate.pricePaise === unavailableOffer.pricePaise) {
          reasons.push('Same price as original item');
        }

        if (
          candidate.pack.unit === unavailableOffer.pack.unit &&
          candidate.pack.quantity === unavailableOffer.pack.quantity
        ) {
          reasons.push(`Identical pack size (${candidate.pack.quantity} ${candidate.pack.unit})`);
        } else if (
          candidate.pack.unit === unavailableOffer.pack.unit &&
          candidate.pack.quantity > unavailableOffer.pack.quantity
        ) {
          reasons.push(`Larger pack size (${candidate.pack.quantity} ${candidate.pack.unit})`);
        }

        if (candidate.attributes.type && unavailableOffer.attributes.type === candidate.attributes.type) {
          reasons.push(`Matches ${candidate.attributes.type} specification`);
        }
      }

      reasons.push(`Currently in stock at ${candidate.city} branch (${candidate.available} available)`);

      eligibleCandidates.push({
        offer: candidate,
        reasons,
      });
    }

    // Rank deterministically: sort by absolute price difference from unavailable item, then by productId
    eligibleCandidates.sort((a, b) => {
      const searchA = indexedIds?.has(a.offer.productId) ? 1 : 0;
      const searchB = indexedIds?.has(b.offer.productId) ? 1 : 0;
      if (searchA !== searchB) return searchB - searchA;
      const targetPrice = unavailableOffer?.pricePaise ?? 0;
      const diffA = Math.abs(a.offer.pricePaise - targetPrice);
      const diffB = Math.abs(b.offer.pricePaise - targetPrice);
      if (diffA !== diffB) return diffA - diffB;
      return a.offer.productId.localeCompare(b.offer.productId);
    });

    const topCandidates = eligibleCandidates.slice(0, 3); // Max 3 candidates

    const result: RecoveryResult = {
      mode: extracted ? 'ai' : 'rules',
      constraints,
      ...(unavailableOffer ? { unavailableOffer } : {}),
      candidates: topCandidates,
      checkedAt: new Date().toISOString(),
    };

    const response = NextResponse.json(result);
    if (session.isNew) {
      response.headers.set('Set-Cookie', buildSessionCookieHeader(session.sessionId));
    }
    return response;
  } catch (err) {
    return handleServerError(err);
  }
}
