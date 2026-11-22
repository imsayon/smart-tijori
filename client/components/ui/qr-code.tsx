'use client';

import { useMemo } from 'react';
import { qrcodegen } from '@/lib/qr/qrcodegen';

type Props = { value: string; label: string; size?: number };

/** Locally encoded QR; no order identifiers are sent to a third-party image service. */
export function QrCode({ value, label, size = 220 }: Props) {
  const qr = useMemo(() => qrcodegen.QrCode.encodeText(value, qrcodegen.QrCode.Ecc.MEDIUM), [value]);
  const path = useMemo(() => {
    const modules: string[] = [];
    for (let row = 0; row < qr.size; row++) {
      for (let col = 0; col < qr.size; col++) {
        if (qr.getModule(col, row)) modules.push(`M${col + 4} ${row + 4}h1v1h-1z`);
      }
    }
    return modules.join('');
  }, [qr]);

  return (
    <svg className="st-order-qr-code" viewBox={`0 0 ${qr.size + 8} ${qr.size + 8}`}
      xmlns="http://www.w3.org/2000/svg" width={size} height={size}
      role="img" aria-label={label} shapeRendering="crispEdges">
      <rect width={qr.size + 8} height={qr.size + 8} fill="#fff" />
      <path d={path} fill="#19382b" />
    </svg>
  );
}
