import { NextResponse } from 'next/server';
import type { Client } from '@opensearch-project/opensearch';
import { getCommerceCommands } from '../adapters';
import { resolveSession, buildSessionCookieHeader } from '../sessions/session-manager';
import { validateMutationOrigin } from '../security/csrf';
import { parseBoundedJson } from '../security/payload-bounds';
import { recoveryRequestSchema } from '../validation/schemas';
import { handleServerError, HttpError } from '../errors/http-errors';
import type { RecoveryResult, RecoveryCandidate, RecoveryConstraints, ProductOffer } from '@/contracts';
import type { ProductFactsReader } from '../../../server/contracts/facts';
import { findCandidatesFromShopperQuery, type FindCandidatesOptions } from '../../../ai/retrieval-bridge';
import type { ExplicitShopperConstraints } from '../../../ai/intent-schema';

export async function handlePostRecovery(request: Request): Promise<NextResponse> {
  try {
    validateMutationOrigin(request);
    const session = resolveSession(request.headers.get('cookie'));

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

    const { storeId, unavailableProductId, text, explicitConstraints } = parsed.data;
    const adapter = getCommerceCommands();

    // Look up current offers for this store
    const allOffers = await adapter.getProductOffers(storeId);
    const unavailableOffer = allOffers.find((o) => o.productId === unavailableProductId);

    if (!unavailableOffer) {
      throw new HttpError(
        'NOT_FOUND',
        `Unavailable product '${unavailableProductId}' was not found for store '${storeId}'.`,
        404
      );
    }

    // Normalize offers for discovery/catalog types
    const normalizedOffers = allOffers.map((o) => {
      const untyped = o as unknown as {
        knownAttributes?: Record<string, string | number | boolean | string[]>;
        attributes?: Record<string, string>;
      };
      return {
        ...o,
        knownAttributes: (untyped.knownAttributes ?? untyped.attributes ?? {}) as Record<
          string,
          string | number | boolean | string[]
        >,
        available: typeof o.available === 'boolean' ? o.available : (o.available as unknown as number) > 0,
        availableStock: typeof o.available === 'number' ? o.available : undefined,
      };
    });

    const untypedUnavail = unavailableOffer as unknown as {
      knownAttributes?: Record<string, string | number | boolean | string[]>;
      attributes?: Record<string, string>;
    } | undefined;

    const normalizedUnavailable = unavailableOffer
      ? {
          ...unavailableOffer,
          knownAttributes: (untypedUnavail?.knownAttributes ??
            untypedUnavail?.attributes ??
            {}) as Record<string, string | number | boolean | string[]>,
          available:
            typeof unavailableOffer.available === 'boolean'
              ? unavailableOffer.available
              : (unavailableOffer.available as unknown as number) > 0,
          availableStock:
            typeof unavailableOffer.available === 'number'
              ? unavailableOffer.available
              : undefined,
        }
      : undefined;

    // Reconcile maxPriceMinor and minPackUnits with maxPricePaise and minPack
    let normalizedExplicit = explicitConstraints;
    if (explicitConstraints) {
      const maxPricePaise = explicitConstraints.maxPricePaise ?? explicitConstraints.maxPriceMinor;
      let minPack = explicitConstraints.minPack;
      if (!minPack && explicitConstraints.minPackUnits) {
        if (typeof explicitConstraints.minPackUnits === 'object') {
          minPack = explicitConstraints.minPackUnits;
        } else if (typeof explicitConstraints.minPackUnits === 'number') {
          minPack = {
            quantity: explicitConstraints.minPackUnits,
            unit: (normalizedUnavailable?.pack.unit as 'g' | 'ml' | 'count') ?? 'count',
          };
        }
      }
      normalizedExplicit = {
        purpose: explicitConstraints.purpose,
        maxPricePaise,
        minPack: minPack as { quantity: number; unit: 'g' | 'ml' | 'count' | 'kg' | 'l' } | undefined,
        requiredAttributes: explicitConstraints.requiredAttributes,
        preferences: explicitConstraints.preferences,
      };
    }

    // In test or demo environments where live OpenSearch is not running, provide an adapter-backed client & factsReader
    const client: Client = {
      search: async (params?: unknown) => {
        const searchBody = (params as {
          body?: {
            query?: {
              bool?: {
                must?: Array<{
                  bool?: {
                    should?: Array<{
                      match_phrase?: { name?: { query?: string } };
                    }>;
                  };
                }>;
              };
            };
          };
        })?.body;
        const q = searchBody?.query?.bool?.must?.[0]?.bool?.should?.[0]?.match_phrase?.name?.query?.toLowerCase();

        let filtered = normalizedOffers;
        if (q) {
          filtered = filtered.filter((o) => {
            const combined = `${o.name} ${o.purpose} ${o.category}`.toLowerCase();
            return combined.includes(q) || q.includes(o.purpose.toLowerCase());
          });
        }

        return {
          body: {
            hits: {
              hits: filtered.map((o) => ({
                _id: `${o.storeId}:${o.productId}`,
                _source: {
                  productId: o.productId,
                  storeId: o.storeId,
                  name: o.name,
                  purpose: o.purpose,
                  pricePaise: o.pricePaise,
                  category: o.category,
                  city: o.city,
                },
              })),
            },
          },
        };
      },
    } as unknown as Client;

    const factsReader: ProductFactsReader = {
      readProductFacts: async (sId: string, productIds: string[]) => {
        return normalizedOffers.filter(
          (o) => o.storeId === sId && productIds.includes(o.productId)
        );
      },
    };

    const allowInjectedTransport =
      process.env.NODE_ENV === 'test' || process.env.SMARTTIJORI_DEMO_MODE === 'true';

    const retrievalOptions: FindCandidatesOptions = {
      storeId,
      unavailableProductId,
      unavailableOffer: normalizedUnavailable,
      explicitConstraints: normalizedExplicit as ExplicitShopperConstraints | undefined,
      allowRulesFallback: true,
      ...(allowInjectedTransport ? { client, factsReader } : {}),
    };

    const retrievalResult = await findCandidatesFromShopperQuery(
      text ?? '',
      retrievalOptions
    );

    const toPackInfo = (
      pack?: { quantity: number; unit: string }
    ): RecoveryConstraints['minPack'] => {
      if (!pack) return undefined;
      const u = pack.unit;
      if (u === 'g' || u === 'ml' || u === 'count') {
        return { quantity: pack.quantity, unit: u };
      }
      if (u === 'kg') return { quantity: pack.quantity * 1000, unit: 'g' };
      if (u === 'l') return { quantity: pack.quantity * 1000, unit: 'ml' };
      return undefined;
    };

    const finalMaxPrice =
      retrievalResult.intent.maxPricePaise ??
      normalizedExplicit?.maxPricePaise ??
      (unavailableOffer ? Math.round(unavailableOffer.pricePaise * 1.3) : undefined);

    const finalMinPack =
      toPackInfo(retrievalResult.intent.minPack) ??
      toPackInfo(normalizedExplicit?.minPack) ??
      unavailableOffer?.pack;

    // Build constraints combining intent, explicitConstraints, and unavailableOffer attributes
    const constraints: RecoveryConstraints = {
      purpose:
        retrievalResult.intent.purpose ??
        normalizedExplicit?.purpose ??
        unavailableOffer?.purpose ??
        'general',
      maxPricePaise: finalMaxPrice,
      maxPriceMinor: finalMaxPrice,
      minPack: finalMinPack,
      minPackUnits: finalMinPack,
      requiredAttributes: {
        ...(untypedUnavail?.attributes ?? {}),
        ...(retrievalResult.intent.requiredAttributes ?? {}),
        ...(normalizedExplicit?.requiredAttributes ?? {}),
      },
      preferences:
        retrievalResult.intent.preferences ??
        normalizedExplicit?.preferences ??
        [],
    };

    // Format candidates with comparative reasons and stock facts
    const formattedCandidates: RecoveryCandidate[] = retrievalResult.candidates.map((cand) => {
      const candidateOffer = cand.offer;
      const candUntyped = candidateOffer as unknown as {
        attributes?: Record<string, string>;
        knownAttributes?: Record<string, unknown>;
      };
      const reasons = [...cand.reasons];

      if (unavailableOffer) {
        if (candidateOffer.pricePaise < unavailableOffer.pricePaise) {
          const savings = Math.round((unavailableOffer.pricePaise - candidateOffer.pricePaise) / 100);
          reasons.push(`₹${savings} lower price than original item`);
        } else if (candidateOffer.pricePaise === unavailableOffer.pricePaise) {
          reasons.push('Same price as original item');
        }

        if (
          candidateOffer.pack.unit === unavailableOffer.pack.unit &&
          candidateOffer.pack.quantity === unavailableOffer.pack.quantity
        ) {
          reasons.push(`Identical pack size (${candidateOffer.pack.quantity} ${candidateOffer.pack.unit})`);
        } else if (
          candidateOffer.pack.unit === unavailableOffer.pack.unit &&
          candidateOffer.pack.quantity > unavailableOffer.pack.quantity
        ) {
          reasons.push(`Larger pack size (${candidateOffer.pack.quantity} ${candidateOffer.pack.unit})`);
        }

        const candType = (candUntyped.attributes?.type ??
          candUntyped.knownAttributes?.type) as string | undefined;
        const unavailType = (untypedUnavail?.attributes?.type ??
          untypedUnavail?.knownAttributes?.type) as string | undefined;
        if (candType && unavailType && candType === unavailType) {
          reasons.push(`Matches ${candType} specification`);
        }
      }

      const availableCount =
        typeof candidateOffer.availableStock === 'number'
          ? candidateOffer.availableStock
          : typeof candidateOffer.available === 'number'
          ? (candidateOffer.available as number)
          : candidateOffer.available
          ? 1
          : 0;

      reasons.push(
        `Currently in stock at ${candidateOffer.city} branch (${availableCount} available)`
      );

      const offerForClient = {
        ...candidateOffer,
        category: (candidateOffer.category ?? 'essentials') as ProductOffer['category'],
        pack: candidateOffer.pack as unknown as ProductOffer['pack'],
        attributes: (candUntyped.attributes ??
          (candUntyped.knownAttributes as Record<string, string>) ??
          {}),
        available: availableCount,
      } as unknown as ProductOffer;

      return {
        offer: offerForClient,
        reasons,
      };
    });

    const result: RecoveryResult = {
      mode: retrievalResult.mode,
      constraints,
      candidates: formattedCandidates,
      checkedAt: retrievalResult.checkedAt ?? new Date().toISOString(),
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
