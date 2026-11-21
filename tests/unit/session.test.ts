import { describe, it, expect, vi } from 'vitest';
import {
  resolveSession,
  buildSessionCookieHeader,
  parseCookies,
  SESSION_COOKIE_NAME,
} from '@/server/http/sessions/session-manager';

describe('Session Manager Unit Tests', () => {
  it('creates a new server-issued session when cookie header is missing', () => {
    const session = resolveSession(null);
    expect(session.isNew).toBe(true);
    expect(session.sessionId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
  });

  it('reuses existing valid UUID session from cookie', () => {
    const validUuid = '12345678-1234-4234-8234-123456789abc';
    const cookieHeader = `${SESSION_COOKIE_NAME}=${validUuid}; Path=/`;
    const session = resolveSession(cookieHeader);

    expect(session.isNew).toBe(false);
    expect(session.sessionId).toBe(validUuid);
  });

  it('generates a new session if provided cookie has an invalid non-UUID value', () => {
    const invalidCookie = `${SESSION_COOKIE_NAME}=not-a-valid-uuid; Path=/`;
    const session = resolveSession(invalidCookie);

    expect(session.isNew).toBe(true);
    expect(session.sessionId).not.toBe('not-a-valid-uuid');
    expect(session.sessionId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
  });

  it('correctly constructs HttpOnly and SameSite Set-Cookie header', () => {
    const testId = '12345678-1234-4234-8234-123456789abc';
    const header = buildSessionCookieHeader(testId);

    expect(header).toContain(`${SESSION_COOKIE_NAME}=${testId}`);
    expect(header).toContain('HttpOnly');
    expect(header).toContain('SameSite=Lax');
    expect(header).toContain('Path=/');
    expect(header).toContain('Max-Age=604800'); // 7 days
  });

  it('rejects unsigned and modified guest credentials when signing is configured', () => {
    vi.stubEnv('SESSION_SECRET', 'only-for-tests-'.repeat(3));
    try {
      const session = resolveSession();
      const cookie = buildSessionCookieHeader(session.sessionId).split(';')[0];
      expect(resolveSession(cookie)).toEqual({ sessionId: session.sessionId, isNew: false });
      expect(resolveSession(`${cookie}0`).isNew).toBe(true);
      expect(resolveSession(`${SESSION_COOKIE_NAME}=${session.sessionId}`).isNew).toBe(true);
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it('parses cookies accurately from complex header', () => {
    const header = 'a=1; b=hello%20world; st_session=test-123';
    const parsed = parseCookies(header);

    expect(parsed.a).toBe('1');
    expect(parsed.b).toBe('hello world');
    expect(parsed.st_session).toBe('test-123');
  });
});
