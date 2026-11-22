'use client';

import type { CartLine } from '@/contracts';
import { formatPaise } from '@/lib/utils/currency';
import { Icon } from '@/components/ui/atelier';

interface CartLineItemProps {
  line: CartLine;
  index?: number;
  onUpdateQuantity: (quantity: number) => void;
  onRemove: () => void;
}

export function CartLineItem({ line, index, onUpdateQuantity, onRemove }: CartLineItemProps) {
  return <article className="st-cart-item">
    <div className="st-cart-item-illustration" aria-hidden="true">
      <div className="st-cart-item-orbit"/><Icon name="package" size={30}/>
    </div>
    <div className="st-cart-item-details">
      <span className="st-overline">{index ? `SELECTION / ${String(index).padStart(2,'0')}` : 'LOCAL SHELF / SELECTED'}</span>
      <h3>{line.name}</h3>
      <p>{formatPaise(line.unitPricePaise)} per item</p>
    </div>
    <div className="st-cart-item-controls">
      <div className="st-quantity-controls" role="group" aria-label={`Quantity for ${line.name}`}>
        <button type="button" onClick={() => onUpdateQuantity(line.quantity - 1)} aria-label={`Decrease quantity of ${line.name}`}>−</button>
        <span aria-live="polite">{line.quantity}</span>
        <button type="button" onClick={() => onUpdateQuantity(line.quantity + 1)} aria-label={`Increase quantity of ${line.name}`}>+</button>
      </div>
      <strong className="st-cart-item-price">{formatPaise(line.unitPricePaise * line.quantity)}</strong>
      <button type="button" onClick={onRemove} className="st-cart-item-remove" aria-label={`Remove ${line.name} from cart`} title="Remove from bag">
        <Icon name="close" size={16}/>
      </button>
    </div>
  </article>;
}
