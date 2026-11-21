'use client';

import React, { useRef, type ReactNode } from 'react';
import { animate } from 'animejs';

interface Interactive3DCardProps {
  children: ReactNode;
  className?: string;
  maxTiltDeg?: number;
  scaleHover?: number;
}

export function Interactive3DCard({
  children,
  className = '',
  maxTiltDeg = 7,
  scaleHover = 1.018,
}: Interactive3DCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }
    const card = cardRef.current;
    if (!card) return;

    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const rotateX = ((y - centerY) / centerY) * -maxTiltDeg;
    const rotateY = ((x - centerX) / centerX) * maxTiltDeg;

    animate(card, {
      rotateX,
      rotateY,
      scale: scaleHover,
      duration: 180,
      ease: 'outQuad',
    });
  };

  const handlePointerLeave = () => {
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }
    const card = cardRef.current;
    if (!card) return;

    animate(card, {
      rotateX: 0,
      rotateY: 0,
      scale: 1,
      duration: 380,
      ease: 'outElastic(1, .6)',
    });
  };

  return (
    <div className="atelier-perspective">
      <div
        ref={cardRef}
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
        className={`atelier-3d-card ${className}`}
      >
        {children}
      </div>
    </div>
  );
}
