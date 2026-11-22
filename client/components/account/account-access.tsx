'use client';

import { useState, type FormEvent } from 'react';

type Mode = 'signin' | 'register' | 'reset';
type Bag = { branch: string; quantity: number };
type Bags = { guest: Bag; account: Bag };

export function AccountAccess({ signedIn, merchant = false, next }: {
  signedIn?: boolean; merchant?: boolean; next?: '/checkout';
}) {
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [pending, setPending] = useState(false);
  const [conflict, setConflict] = useState<{ token: string; bags: Bags } | null>(null);

  async function exchange(token: string, bag?: 'guest' | 'account') {
    const response = await fetch('/api/account/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      cache: 'no-store',
      body: JSON.stringify({ token, bag, merchant }),
    });
    if (!response.ok) {
      const result = await response.json().catch(() => null);
      if (response.status === 409 && result?.bags) setConflict({ token, bags: result.bags });
      else setMessage(result?.error?.message ?? 'Sign-in is temporarily unavailable.');
      return;
    }
    window.location.assign(merchant ? '/ops' : next ?? '/account');
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await authenticate();
  }

  async function authenticate(google = false) {
    setPending(true);
    setMessage('');
    try {
      if (signedIn) {
        const response = await fetch('/api/account/session', { method: 'DELETE', credentials: 'same-origin', cache: 'no-store' });
        if (!response.ok) throw new Error('Sign-out failed');
        window.location.assign(merchant ? '/ops' : '/');
        return;
      }
      const apiKey = process.env.NEXT_PUBLIC_ST_FIREBASE_API_KEY;
      const authDomain = process.env.NEXT_PUBLIC_ST_FIREBASE_AUTH_DOMAIN;
      const projectId = process.env.NEXT_PUBLIC_ST_FIREBASE_PROJECT_ID;
      if (!apiKey || !authDomain || !projectId) {
        setMessage('Sign-in is temporarily unavailable. Please try again later.');
        return;
      }
      const { initializeApp, getApps } = await import('firebase/app');
      const { connectAuthEmulator, getAuth, setPersistence, inMemoryPersistence, signInWithEmailAndPassword, createUserWithEmailAndPassword,
        sendEmailVerification, sendPasswordResetEmail, signOut, GoogleAuthProvider, signInWithPopup } = await import('firebase/auth');
      const app = getApps().find(app => app.name === 'smarttijori') ??
        initializeApp({ apiKey, authDomain, projectId }, 'smarttijori');
      const auth = getAuth(app);
      const emulator = process.env.NEXT_PUBLIC_ST_FIREBASE_AUTH_EMULATOR;
      if (process.env.NODE_ENV === 'development' && emulator && !auth.emulatorConfig && new URL(emulator).hostname === '127.0.0.1') {
        connectAuthEmulator(auth, emulator, { disableWarnings: true });
      }
      await setPersistence(auth, inMemoryPersistence);
      if (mode === 'reset') {
        await sendPasswordResetEmail(auth, email).catch(error => {
          if (error.code !== 'auth/user-not-found') throw error;
        });
        setMessage('If an account exists, you’ll receive a password reset email.');
        return;
      }
      const googleProvider = new GoogleAuthProvider();
      googleProvider.setCustomParameters({ prompt: 'select_account' });
      const { user } = google
        ? await signInWithPopup(auth, googleProvider)
        : mode === 'register'
          ? await createUserWithEmailAndPassword(auth, email, password)
          : await signInWithEmailAndPassword(auth, email, password);
      try {
        if (!user.emailVerified) {
          await sendEmailVerification(user);
          setMessage('Check your email to verify your address, then sign in.');
          setMode('signin');
        } else {
          await exchange(await user.getIdToken());
        }
      } finally {
        await signOut(auth);
      }
    } catch (error) {
      const code = error instanceof Error && 'code' in error ? error.code : undefined;
      if (google) {
        setMessage(code === 'auth/popup-closed-by-user' ? 'Google sign-in was cancelled.'
          : code === 'auth/popup-blocked' ? 'Allow popups for SmartTijori and try again.'
            : code === 'auth/unauthorized-domain' ? 'Google sign-in is unavailable at this address. Please try email sign-in.'
              : code === 'auth/operation-not-allowed' ? 'Google sign-in is not available right now. Try email instead.'
                : 'Google sign-in could not finish. Try again.');
      } else {
        setMessage(mode === 'signin' && !signedIn ? 'Sign-in failed. Check your email and password or try again.' : 'The account service could not complete the request. Try again.');
      }
    } finally {
      setPending(false);
    }
  }

  const switchMode = (newMode: Mode) => {
    setMode(newMode);
    setMessage('');
  };

  return (
    <form onSubmit={submit} className={signedIn ? 'atelier-signout' : 'atelier-access-form'}>
      {!signedIn && <>
        <h1 className="atelier-heading atelier-form-title">{mode === 'reset' ? 'Reset password' : mode === 'register' ? 'Create an account' : merchant ? 'Merchant sign-in' : 'Sign in'}</h1>
        {merchant && mode === 'signin' && <p>Use the account assigned to your branch.</p>}
        {conflict ? <>
          <p>Choose which bag to continue with.</p>
          {(['guest', 'account'] as const).map(bag => (
            <button type="button" key={bag} className="atelier-action mr-2 mb-2" disabled={pending} onClick={async () => {
              setPending(true);
              try { await exchange(conflict.token, bag); } catch { setMessage('Could not save your bag choice. Try again.'); }
              finally { setPending(false); }
            }}>
              {bag === 'guest' ? 'This device' : 'Account'} · {conflict.bags[bag].quantity} items · {conflict.bags[bag].branch}
            </button>
          ))}
        </> : <>
          {mode === 'signin' && <>
            <button type="button" className="atelier-secondary" disabled={pending} onClick={() => void authenticate(true)}>Continue with Google</button>
            <p className="atelier-auth-divider">or use email</p>
          </>}
          <label className="block">Email<input type="email" autoComplete="email" required value={email}
            onChange={event => setEmail(event.target.value)} className="atelier-input" /></label>
          {mode !== 'reset' && (
            <label className="block">Password<input type="password" autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
              minLength={6} required value={password} onChange={event => setPassword(event.target.value)} className="atelier-input" /></label>
          )}
        </>}
      </>}
      {!conflict && <button type="submit" className="atelier-action" disabled={pending}>
        {signedIn ? 'Sign out' : mode === 'reset' ? 'Send reset email' : mode === 'register' ? 'Register' : 'Sign in'}
      </button>}
      {!signedIn && !conflict && <div className="flex flex-wrap gap-4 text-sm">
        {mode === 'signin' && !merchant && <button type="button" className="underline" disabled={pending} onClick={() => switchMode('register')}>Create an account</button>}
        {mode === 'signin' ? <button type="button" className="underline" disabled={pending} onClick={() => switchMode('reset')}>Forgot password</button>
          : <button type="button" className="underline" disabled={pending} onClick={() => switchMode('signin')}>Back to sign-in</button>}
      </div>}
      {message && <p role="status" className="text-sm">{message}</p>}
    </form>
  );
}
