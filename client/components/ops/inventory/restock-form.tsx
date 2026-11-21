'use client';

import { useRef, useState, type FormEvent } from 'react';

export function RestockForm({ products, onRestocked }: {
  products: { productId: string }[];
  onRestocked: () => Promise<void>;
}) {
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const attempt = useRef<{ body: string; key: string } | null>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    const body = JSON.stringify({ productId: fields.get('sku'), quantity: Number(fields.get('quantity')) });
    if (attempt.current && attempt.current.body !== body) {
      setMessage('Retry the previous product and quantity first. Its result is still unknown.');
      return;
    }
    attempt.current ??= { body, key: crypto.randomUUID() };
    setBusy(true);
    setMessage('');
    try {
      const result = await fetch('/api/ops/restock', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': attempt.current.key },
        body,
      });
      if (result.status >= 500) throw new Error('Restock unavailable');
      const data = await result.json();
      attempt.current = null;
      if (!result.ok) {
        setMessage(data.error?.message ?? 'Restock rejected.');
        return;
      }
      setMessage(`Stock received. ${data.available} units available.`);
      await onRestocked();
    } catch {
      setMessage('Could not verify the restock. Retry with the same product and quantity.');
    } finally {
      setBusy(false);
    }
  }

  if (!products.length) return null;
  return <form onSubmit={submit} className="space-y-3 border border-[#dcd6c9] bg-[#faf7f0] p-4">
    <h2 className="text-lg font-semibold">Receive stock</h2>
    <div className="flex flex-wrap items-end gap-3">
      <label>Product SKU
        <select name="sku" className="atelier-input" required disabled={busy}>
          {products.map(({ productId }) => <option key={productId} value={productId}>{productId}</option>)}
        </select>
      </label>
      <label>Units<input className="atelier-input w-28" type="number" name="quantity" min={1} max={1000} defaultValue={1} required disabled={busy} /></label>
      <button type="submit" className="atelier-action" disabled={busy}>{busy ? 'Receiving…' : 'Receive stock'}</button>
    </div>
    {message && <p role="status">{message}</p>}
  </form>;
}
