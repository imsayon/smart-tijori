import { z } from 'zod';
import { GeminiQuotaError, getGeminiAdapter } from '../../../../ai/gemini-adapter';
import { getCommerceCommands } from '@server/http/adapters';
import { buildSessionCookieHeader, resolveSession } from '@server/http/sessions/session-manager';
import { handleServerError, HttpError, jsonError } from '@server/http/errors/http-errors';
import { validateMutationOrigin } from '@server/http/security/csrf';
import { parseBoundedJson } from '@server/http/security/payload-bounds';

const input = z.object({ storeId: z.string().trim().regex(/^[a-zA-Z0-9_-]{2,50}$/).optional(), turns: z.array(z.object({
  role: z.enum(['user', 'model']),
  text: z.string().trim().min(1).max(1800),
})).min(1).max(9) });

const stopwords = new Set(['the','and','for','with','what','which','have','from','shop','store','available','want','need','show','suggest','recommend','item','items','please','some','best','cheap','under','find','buy']);
function scoreProduct(query: string, offer: { name: string; purpose: string; category: string }) {
  const name = offer.name.toLowerCase();
  const text = (offer.name + ' ' + offer.purpose.replaceAll('-', ' ') + ' ' + offer.category).toLowerCase();
  const tokens = query.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/)
    .filter(t => t.length > 2 && !stopwords.has(t));
  return tokens.reduce((sum, token) => sum + (text.includes(token) ? (name.includes(token) ? 3 : 1) : 0), 0);
}
function presentStock(offer: {name:string;purpose:string;pricePaise:number;pack:{quantity:number;unit:string};available:number}) {
  return JSON.stringify({
    name: offer.name.slice(0,90), purpose: offer.purpose.slice(0,70),
    priceInr: Number((offer.pricePaise/100).toFixed(2)),
    pack: `${offer.pack.quantity} ${offer.pack.unit}`, availableUnits: offer.available,
  });
}

// shortcut: quota applies per web process, use a shared limiter before scaling replicas.
const requests = new Map<string, number>();
let windowEnd = 0;
let total = 0;
const unavailable = () => new HttpError('DEPENDENCY_UNAVAILABLE', 'The shop assistant is temporarily unavailable.');

export async function POST(request: Request) {
  try {
    validateMutationOrigin(request);
    const { sessionId, isNew } = resolveSession(request.headers.get('cookie'));
    const parsed = input.safeParse(await parseBoundedJson(request, 24 * 1024));
    const turns = parsed.success ? parsed.data.turns : [];
    if (turns.length % 2 !== 1 || turns.some((turn, index) =>
      turn.role !== (index % 2 ? 'model' : 'user') || (turn.role === 'user' && turn.text.length > 500))) {
      throw new HttpError('VALIDATION_ERROR', 'Enter a message of up to 500 characters.');
    }
    const storeId = parsed.success ? parsed.data.storeId : undefined;
    const question = turns.at(-1)?.text ?? '';
    let catalogueContext: string | undefined;
    let matchedProducts: Array<{name:string;pricePaise:number;pack:{quantity:number;unit:string};available:number}> = [];
    if (storeId) {
      const offers = (await getCommerceCommands().getProductOffers(storeId))
        .filter(offer => offer.storeId === storeId && offer.available > 0);
      const ranked = offers.map(offer => ({ offer, score: scoreProduct(question, offer) }))
        .sort((a, b) => b.score-a.score || a.offer.name.localeCompare(b.offer.name));
      const focused = ranked.some(r => r.score > 0);
      matchedProducts = ranked.filter(r => !focused || r.score > 0).slice(0, 24).map(({offer}) => offer);
      catalogueContext = `Selected branch ID: ${storeId}. Available product records (exact, factual):
${matchedProducts.map(offer => presentStock(offer)).join('\n')}
Recommend only these products. If the shopper asks for a product not among these relevant matches, explain no relevant availability was verified. Stock is rechecked at checkout.`;
    }
    const model = getGeminiAdapter();
    if (!model.isConfigured() && !storeId) throw unavailable();

    const now = Date.now();
    if (now >= windowEnd) {
      windowEnd = now + 60_000;
      requests.clear();
      total = 0;
    }
    const sent = requests.get(sessionId) ?? 0;
    if (sent >= 5 || total >= 20) {
      return jsonError('DEPENDENCY_UNAVAILABLE', 'The shop assistant is busy. Try again shortly.', 429, undefined, {
        'Retry-After': String(Math.ceil((windowEnd - now) / 1000)),
      });
    }
    requests.set(sessionId, sent + 1);
    total++;
    try {
      const reply = model.isConfigured()
        ? await model.replyToShopper(turns, catalogueContext)
        : matchedProducts.length
          ? `Available at your selected store: ${matchedProducts.slice(0,4).map(p => `${p.name} (₹${(p.pricePaise/100).toFixed(2)}, ${p.pack.quantity} ${p.pack.unit})`).join('; ')}. Stock is rechecked at checkout.`
          : 'I could not find matching in-stock products at this store. Try another search or branch.';
      const headers = new Headers({ 'Cache-Control': 'no-store' });
      if (isNew) headers.set('Set-Cookie', buildSessionCookieHeader(sessionId));
      return Response.json({ reply: reply.slice(0, 1800) }, { headers });
    } catch (error) {
      if (error instanceof GeminiQuotaError) {
        return jsonError('DEPENDENCY_UNAVAILABLE', 'The shop assistant is busy. Try again shortly.', 429);
      }
      throw unavailable();
    }
  } catch (error) {
    return handleServerError(error);
  }
}
