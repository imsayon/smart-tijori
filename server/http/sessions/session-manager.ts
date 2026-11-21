import { createHmac, timingSafeEqual } from 'node:crypto';
import { v4 as uuidv4, validate as uuidValidate } from 'uuid';

export const SESSION_COOKIE_NAME = 'st_session';
export const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60; // 7 days

export interface ResolvedSession {
  sessionId: string;
  isNew: boolean;
}

export interface SessionCookieOptions {
  httpOnly: boolean;
  secure: boolean;
  sameSite: 'lax' | 'strict' | 'none';
  path: string;
  maxAge: number;
}

export function getSessionCookieOptions(): SessionCookieOptions {
  const isProduction = process.env.NODE_ENV === 'production';
  const forceSecure = process.env.COOKIE_SECURE === 'true';

  return {
    httpOnly: true,
    secure: isProduction || forceSecure,
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE_SECONDS,
  };
}

/**
 * Resolves or creates a server-issued guest session ID.
 * Untrusted bodies or client parameters are ignored; session is ONLY derived from HttpOnly cookie.
 */
function signingKey() {
  const secret = process.env.SESSION_SECRET;
  if (secret && secret.length >= 32) return secret;
  if (process.env.NODE_ENV === 'production' && process.env.SMARTTIJORI_DEMO_MODE !== 'true') {
    throw new Error('SESSION_SECRET must contain at least 32 characters.');
  }
}

function sign(value: string, secret: string) {
  return createHmac('sha256', secret).update(value).digest('hex');
}

export function resolveSession(cookieHeader?: string | null): ResolvedSession {
  if (!cookieHeader) {
    return { sessionId: uuidv4(), isNew: true };
  }

  const cookies = parseCookies(cookieHeader);
  const rawId = cookies[SESSION_COOKIE_NAME];

  const secret = signingKey();
  if (rawId && !secret && uuidValidate(rawId)) return { sessionId: rawId, isNew: false };
  if (rawId && secret) {
    const [id, expiry, signature, extra] = rawId.split('.');
    const expiresAt = Number(expiry);
    if (!extra && uuidValidate(id) && Number.isSafeInteger(expiresAt) && expiresAt > Date.now()
        && signature && /^[a-f0-9]{64}$/.test(signature)
        && timingSafeEqual(Buffer.from(signature), Buffer.from(sign(`${id}.${expiry}`, secret)))) {
      return { sessionId: id, isNew: false };
    }
  }

  return { sessionId: uuidv4(), isNew: true };
}

/**
 * Lightweight cookie parser for headers
 */
export function parseCookies(header: string): Record<string, string> {
  const out: Record<string, string> = Object.create(null);
  const pairs = header.split(';');

  for (const pair of pairs) {
    const idx = pair.indexOf('=');
    if (idx === -1) continue;
    const key = pair.substring(0, idx).trim();
    const val = pair.substring(idx + 1).trim();
    try { out[key] = decodeURIComponent(val); } catch { continue; }
  }

  return out;
}

/**
 * Build the Set-Cookie string for the session cookie
 */
export function buildSessionCookieHeader(sessionId: string): string {
  const opts = getSessionCookieOptions();
  const secret = signingKey();
  const unsigned = `${sessionId}.${Date.now() + opts.maxAge * 1000}`;
  const value = secret ? `${unsigned}.${sign(unsigned, secret)}` : sessionId;
  const parts = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(value)}`,
    `Path=${opts.path}`,
    `Max-Age=${opts.maxAge}`,
    'HttpOnly',
    `SameSite=${opts.sameSite.charAt(0).toUpperCase() + opts.sameSite.slice(1)}`,
  ];

  if (opts.secure) {
    parts.push('Secure');
  }

  return parts.join('; ');
}
