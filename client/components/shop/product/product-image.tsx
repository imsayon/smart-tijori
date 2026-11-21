'use client';

import Image from 'next/image';
import { useState } from 'react';
import type { ProductOffer } from '@/contracts';

export function ProductImage({ offer }: { offer: ProductOffer }) {
  const [failed, setFailed] = useState(false);
  const safeUrl = /^https:\/\//i.test(offer.imageUrl) || /^\/(?![\/\\])/.test(offer.imageUrl);
  return !failed && safeUrl ? (
    <Image src={offer.imageUrl} alt={offer.name} fill sizes="(max-width: 768px) 45vw, 288px"
      unoptimized className="object-contain p-3" referrerPolicy="no-referrer" onError={() => setFailed(true)} />
  ) : (
    <span aria-hidden="true" className="atelier-heading w-full px-5 text-center text-[clamp(1.125rem,3vw,2.25rem)] text-[#465a4a]">
      {offer.name}
    </span>
  );
}
