'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon, Wordmark, type IconName } from '@/components/ui/atelier';
import type { OperatorActor } from '@server/http/auth/operator-guard';
import { AccountAccess } from '@/components/account/account-access';

const views: { title: string; href: string; icon: IconName }[] = [
  { title: 'Overview', href: '/ops', icon: 'overview' },
  { title: 'Inventory', href: '/ops/inventory', icon: 'shelf' },
  { title: 'Point of sale', href: '/ops/pos', icon: 'terminal' },
  { title: 'Activity', href: '/ops/diagnostics', icon: 'pulse' },
  { title: 'Reservations', href: '/ops/reservations', icon: 'clock' },
  { title: 'Orders', href: '/ops/orders', icon: 'receipt' },
];
const primaryViews = views.slice(0, 4);

export function OpsShell({ children, operator, fixture, branchName }: {
  children: ReactNode; operator: OperatorActor | null; fixture: boolean; branchName?: string;
}) {
  const pathname = usePathname();
  const [query, setQuery] = useState('');
  const command = useRef<HTMLDialogElement>(null);
  const openSearch = () => {
    setQuery('');
    command.current?.showModal();
  };

  useEffect(() => {
    if (!operator) return;
    function shortcut(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        if (command.current?.open) command.current.close();
        else openSearch();
      }
    }
    window.addEventListener('keydown', shortcut);
    return () => window.removeEventListener('keydown', shortcut);
  }, [operator]);

  return (
    <div className="atelier-ops">
      <a className="atelier-skip" href="#workspace">Skip to content</a>
      <header className="atelier-ops-top">
        <Wordmark href="/ops" />
        {operator ? <>
          <nav id="workspace-navigation" aria-label="Operations Navigation" className="atelier-ops-nav">
            {primaryViews.map(view => <Link key={view.href} href={view.href}
              aria-current={pathname === view.href ? 'page' : undefined}>
              <span>{view.title === 'Point of sale' ? 'POS' : view.title}</span>
            </Link>)}
          </nav>
          <div className="atelier-ops-tools">
            <span className="atelier-branch-chip" title={branchName ?? operator.storeId}>
              <Icon name="pin" size={15} /><span>{branchName ?? operator.storeId}</span>
            </span>
            {fixture && <span className="atelier-tag atelier-tag-warn">Demo mode</span>}
            <button type="button" className="atelier-top-icon" aria-label="Search workspace" onClick={openSearch}>
              <Icon name="search" />
            </button>
            <details className="atelier-top-menu">
              <summary className="atelier-top-icon" aria-label="Open workspace menu" title="Workspace menu"><Icon name="menu" /></summary>
              <div className="atelier-top-popover">
                <p className="atelier-label">Workspace</p>
                {views.slice(4).map(view => <Link key={view.href} href={view.href} aria-current={pathname === view.href ? 'page' : undefined}>
                  <Icon name={view.icon} />{view.title}<Icon name="arrow" size={14} />
                </Link>)}
                <Link href="/" className="atelier-popover-shop"><Icon name="shop" />Shopper storefront<Icon name="upRight" size={13} /></Link>
              </div>
            </details>
            <details className="atelier-top-menu atelier-profile-menu">
              <summary aria-label={`Account menu for ${operator.operatorId}`} title="Merchant account">
                {operator.operatorId.slice(0, 2).toUpperCase()}
              </summary>
              <div className="atelier-top-popover atelier-profile-popover">
                <p className="atelier-label">Merchant account</p>
                <strong>{operator.operatorId}</strong>
                <span>{operator.storeId}</span>
                {!fixture && <AccountAccess merchant signedIn />}
              </div>
            </details>
          </div>
        </> : <div className="atelier-ops-tools">
          <Link className="atelier-top-shop" href="/">Shop <Icon name="arrow" size={14} /></Link>
        </div>}
      </header>
      <main className="atelier-ops-main" id="workspace">{children}</main>
      {operator && <dialog className="atelier-command" ref={command}>
        <header><label htmlFor="workspace-search">Find a workspace page</label>
          <form method="dialog"><button type="submit" className="atelier-icon-button" aria-label="Close page search"><Icon name="close" /></button></form>
        </header>
        <input id="workspace-search" className="atelier-input" type="search" placeholder="Inventory, orders, point of sale…" value={query}
          onChange={event => setQuery(event.target.value)} />
        <div className="atelier-command-links">
          {views.filter(view => view.title.toLowerCase().includes(query.trim().toLowerCase())).map(view => (
            <Link key={view.href} href={view.href} onClick={() => command.current?.close()}>
              <Icon name={view.icon} />{view.title}<Icon name="arrow" size={14} />
            </Link>
          ))}
          {!views.some(view => view.title.toLowerCase().includes(query.trim().toLowerCase())) && <p>No matching pages.</p>}
        </div>
      </dialog>}
    </div>
  );
}
