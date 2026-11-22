'use client';

import { useState, type FormEvent } from 'react';

type Mode = 'signin' | 'register';
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
  const [conflict, setConflict] = useState<Bags | null>(null);

  async function exchange(bag?: 'guest' | 'account') {
    const response = await fetch('/api/account/session', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin', cache: 'no-store',
      body: JSON.stringify({ email, password, mode: bag ? 'signin' : mode, bag, merchant }),
    });
    if (!response.ok) {
      const result = await response.json().catch(() => null);
      if (response.status === 409 && result?.bags) setConflict(result.bags);
      else setMessage(result?.error?.message ?? 'Could not sign in. Please try again.');
      return;
    }
    window.location.assign(merchant ? '/ops' : next ?? '/account');
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage('');
    try {
      if (signedIn) {
        const response = await fetch('/api/account/session', { method: 'DELETE', credentials: 'same-origin' });
        if (!response.ok) throw new Error('Sign-out failed');
        window.location.assign(merchant ? '/ops' : '/');
      } else await exchange();
    } catch {
      setMessage('Could not complete your request. Try again.');
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className={signedIn ? 'atelier-signout' : 'atelier-access-form'}>
      {!signedIn && <>
        <h1 className="atelier-heading atelier-form-title">{mode === 'register' ? 'Create an account' : merchant ? 'Merchant sign-in' : 'Sign in'}</h1>
        {merchant && <p>Use the account assigned to your branch.</p>}
        {conflict ? <>
          <p>Choose which bag to continue with.</p>
          {(['guest', 'account'] as const).map(bag => (
            <button type="button" key={bag} className="atelier-action mr-2 mb-2" disabled={pending} onClick={async () => {
              setPending(true);
              try { await exchange(bag); } catch { setMessage('Could not save your bag choice.'); }
              finally { setPending(false); }
            }}>
              {bag === 'guest' ? 'This device' : 'Account'} · {conflict[bag].quantity} items · {conflict[bag].branch}
            </button>
          ))}
        </> : <>
          <label className="block">Email<input type="email" autoComplete="email" required value={email}
            onChange={event => setEmail(event.target.value)} className="atelier-input" /></label>
          <label className="block">Password<input type="password" autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
            minLength={8} required value={password} onChange={event => setPassword(event.target.value)} className="atelier-input" />
          </label>
        </>}
      </>}
      {!conflict && <button type="submit" className="atelier-action" disabled={pending}>
        {signedIn ? 'Sign out' : mode === 'register' ? 'Register' : 'Sign in'}
      </button>}
      {!signedIn && !merchant && !conflict && (
        <div className="flex flex-wrap gap-4 text-sm">
          <button type="button" className="underline" disabled={pending} onClick={() => { setMode(mode === 'signin' ? 'register' : 'signin'); setMessage(''); }}>
            {mode === 'signin' ? 'Create an account' : 'Back to sign-in'}
          </button>
        </div>
      )}
      {message && <p role="status" className="text-sm">{message}</p>}
    </form>
  );
}
