import { z } from 'zod';
import { GeminiQuotaError, getGeminiAdapter } from '../../../../ai/gemini-adapter';
import { buildSessionCookieHeader, resolveSession } from '@server/http/sessions/session-manager';
import { handleServerError, HttpError, jsonError } from '@server/http/errors/http-errors';
import { validateMutationOrigin } from '@server/http/security/csrf';
import { parseBoundedJson } from '@server/http/security/payload-bounds';

const input = z.object({ turns: z.array(z.object({
  role: z.enum(['user', 'model']),
  text: z.string().trim().min(1).max(1800),
})).min(1).max(9) });

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
    const model = getGeminiAdapter();
    if (!model.isConfigured()) throw unavailable();

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
      const reply = await model.replyToShopper(turns);
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
