'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { ProductOffer } from '@/contracts';
import { formatPaise } from '@/lib/utils/currency';
import { useStore } from '@/lib/session/store-context';
import { ProductImage } from './product-image';
import { StockBadge } from './stock-badge';

export function ProductCard({ offer }: { offer: ProductOffer }) {
  const { cart, addToCart, updateCartQuantity } = useStore();
  const [pending, setPending] = useState(false);
  const inCart = cart?.lines.find(line => line.productId === offer.productId)?.quantity ?? 0;
  const unavailable = offer.available <= 0;

  async function changeQuantity(next: number) {
    if (pending || next > offer.available || next < 0) return;
    setPending(true);
    try {
      if (inCart === 0 && next === 1) await addToCart(offer, 1);
      else await updateCartQuantity(offer.productId, next);
    } catch {
      // The shared store context publishes the actionable request error.
    } finally {
      setPending(false);
    }
  }

  return (
    <article className="atelier-product-card group" data-product-id={offer.productId}>
      <Link className="atelier-product-media" href={`/products/${offer.productId}`}
        aria-label={`View ${offer.name}`}>
        <ProductImage key={offer.imageUrl} offer={offer} />
        <span className="atelier-product-stock"><StockBadge available={offer.available} /></span>
        <span className="atelier-product-view" aria-hidden="true">↗</span>
      </Link>
      <div className="atelier-product-body">
        <div className="atelier-product-eyebrow">
          <span>{offer.category}</span><span>{offer.pack.quantity} {offer.pack.unit}</span>
        </div>
        <Link href={`/products/${offer.productId}`}>
          <h3>{offer.name}</h3>
        </Link>
        <p className="atelier-product-purpose">{offer.purpose.replaceAll('-', ' ')}</p>
        <div className="atelier-product-bottom">
          <strong>{formatPaise(offer.pricePaise)}</strong>
          {unavailable ? <Link className="atelier-product-restock" href={`/interest?storeId=${encodeURIComponent(offer.storeId)}&productId=${encodeURIComponent(offer.productId)}`}>
            Notify me
          </Link> : inCart === 0 ? <button className="atelier-product-add" type="button"
            aria-label={`+ Add to cart — ${offer.name}`} disabled={!cart || pending}
            onClick={() => void changeQuantity(1)}>{pending ? '…' : '+'}<span>Add</span></button> :
          <div className="atelier-product-stepper" aria-label={`Quantity of ${offer.name}`}>
            <button aria-label={`Remove one ${offer.name}`} type="button" disabled={pending}
              onClick={() => void changeQuantity(inCart - 1)}>−</button>
            <span aria-live="polite">{inCart}</span>
            <button aria-label={`Add one ${offer.name}`} type="button"
              disabled={pending || inCart >= offer.available}
              onClick={() => void changeQuantity(inCart + 1)}>+</button>
          </div>}
        </div>
      </div>
    </article>
  );
}
