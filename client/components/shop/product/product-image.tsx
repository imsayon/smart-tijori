'use client';

import Image from 'next/image';
import { useState } from 'react';
import type { ProductOffer } from '@/contracts';

function ProductIllustration({ offer }: { offer: ProductOffer }) {
  const purpose = offer.purpose.toLowerCase();
  const produce = /fresh|fruit|vegetable|leafy|onion|potato|tomato|banana|lemon|apple/.test(purpose);
  const cleaning = offer.category === 'household' || /cleaner|detergent|dishwash|laundry/.test(purpose);
  const label = offer.category === 'pantry' ? 'Everyday pantry' : cleaning ? 'Home essentials' : 'Neighbourhood finds';

  return <div className="atelier-product-illustration" aria-hidden="true">
    <svg viewBox="0 0 240 210" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
      <ellipse cx="120" cy="175" rx="75" ry="12" fill="#39523c" opacity=".13" />
      {produce ? <>
        <circle cx="98" cy="115" r="45" fill="#6c9661" stroke="#405f48" strokeWidth="1.8"/>
        <circle cx="148" cy="127" r="37" fill="#a9b875" stroke="#536c4c" strokeWidth="1.8"/>
        <path d="M96 76c-17-18-15-34 3-34 7 0 13 10 13 21-8-6-14-7-16 13z" fill="#476d48"/>
        <path d="M148 90c8-24 18-24 27-22-7 12-12 18-27 22z" fill="#567a4e"/>
        <path d="M75 124c9-6 17-6 26 0M128 141c8-5 15-5 22 0" stroke="#ecf1dd" strokeOpacity=".4" strokeWidth="2" fill="none"/>
      </> : cleaning ? <>
        <path d="M98 44h45v21l15 24v71a13 13 0 0 1-13 13H92a13 13 0 0 1-13-13V89l19-24z"
          fill="#86a69a" stroke="#486e60" strokeWidth="2"/>
        <path d="M100 35h42v17h-42z" fill="#416f62"/>
        <path d="M79 96h79v53H79z" fill="#e8eddb" opacity=".94"/>
        <path d="M94 115h48M94 124h39M94 133h44" stroke="#76968a" strokeWidth="3" opacity=".8"/>
        <circle cx="184" cy="65" r="10" fill="none" stroke="#728f83" strokeWidth="2" opacity=".65"/>
        <circle cx="197" cy="48" r="5" fill="none" stroke="#728f83" strokeWidth="1.5" opacity=".65"/>
      </> : <>
        <path d="M73 76q47-18 94 0l13 99H60z" fill="#decaa5" stroke="#a58c6f" strokeWidth="2"/>
        <path d="M73 76q48 14 94 0M82 77l-7 92M158 77l9 92" stroke="#b69f7c" strokeWidth="1.5" fill="none"/>
        <path d="M86 106h68v44H86z" fill="#ecede0" stroke="#b2bd9b"/>
        <circle cx="120" cy="126" r="12" fill="#8da878"/>
        <path d="M103 145h34" stroke="#8da878" strokeWidth="2"/>
        <path d="M75 75q43-31 88 0" fill="none" stroke="#8a755f" strokeWidth="6"/>
      </>}
    </svg>
    <span className="atelier-product-illustration-note">{label}</span>
  </div>;
}

export function ProductImage({ offer }: { offer: ProductOffer }) {
  const [failed, setFailed] = useState(false);
  const safeUrl = /^https:\/\//i.test(offer.imageUrl) || /^\/(?![\/\\])/.test(offer.imageUrl);
  return !failed && safeUrl ? (
    <Image src={offer.imageUrl} alt={offer.name} fill sizes="(max-width: 768px) 45vw, 288px"
      unoptimized className="object-contain p-3" referrerPolicy="no-referrer" onError={() => setFailed(true)} />
  ) : <ProductIllustration offer={offer} />;
}
