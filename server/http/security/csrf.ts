import { HttpError } from '../errors/http-errors';

const MUTATION_METHODS = new Set(['POST', 'PUT', 'DELETE', 'PATCH']);

/**
 * Validates mutation origin to prevent CSRF attacks.
 * For same-origin APIs, checks Origin / Referer / Host headers.
 */
export function validateMutationOrigin(request: Request): void {
  if (!MUTATION_METHODS.has(request.method.toUpperCase())) {
    return;
  }

  const origin = request.headers.get('origin');
  const host = request.headers.get('host');
  const secFetchSite = request.headers.get('sec-fetch-site');

  // If Sec-Fetch-Site is present, check browser metadata
  if (secFetchSite && secFetchSite === 'cross-site') {
    throw new HttpError('FORBIDDEN', 'Cross-site request rejected', 403);
  }

  // If Origin is provided, verify it matches the current Host
  if (origin && host) {
    try {
      const originUrl = new URL(origin);
      // Strip port if standard or match directly
      if (originUrl.host !== host) {
        // In local development allow localhost variants (e.g., localhost:3000 vs 127.0.0.1:3000)
        const isLocal =
          (originUrl.hostname === 'localhost' || originUrl.hostname === '127.0.0.1') &&
          (host.startsWith('localhost') || host.startsWith('127.0.0.1'));
        if (!isLocal) {
          throw new HttpError('FORBIDDEN', 'Origin mismatch on mutation request', 403);
        }
      }
    } catch (e) {
      if (e instanceof HttpError) throw e;
      throw new HttpError('FORBIDDEN', 'Invalid origin header', 403);
    }
  }
}
