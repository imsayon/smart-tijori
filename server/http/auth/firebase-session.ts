import 'server-only';
import { createHash } from 'node:crypto';
import { applicationDefault, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { HttpError } from '../errors/http-errors';
import { parseCookies } from '../sessions/session-manager';

export const ACCOUNT_COOKIE = 'st_account';
export const ACCOUNT_MAX_AGE = 8 * 60 * 60;

export function shopperId(uid: string) {
  return 'firebase:' + createHash('sha256').update(uid).digest('hex');
}

export function firebaseAuth() {
  if (process.env.NODE_ENV === 'production' && process.env.FIREBASE_AUTH_EMULATOR_HOST) {
    throw new Error('Firebase Auth emulator is disabled in production');
  }
  const projectId = process.env.ST_FIREBASE_PROJECT_ID;
  if (!projectId) throw new HttpError('DEPENDENCY_UNAVAILABLE', 'Account service is unavailable.');
  const app = getApps().find(app => app.name === 'smarttijori')
    ?? initializeApp({ projectId, credential: applicationDefault() }, 'smarttijori');
  return getAuth(app);
}

export async function readAccount(cookie?: string | null) {
  const token = cookie && parseCookies(cookie)[ACCOUNT_COOKIE];
  if (!token) return null;
  const auth = firebaseAuth();
  try {
    const user = await auth.verifySessionCookie(token, true);
    return user.email_verified ? user : null;
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (['auth/session-cookie-expired', 'auth/session-cookie-revoked', 'auth/user-disabled',
      'auth/invalid-session-cookie', 'auth/argument-error', 'auth/user-not-found'].includes(code ?? '')) return null;
    throw error;
  }
}
