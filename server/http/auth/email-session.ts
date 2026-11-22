import 'server-only';
import { randomBytes, scrypt as callbackScrypt, createHash, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { getCommerceDatabase } from '../../db/runtime';
import { parseCookies } from '../sessions/session-manager';
import { HttpError } from '../errors/http-errors';

const scrypt = promisify(callbackScrypt);
export const ACCOUNT_COOKIE = 'st_account';
export const ACCOUNT_MAX_AGE = 8 * 60 * 60;
export function shopperId(uid: string) { return 'account:' + uid; }
export type Account = { uid: string; email: string; email_verified: boolean };
const digest = (value: string) => createHash('sha256').update(value).digest('hex');

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  const derived = await scrypt(password, Buffer.from(salt, 'hex'), 64) as Buffer;
  return 'scrypt:' + salt + ':' + derived.toString('hex');
}
async function verifyPassword(password: string, stored: string) {
  const [method, salt, hash] = stored.split(':');
  if (method !== 'scrypt' || !/^[a-f0-9]{32}$/.test(salt ?? '') || !/^[a-f0-9]{128}$/.test(hash ?? '')) return false;
  const derived = await scrypt(password, Buffer.from(salt, 'hex'), 64) as Buffer;
  return timingSafeEqual(derived, Buffer.from(hash, 'hex'));
}
export async function registerAccount(email: string, password: string) {
  const hash = await hashPassword(password);
  return getCommerceDatabase().transact(async client => {
    const result = await client.query<{id:string;email:string}>(
      'INSERT INTO account_users(email,password_hash) VALUES($1,$2) ON CONFLICT(email) DO NOTHING RETURNING id,email',
      [email, hash],
    );
    if (!result.rows[0]) throw new HttpError('VALIDATION_ERROR', 'An account already exists for this email.', 409);
    return { uid: result.rows[0].id, email: result.rows[0].email, email_verified: true } as Account;
  });
}
export async function authenticateAccount(email: string, password: string): Promise<Account> {
  const result = await getCommerceDatabase().transact(async client => client.query<{id:string;email:string;password_hash:string}>(
    'SELECT id,email,password_hash FROM account_users WHERE email=$1', [email],
  ));
  const row = result.rows[0];
  if (!row || !await verifyPassword(password, row.password_hash)) throw new HttpError('FORBIDDEN', 'Incorrect email or password.', 401);
  return { uid: row.id, email: row.email, email_verified: true };
}
export async function issueAccountSession(uid: string) {
  const token = randomBytes(32).toString('hex');
  await getCommerceDatabase().transact(async client => {
    await client.query(
      "INSERT INTO account_sessions(token_hash,account_id,expires_at) VALUES($1,$2,clock_timestamp()+interval '8 hours')",
      [digest(token), uid],
    );
  });
  return token;
}
export async function revokeAccountSession(cookieHeader?: string | null) {
  const token = cookieHeader ? parseCookies(cookieHeader)[ACCOUNT_COOKIE] : null;
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return;
  await getCommerceDatabase().transact(async client => {
    await client.query('DELETE FROM account_sessions WHERE token_hash=$1', [digest(token)]);
  });
}
export async function readAccount(cookieHeader?: string | null): Promise<Account | null> {
  const token = cookieHeader ? parseCookies(cookieHeader)[ACCOUNT_COOKIE] : null;
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  const result = await getCommerceDatabase().transact(async client => client.query<{id:string;email:string}>(
    'SELECT u.id,u.email FROM account_sessions s JOIN account_users u ON u.id=s.account_id WHERE s.token_hash=$1 AND s.expires_at>clock_timestamp()',
    [digest(token)],
  ));
  const row = result.rows[0];
  return row ? { uid: row.id, email: row.email, email_verified: true } : null;
}
