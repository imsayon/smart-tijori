import { timingSafeEqual } from 'node:crypto';
import { HttpError } from '../errors/http-errors';
import { parseCookies } from '../sessions/session-manager';

export const OPERATOR_COOKIE_NAME = 'st_ops_session';
export const OPERATOR_ROLE = 'store_operator';

export interface OperatorActor {
  operatorId: string;
  role: typeof OPERATOR_ROLE;
  storeId?: string;
}

/**
 * Shared operator session guard for future reuse by Shrinidhi and ops routes.
 * Never trust actor IDs or roles supplied in request bodies.
 */
export function verifyOperatorSession(request: Request): OperatorActor {
  // Check Authorization Bearer or HttpOnly cookie
  const authHeader = request.headers.get('authorization');
  let token: string | undefined;

  if (authHeader?.startsWith('Bearer ')) {
    token = authHeader.substring(7).trim();
  } else {
    const cookieHeader = request.headers.get('cookie');
    if (cookieHeader) {
      const cookies = parseCookies(cookieHeader);
      token = cookies[OPERATOR_COOKIE_NAME];
    }
  }

  if (!token) {
    throw new HttpError('FORBIDDEN', 'Operator authentication required', 401);
  }

  const actor = readOperatorToken(token);
  if (actor) return actor;
  throw new HttpError('FORBIDDEN', 'Invalid or expired operator credentials', 403);
}

export function readOperatorToken(token?: string): OperatorActor | null {
  if (!token) return null;
  if (process.env.NODE_ENV === 'test' || process.env.SMARTTIJORI_DEMO_MODE === 'true') {
    if (!token.startsWith('ops_') && token !== 'demo-operator-token') return null;
    const parts = token.split('_');
    return { operatorId: parts[1] || 'ops-demo-user', role: OPERATOR_ROLE, storeId: parts[2] || 'blr-01' };
  }
  const expected = process.env.ST_OPS_OPERATOR_TOKEN;
  const storeId = process.env.ST_OPS_STORE_ID;
  if (!expected || expected.length < 32 || !storeId) return null;
  const supplied = Buffer.from(token);
  const configured = Buffer.from(expected);
  return supplied.length === configured.length && timingSafeEqual(supplied, configured)
    ? { operatorId: 'cashier', role: OPERATOR_ROLE, storeId }
    : null;
}
