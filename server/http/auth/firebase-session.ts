import 'server-only';
import { createHash } from 'node:crypto';
import { applicationDefault, cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { HttpError } from '../errors/http-errors';
import { parseCookies } from '../sessions/session-manager';

export const ACCOUNT_COOKIE = 'st_account';
export const ACCOUNT_MAX_AGE = 8 * 60 * 60;

/** Keep database cart ownership stable without exposing a Firebase UID to shoppers. */
export function shopperId(uid: string) {
  return 'firebase:' + createHash('sha256').update(uid).digest('hex');
}

function firebaseCredential(projectId: string) {
  const raw = process.env.ST_FIREBASE_SERVICE_ACCOUNT_JSON;
  if (raw) {
    try {
      const credentials: unknown = JSON.parse(raw);
      if (!credentials || typeof credentials !== 'object') throw new Error('missing credentials');
      const account = credentials as Record<string, unknown>;
      if (account.project_id !== projectId
          || typeof account.client_email !== 'string'
          || !account.client_email.endsWith('.gserviceaccount.com')
          || typeof account.private_key !== 'string'
          || !account.private_key.includes('PRIVATE KEY')) {
        throw new Error('invalid service account');
      }
      return cert({
        projectId,
        clientEmail: account.client_email,
        privateKey: account.private_key.replace(/\\n/g, '\n'),
      });
    } catch {
      // Never include JSON, private keys or Firebase SDK error details in responses/logs.
      throw new HttpError('DEPENDENCY_UNAVAILABLE', 'Secure sign-in is not configured.', 503);
    }
  }
  // ADC supports a mounted service-account file or workload identity.
  // Render requires an explicit credential source; a public web API key is insufficient.
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) return applicationDefault();
  if (process.env.NODE_ENV === 'production') {
    throw new HttpError('DEPENDENCY_UNAVAILABLE', 'Secure sign-in is not configured.', 503);
  }
  return applicationDefault();
}

export function firebaseAuth() {
  if (process.env.NODE_ENV === 'production' && process.env.FIREBASE_AUTH_EMULATOR_HOST) {
    throw new HttpError('DEPENDENCY_UNAVAILABLE', 'Secure sign-in is not configured.', 503);
  }
  const projectId = process.env.ST_FIREBASE_PROJECT_ID;
  if (!projectId) throw new HttpError('DEPENDENCY_UNAVAILABLE', 'Secure sign-in is not configured.', 503);
  const existing = getApps().find(app => app.name === 'smarttijori');
  const app = existing ?? initializeApp({
    projectId,
    credential: firebaseCredential(projectId),
  }, 'smarttijori');
  return getAuth(app);
}

const INVALID_SESSIONS = new Set([
  'auth/session-cookie-expired',
  'auth/session-cookie-revoked',
  'auth/user-disabled',
  'auth/invalid-session-cookie',
  'auth/argument-error',
  'auth/user-not-found',
]);

/** Invalid/expired sessions are signed out; configuration or provider errors fail closed. */
export async function readAccount(cookieHeader?: string | null) {
  const token = cookieHeader && parseCookies(cookieHeader)[ACCOUNT_COOKIE];
  if (!token) return null;
  const auth = firebaseAuth();
  try {
    const user = await auth.verifySessionCookie(token, true);
    return user.email_verified ? user : null;
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (INVALID_SESSIONS.has(code ?? '')) return null;
    throw new HttpError('DEPENDENCY_UNAVAILABLE', 'Account verification is temporarily unavailable.', 503);
  }
}
