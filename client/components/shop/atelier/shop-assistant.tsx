'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/ui/atelier';
import { useStore } from '@/lib/session/store-context';

type Suggestion = { productId: string; name: string; pricePaise: number; pack: { quantity: number; unit: string }; available: number };
type Turn = { role: 'user' | 'model'; text: string; suggestions?: Suggestion[] };

export function ShopAssistant() {
  const { selectedStoreId, selectedStore } = useStore();
  const dialog = useRef<HTMLDialogElement>(null);
  const log = useRef<HTMLDivElement>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (log.current) log.current.scrollTop = log.current.scrollHeight;
  }, [turns, pending]);

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const question = message.trim();
    if (pending || !question) return;
    const next: Turn[] = [...turns.slice(-8), { role: 'user', text: question }];
    setPending(true);
    setError('');
    try {
      const response = await fetch('/api/shop-assistant', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ turns: next, storeId: selectedStoreId || undefined }),
      });
      const result = await response.json();
      if (!response.ok || typeof result.reply !== 'string') {
        setError(result.error?.message ?? 'Try again in a moment.');
      } else {
        setTurns([...next, { role: 'model', text: result.reply, suggestions: Array.isArray(result.suggestions) ? result.suggestions : [] }]);
        setMessage('');
      }
    } catch {
      setError('The shop assistant could not connect. Try again.');
    } finally {
      setPending(false);
    }
  }

  return <>
    <button type="button" className="atelier-assistant-launch" aria-haspopup="dialog" onClick={() => dialog.current?.showModal()}>
      <Icon name="chat" size={16} /> Shop help
    </button>
    <dialog className="atelier-assistant" ref={dialog} aria-labelledby="shop-assistant-title">
      <header>
        <h2 id="shop-assistant-title">Shop assistant</h2>
        <button type="button" className="atelier-icon-button" aria-label="Close shop assistant" onClick={() => dialog.current?.close()}><Icon name="close" /></button>
      </header>
      <div ref={log} className="atelier-assistant-log" role="log" aria-label="Conversation">
        <p>Ask about products {selectedStore ? `at ${selectedStore.name}` : 'at your selected store'}, alternatives, or checkout holds.</p>
        {turns.map((turn, index) => <div className="atelier-assistant-message" data-role={turn.role} key={index}>
          <strong>{turn.role === 'user' ? 'You' : 'Assistant'}</strong><p>{turn.text}</p>
          {turn.suggestions?.length ? <div className="atelier-assistant-suggestions">
            {turn.suggestions.map(product => <Link key={product.productId}
              href={`/search?q=${encodeURIComponent(product.name)}`}
              onClick={() => dialog.current?.close()}>
              <span>{product.name}</span><small>₹{(product.pricePaise / 100).toFixed(2)} · {product.pack.quantity} {product.pack.unit} · {product.available} in stock</small>
            </Link>)}
          </div> : null}
        </div>)}
        {pending && <p>Writing a reply…</p>}
      </div>
      <form onSubmit={send} className="atelier-assistant-controls">
          <label htmlFor="shop-assistant-message">Your message</label>
          <div className="atelier-assistant-input">
            <input autoFocus id="shop-assistant-message" className="atelier-input" value={message} maxLength={500} required
              onChange={event => setMessage(event.target.value)} readOnly={pending} placeholder="Which dal or rice is available at my store?" />
            <button type="submit" disabled={pending || !message.trim()} className="atelier-action">Send</button>
          </div>
          {error && <p role="status">{error}</p>}
      </form>
      <footer><span>AI answers can be wrong.</span><Link href="/search" onClick={() => dialog.current?.close()}>Check live offers <Icon name="upRight" size={12} /></Link></footer>
    </dialog>
  </>;
}
