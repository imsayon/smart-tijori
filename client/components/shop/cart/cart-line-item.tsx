'use client';

import type { CartLine } from '@/contracts';
import { Icon } from '@/components/ui/atelier';
import { formatPaise } from '@/lib/utils/currency';

interface CartLineItemProps {
  line: CartLine;
  index?: number;
  onUpdateQuantity: (quantity: number) => void;
  onRemove: () => void;
}

function initials(name: string) {
  const parts = name.replace(/[^\p{L}\p{N} ]/gu, ' ').split(/\s+/).filter(Boolean);
  return (parts.length > 1 ? parts[0][0] + parts[1][0] : name.slice(0, 2)).toUpperCase();
}

export function CartLineItem({ line, index = 0, onUpdateQuantity, onRemove }: CartLineItemProps) {
  return (
    <article className="st-cart-line">
      <div className="st-cart-line-art" aria-hidden="true">
        <span className="st-cart-line-art-arc" />
        <span className="st-cart-line-monogram">{initials(line.name)}</span>
        <span className="st-cart-line-art-index">{String(index + 1).padStart(2, '0')}</span>
      </div>
      <div className="st-cart-line-details">
        <span className="st-kicker">LOCAL PICK / {String(index + 1).padStart(2, '0')}</span>
        <h3>{line.name}</h3>
        <p>{formatPaise(line.unitPricePaise)} per item</p>
      </div>
      <div className="st-cart-line-end">
        <div className="st-quantity" role="group" aria-label={`Quantity for ${line.name}`}>
          <button type="button" onClick={() => onUpdateQuantity(line.quantity - 1)}
            aria-label={`Decrease quantity of ${line.name}`} disabled={line.quantity < 1}>−</button>
          <output aria-label="Quantity">{line.quantity}</output>
          <button type="button" onClick={() => onUpdateQuantity(line.quantity + 1)}
            aria-label={`Increase quantity of ${line.name}`}>+</button>
        </div>
        <div className="st-cart-line-price">
          <strong>{formatPaise(line.unitPricePaise * line.quantity)}</strong>
          <span>Line total</span>
        </div>
        <button type="button" className="st-remove-item" onClick={onRemove}
          aria-label={`Remove ${line.name} from cart`} title={`Remove ${line.name}`}>
          <Icon name="close" size={15} />
        </button>
      </div>
    </article>
  );
}
