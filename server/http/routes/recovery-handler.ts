import { NextResponse } from 'next/server';
import { getCommerceCommands } from '../adapters';
import { buildSessionCookieHeader } from '../sessions/session-manager';
import { resolveShopper } from '../auth/shopper';
import { validateMutationOrigin } from '../security/csrf';
import { parseBoundedJson } from '../security/payload-bounds';
import { recoveryRequestSchema } from '../validation/schemas';
import { handleServerError, HttpError } from '../errors/http-errors';
import type { RecoveryResult, RecoveryCandidate, RecoveryConstraints } from '@/contracts';

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

    const { storeId, unavailableProductId, quantity, explicitConstraints } = parsed.data;
    const adapter = getCommerceCommands();

    // Look up current offers for this store
    const allOffers = await adapter.getProductOffers(storeId);
    const unavailableOffer = allOffers.find((o) => o.productId === unavailableProductId);

    // Build constraints merging explicit constraints with unavailable product attributes
    const constraints: RecoveryConstraints = {
      purpose: explicitConstraints?.purpose ?? unavailableOffer?.purpose ?? 'general',
      maxPricePaise:
        explicitConstraints?.maxPricePaise ??
        (unavailableOffer ? Math.round(unavailableOffer.pricePaise * 1.3) : undefined),
      minPack: explicitConstraints?.minPack ?? unavailableOffer?.pack,
      requiredAttributes: {
        ...(unavailableOffer?.attributes ?? {}),
        ...(explicitConstraints?.requiredAttributes ?? {}),
      },
      preferences: explicitConstraints?.preferences ?? [],
    };

    // Candidates must be from the same store, available > 0, and not the unavailable product itself
    const candidateOffers = allOffers.filter(
      (o) => o.storeId === storeId && o.productId !== unavailableProductId && o.available >= quantity
    );

    const eligibleCandidates: RecoveryCandidate[] = [];

    for (const candidate of candidateOffers) {
      if (candidate.purpose !== constraints.purpose) continue;
      if (constraints.maxPricePaise !== undefined && candidate.pricePaise > constraints.maxPricePaise) continue;
      if (constraints.minPack && (
        candidate.pack.unit !== constraints.minPack.unit || candidate.pack.quantity < constraints.minPack.quantity
      )) continue;
      if (Object.entries(constraints.requiredAttributes ?? {}).some(([key, value]) => candidate.attributes[key] !== value)) continue;

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
      const targetPrice = unavailableOffer?.pricePaise ?? 0;
      const diffA = Math.abs(a.offer.pricePaise - targetPrice);
      const diffB = Math.abs(b.offer.pricePaise - targetPrice);
      if (diffA !== diffB) return diffA - diffB;
      return a.offer.productId.localeCompare(b.offer.productId);
    });

    const topCandidates = eligibleCandidates.slice(0, 3); // Max 3 candidates

    const result: RecoveryResult = {
      mode: 'rules', // No model is called by this standalone deterministic adapter.
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
