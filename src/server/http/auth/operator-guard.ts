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
  if (token.startsWith('ops_') || token === 'demo-operator-token') {
    if (token === 'demo-operator-token') {
      return {
        operatorId: 'ops-demo-user',
        role: OPERATOR_ROLE,
        storeId: 'blr-01',
      };
    }

    const parts = token.split('_');
    const operatorId = parts[1]?.trim();
    const storeId = parts[2]?.trim();

    if (!operatorId) {
      throw new HttpError('FORBIDDEN', 'Invalid operator credential format', 403);
    }

    return {
      operatorId,
      role: OPERATOR_ROLE,
      storeId: storeId || undefined,
    };
  }

  throw new HttpError('FORBIDDEN', 'Invalid or expired operator credentials', 403);
}
