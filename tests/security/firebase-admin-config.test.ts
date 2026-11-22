import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { firebaseAuth, readAccount, shopperId } from '@/server/http/auth/firebase-session';

const mocks = vi.hoisted(() => ({
  getApps: vi.fn(() => [] as unknown[]),
  initializeApp: vi.fn(() => ({ name: 'smarttijori' })),
  cert: vi.fn(() => ({ type: 'test-credential' })),
  applicationDefault: vi.fn(() => ({ type: 'adc' })),
  getAuth: vi.fn(() => ({ verifySessionCookie: vi.fn() })),
  verifySessionCookie: vi.fn(),
}));
vi.mock('firebase-admin/app', () => ({
  getApps: mocks.getApps,
  initializeApp: mocks.initializeApp,
  cert: mocks.cert,
  applicationDefault: mocks.applicationDefault,
}));
vi.mock('firebase-admin/auth', () => ({
  getAuth: () => ({ verifySessionCookie: mocks.verifySessionCookie }),
}));

describe('Firebase Admin server configuration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('ST_FIREBASE_PROJECT_ID', 'cents-lab-32d71');
    vi.stubEnv('ST_FIREBASE_SERVICE_ACCOUNT_JSON', undefined);
    vi.stubEnv('GOOGLE_APPLICATION_CREDENTIALS', undefined);
    vi.stubEnv('FIREBASE_AUTH_EMULATOR_HOST', undefined);
  });
  afterEach(() => vi.unstubAllEnvs());

  it('fails closed without server credentials, even with a public project ID', () => {
    expect(() => firebaseAuth()).toThrow(/Secure sign-in is not configured/);
    expect(mocks.initializeApp).not.toHaveBeenCalled();
  });

  it('rejects a private key for the wrong Firebase project', () => {
    vi.stubEnv('ST_FIREBASE_SERVICE_ACCOUNT_JSON', JSON.stringify({
      project_id: 'another-project', client_email: 'admin@another-project.iam.gserviceaccount.com',
      private_key: '-----BEGIN PRIVATE KEY-----test-----END PRIVATE KEY-----',
    }));
    expect(() => firebaseAuth()).toThrow(/Secure sign-in is not configured/);
    expect(mocks.cert).not.toHaveBeenCalled();
  });

  it('loads only matching service-account credentials on the server', () => {
    vi.stubEnv('ST_FIREBASE_SERVICE_ACCOUNT_JSON', JSON.stringify({
      project_id: 'cents-lab-32d71',
      client_email: 'firebase-adminsdk-test@cents-lab-32d71.iam.gserviceaccount.com',
      private_key: '-----BEGIN PRIVATE KEY-----\\nTEST\\n-----END PRIVATE KEY-----',
    }));
    firebaseAuth();
    expect(mocks.cert).toHaveBeenCalledWith({
      projectId: 'cents-lab-32d71',
      clientEmail: 'firebase-adminsdk-test@cents-lab-32d71.iam.gserviceaccount.com',
      privateKey: '-----BEGIN PRIVATE KEY-----\nTEST\n-----END PRIVATE KEY-----',
    });
    expect(mocks.initializeApp).toHaveBeenCalledWith(expect.objectContaining({ projectId: 'cents-lab-32d71' }), 'smarttijori');
  });

  it('supports an explicitly mounted credential file through ADC', () => {
    vi.stubEnv('GOOGLE_APPLICATION_CREDENTIALS', '/run/secrets/firebase-admin.json');
    firebaseAuth();
    expect(mocks.applicationDefault).toHaveBeenCalledTimes(1);
    expect(mocks.cert).not.toHaveBeenCalled();
  });

  it('does not permit the auth emulator in production', () => {
    vi.stubEnv('FIREBASE_AUTH_EMULATOR_HOST', '127.0.0.1:9099');
    expect(() => firebaseAuth()).toThrow(/Secure sign-in is not configured/);
    expect(mocks.initializeApp).not.toHaveBeenCalled();
  });

  it('denies revoked sessions but distinguishes verifier failures', async () => {
    const cookie = 'st_account=test-cookie';
    vi.stubEnv('ST_FIREBASE_SERVICE_ACCOUNT_JSON', JSON.stringify({
      project_id: 'cents-lab-32d71',
      client_email: 'firebase-adminsdk-test@cents-lab-32d71.iam.gserviceaccount.com',
      private_key: '-----BEGIN PRIVATE KEY-----TEST-----END PRIVATE KEY-----',
    }));
    mocks.verifySessionCookie.mockRejectedValueOnce({ code: 'auth/session-cookie-expired' });
    expect(await readAccount(cookie)).toBeNull();

    mocks.verifySessionCookie.mockRejectedValueOnce({ code: 'app/invalid-credential' });
    await expect(readAccount(cookie)).rejects.toMatchObject({
      status: 503,
      message: 'Account verification is temporarily unavailable.',
    });
  });

  it('keeps the public commerce owner ID derived from, not equal to, Firebase UID', () => {
    const id = shopperId('firebase-user-1');
    expect(id).toMatch(/^firebase:[0-9a-f]{64}$/);
    expect(id).not.toContain('firebase-user-1');
  });
});
