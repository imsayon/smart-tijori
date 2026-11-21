'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';

export function OperatorAccess({ signedIn = false }: { signedIn?: boolean }) {
  const router = useRouter();
  const [token, setToken] = useState('');
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage('');
    try {
      const response = await fetch('/api/ops/session', signedIn
        ? { method: 'DELETE' }
        : { method: 'POST', headers: { Authorization: `Bearer ${token.trim()}` } });
      if (!response.ok) {
        setMessage('Operator access was rejected.');
        return;
      }
      setToken('');
      router.refresh();
    } catch {
      setMessage('Operator access is temporarily unavailable.');
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className={signedIn ? 'flex items-center gap-2' : 'max-w-md space-y-3 rounded-2xl border bg-white p-6'}>
      {!signedIn && (
        <>
          <h1 className="text-xl font-bold">Operator sign-in</h1>
          <label className="block">
            <span className="text-sm">Operator credential</span>
            <input type="password" autoComplete="current-password" required value={token}
              onChange={event => setToken(event.currentTarget.value)} className="mt-1 block w-full rounded-lg border p-2" />
          </label>
        </>
      )}
      <button type="submit" disabled={pending} className="rounded-lg bg-emerald-800 px-3 py-2 text-sm font-semibold text-white">
        {signedIn ? 'Sign out' : 'Sign in'}
      </button>
      {message && <p role="alert" className="text-sm">{message}</p>}
    </form>
  );
}
