import type { ReactNode } from 'react';
import Link from 'next/link';

const paths = {
  arrow: 'M4 12h15m-6-6 6 6-6 6',
  upRight: 'M6 18 18 6M8 6h10v10',
  overview: 'M4 4h6v6H4zm10 0h6v6h-6zM4 14h6v6H4zm10 0h6v6h-6z',
  shelf: 'M4 4h16v16H4zM4 10h16M4 15h16',
  terminal: 'M4 5h16v14H4zm4 4 3 3-3 3m6 0h2',
  clock: 'M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0ZM12 6v6l4 2',
  receipt: 'M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6',
  pulse: 'M2 12h5l3-7 4 14 3-7h5',
  shop: 'M5 9h14l1 11H4zm4 0V6a3 3 0 1 1 6 0v3',
  pin: 'M19 10c0 5-7 10-7 10S5 15 5 10a7 7 0 1 1 14 0zM14 10a2 2 0 1 1-4 0 2 2 0 0 1 4 0z',
  search: 'M16 10a6 6 0 1 1-12 0 6 6 0 0 1 12 0zm-2 5 6 6',
  lock: 'M6 10h12v11H6zm3 0V6a3 3 0 1 1 6 0v4m-3 5v2',
  menu: 'M4 6h16M4 12h16M4 18h16',
  close: 'M6 6l12 12M18 6 6 18',
  refresh: 'M20 11a8 8 0 1 0-2 7M20 5v6h-6',
  database: 'M4 6a8 3 0 1 0 16 0 8 3 0 1 0-16 0zm0 0v12a8 3 0 1 0 16 0V6M4 12a8 3 0 0 0 16 0',
  package: 'M12 2 3 7v10l9 5 9-5V7zM3 7l9 5 9-5m-9 5v10',
  person: 'M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0zM4 21v-2a8 8 0 0 1 16 0v2',
  bars: 'M3 6v12m3-12v12m4-12v12m2-12v12m4-12v12m4-12v12',
  check: 'm4 12 5 5L20 6',
} as const;

export type IconName = keyof typeof paths;

export function Icon({ name, size = 17 }: { name: IconName; size?: number }) {
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.55" strokeLinecap="round" strokeLinejoin="round">
    <path d={paths[name]} />
  </svg>;
}

export function Wordmark({ href = '/', dark = false }: { href?: string; dark?: boolean }) {
  return <Link href={href} className={`atelier-wordmark${dark ? ' atelier-wordmark-light' : ''}`}>
    <span className="atelier-mark" aria-hidden="true">✳</span>
    <span aria-label="SmartTijori"><b>smart</b>tijori<span aria-hidden="true">.</span></span>
  </Link>;
}

export function AtelierTitle({ lead, accent, description, tools, context }: {
  lead: string; accent?: string; description?: string; tools?: ReactNode; context?: string;
}) {
  return <header className="atelier-page-heading">
    <div>
      {context && <p className="atelier-label">{context}</p>}
      <h1 className="atelier-heading">{lead}{accent && <> <em>{accent}</em></>}</h1>
      {description && <p className="atelier-page-description">{description}</p>}
    </div>
    {tools && <div className="atelier-tools">{tools}</div>}
  </header>;
}
