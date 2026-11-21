import type { ProductOffer } from "../server/contracts/catalog";
import type { ShopperIntent } from "./intent-schema";
import { type HardConstraintEvaluation, arePurposesCompatible } from "./hard-constraints";

export interface CandidateWithEvaluation {
  offer: ProductOffer;
  evaluation: HardConstraintEvaluation;
}

export interface CandidateRecommendation {
  offer: ProductOffer;
  score: number;
  reasons: string[];
}

function checkPreferenceMatch(offer: ProductOffer, preference: string): boolean {
  const target = preference.trim().toLowerCase();
  if (!target) return false;

  const searchableTexts: string[] = [
    offer.name,
    offer.description ?? "",
    offer.purpose,
    offer.category,
  ];

  if (offer.knownAttributes) {
    for (const val of Object.values(offer.knownAttributes)) {
      if (typeof val === "string" || typeof val === "number" || typeof val === "boolean") {
        searchableTexts.push(String(val));
      } else if (Array.isArray(val)) {
        searchableTexts.push(...val.map(String));
      }
    }
  }

  const combined = searchableTexts.join(" ").toLowerCase();
  return combined.includes(target);
}

export const MAX_RECOMMENDATIONS = 3;

export function rankEligibleCandidates(
  candidates: CandidateWithEvaluation[],
  intent: ShopperIntent,
  limit = MAX_RECOMMENDATIONS
): CandidateRecommendation[] {
  const effectiveLimit =
    typeof limit === "number" && !Number.isNaN(limit)
      ? Math.max(0, Math.min(MAX_RECOMMENDATIONS, Math.floor(limit)))
      : MAX_RECOMMENDATIONS;

  if (!Array.isArray(candidates) || candidates.length === 0 || effectiveLimit === 0) {
    return [];
  }

  // 1. Strict filter: hard constraints MUST be satisfied
  const eligibleCandidates = candidates.filter((c) => c.evaluation.eligible);

  // 2. Deduplicate candidates by productId (keep the first occurrence)
  const seenProductIds = new Set<string>();
  const uniqueCandidates: CandidateWithEvaluation[] = [];

  for (const candidate of eligibleCandidates) {
    if (!seenProductIds.has(candidate.offer.productId)) {
      seenProductIds.add(candidate.offer.productId);
      uniqueCandidates.push(candidate);
    }
  }

  // 3. Score each candidate deterministically
  const scored: CandidateRecommendation[] = uniqueCandidates.map((c) => {
    let score = 100; // Base eligibility score
    const reasons = [...c.evaluation.verifiedReasons];

    // Signal A: Purpose match
    if (intent.purpose && c.offer.purpose) {
      if (arePurposesCompatible(c.offer.purpose, intent.purpose)) {
        score += 100;
        reasons.push(`Matches purpose: ${intent.purpose}`);
      }
    }

    // Signal B: Soft preference matches
    if (Array.isArray(intent.preferences)) {
      for (const pref of intent.preferences) {
        if (checkPreferenceMatch(c.offer, pref)) {
          score += 20;
          reasons.push(`Matches preference: ${pref}`);
        }
      }
    }

    // Signal C: Budget efficiency (lower price relative to maxPricePaise)
    if (intent.maxPricePaise !== undefined && intent.maxPricePaise > 0) {
      const savings = Math.max(0, intent.maxPricePaise - c.offer.pricePaise);
      const savingsRatio = savings / intent.maxPricePaise;
      score += Math.round(savingsRatio * 15);
    }

    return {
      offer: c.offer,
      score,
      reasons,
    };
  });

  // 4. Sort: score descending, then productId ascending as stable tie-breaker
  scored.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    return a.offer.productId.localeCompare(b.offer.productId);
  });

  // 5. Cap at effective limit (strictly maximum 3 recommendations)
  return scored.slice(0, effectiveLimit);
}
