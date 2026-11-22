import { getCommerceDatabase } from '../../db/runtime';
import { readAccount } from './firebase-session';
import { OPERATOR_ROLE, verifyOperatorSession, type OperatorActor } from './operator-guard';
import { HttpError } from '../errors/http-errors';

export async function readMerchant(cookie?: string | null): Promise<OperatorActor | null> {
  const user = await readAccount(cookie);
  return user ? findMerchant(user.uid) : null;
}

export async function findMerchant(uid: string): Promise<OperatorActor | null> {
  let storeId: string | undefined;
  try {
    storeId = await getCommerceDatabase().transact(async client => {
      const { rows } = await client.query<{ store_id: string }>(
        'SELECT store_id FROM operator_memberships WHERE firebase_uid = $1 AND active',
        [uid],
      );
      return rows[0]?.store_id;
    });
  } catch (error) {
    const sqlState = (error as { code?: string })?.code;
    if (sqlState === '42501' || sqlState === '42P01') {
      throw new HttpError('DEPENDENCY_UNAVAILABLE', 'Merchant sign-in is temporarily unavailable.', 503);
    }
    throw error;
  }
  return storeId ? { operatorId: uid, role: OPERATOR_ROLE, storeId } : null;
}

export async function requireMerchant(request: Request) {
  if (process.env.SMARTTIJORI_DEMO_MODE === 'true' || process.env.NODE_ENV === 'test') {
    return verifyOperatorSession(request);
  }
  const actor = await readMerchant(request.headers.get('cookie'));
  if (!actor) throw new HttpError('FORBIDDEN', 'An active branch membership is required.', 403);
  return actor;
}
