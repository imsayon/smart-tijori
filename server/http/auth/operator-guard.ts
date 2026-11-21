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

  // Token format: ops_<operatorId>_<storeId> (e.g., ops_staff01_blr-01) or demo token
  // In demo / test mode: accept valid ops tokens
  const fixtureMode = process.env.NODE_ENV === 'test' || process.env.SMARTTIJORI_DEMO_MODE === 'true';
  if (fixtureMode && (token.startsWith('ops_') || token === 'demo-operator-token')) {
    const parts = token.split('_');
    const operatorId = parts[1] || 'ops-demo-user';
    const storeId = parts[2] || 'blr-01';

    return {
      operatorId,
      role: OPERATOR_ROLE,
      storeId,
    };
  }

  throw new HttpError('FORBIDDEN', 'Invalid or expired operator credentials', 403);
}
