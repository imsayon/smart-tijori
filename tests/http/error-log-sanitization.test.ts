import { afterEach, describe, expect, it, vi } from 'vitest';
import { handleServerError } from '@/server/http/errors/http-errors';

afterEach(() => { vi.restoreAllMocks(); });

describe('safe server diagnostics', () => {
  it('classifies a missing session signing key without logging the error text', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const response = handleServerError(new Error('SESSION_SECRET must contain at least 32 characters.'));
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: { code: 'DEPENDENCY_UNAVAILABLE', message: 'An unexpected service error occurred. Please try again.' },
    });
    expect(log).toHaveBeenCalledWith('[Internal Server Error]', {
      kind: 'Error', reason: 'session_secret_not_configured',
    });
  });

  it('records a safe PostgreSQL SQLSTATE without leaking secrets or SQL text', () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const error = Object.assign(new Error('password=PRIVATE SELECT * FROM confidential_data'), { code: '42P01' });
    handleServerError(error);
    expect(log).toHaveBeenCalledWith('[Internal Server Error]', {
      kind: 'Error', reason: 'unclassified', sqlState: '42P01',
    });
    expect(JSON.stringify(log.mock.calls)).not.toContain('PRIVATE');
    expect(JSON.stringify(log.mock.calls)).not.toContain('confidential_data');
  });
});
