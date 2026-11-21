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

export function OpsShell({ children, operator, fixture, branchName }: {
  children: ReactNode; operator: OperatorActor | null; fixture: boolean; branchName?: string;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const currentView = views.find(view => view.href === pathname) ?? views[0];
  const [query, setQuery] = useState('');
  const command = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (!operator) return;
    function shortcut(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setQuery('');
        if (command.current?.open) command.current.close();
        else command.current?.showModal();
      }
      if (event.key === 'Escape') setMobileOpen(false);
    }
    window.addEventListener('keydown', shortcut);
    return () => window.removeEventListener('keydown', shortcut);
  }, [operator]);

  return (
    <div className="atelier-ops" data-layout={operator ? 'rail' : 'access'}
      data-mobile-open={mobileOpen ? 'true' : 'false'}>
      <a className="atelier-skip" href="#workspace">Skip to content</a>

      {operator && <>
        <aside className="atelier-rail" id="workspace-sidebar" aria-label="Retail workspace sidebar">
          <div className="atelier-rail-head">
            <Wordmark href="/ops" dark />
            <span className="atelier-rail-edition">THE NEIGHBOURHOOD OS / 02</span>
          </div>

          <div className="atelier-rail-branch">
            <span className="atelier-rail-branch-icon" aria-hidden="true">
              {(operator.storeId ?? 'ST').slice(0, 2).toUpperCase()}
            </span>
            <div>
              <strong>{branchName ?? operator.storeId}</strong>
              <span>YOUR ACTIVE WORKSPACE</span>
            </div>
          </div>

          <div className="atelier-rail-heading">
            <span>WORKSPACE</span><span>01 / 03</span>
          </div>
          <nav className="atelier-rail-nav" aria-label="Operations Navigation">
            {views.map((view, index) => (
              <Link href={view.href} key={view.href}
                aria-current={pathname === view.href ? 'page' : undefined}
                onClick={() => setMobileOpen(false)}>
                <Icon name={view.icon} size={16} />
                <span>{view.title === 'Point of sale' ? 'POS' : view.title}</span>
                <small aria-hidden="true">{String(index + 1).padStart(2, '0')}</small>
              </Link>
            ))}
          </nav>

          <div className="atelier-rail-bottom">
            <div className="atelier-rail-promise">
              <span aria-hidden="true">✳</span>
              <strong>One inventory.<br /><em>Every counter.</em></strong>
              <small>STOCK YOU CAN TRUST.</small>
            </div>
            <Link href="/" onClick={() => setMobileOpen(false)}>
              <Icon name="shop" size={16} /> Shopper storefront <Icon name="upRight" size={14} />
            </Link>
            <p className="atelier-rail-identity">{operator.operatorId}</p>
          </div>
        </aside>
        <button type="button" className="atelier-rail-scrim"
          aria-label="Close workspace menu" onClick={() => setMobileOpen(false)} />
      </>}

      <div className="atelier-ops-stage">
        <header className="atelier-ops-top">
          {operator ? <>
            <div className="atelier-ops-crumb-wrap">
              <button type="button" className="atelier-rail-toggle"
                aria-label={mobileOpen ? 'Close workspace navigation' : 'Open workspace navigation'}
                aria-expanded={mobileOpen}
                aria-controls="workspace-sidebar"
                onClick={() => setMobileOpen(value => !value)}>
                <Icon name={mobileOpen ? 'close' : 'menu'} size={20} />
              </button>
              <span className="atelier-crumb">
                <span>SMARTTIJORI</span><span aria-hidden="true">/</span>
                <strong>{currentView.title}</strong>
              </span>
            </div>
            <div className="atelier-ops-tools">
              <button type="button" className="atelier-search-trigger" aria-label="Search workspace"
                onClick={() => { setQuery(''); command.current?.showModal(); }}>
                <Icon name="search" size={16} /><span>Search workspace</span><kbd>⌘ K</kbd>
              </button>
              <span className="atelier-branch-chip" title={branchName ?? operator.storeId}>
                <Icon name="pin" size={15} /><span>{branchName ?? operator.storeId}</span>
              </span>
              {fixture && <span className="atelier-tag atelier-tag-warn">Demo mode</span>}
              <details className="atelier-top-menu atelier-profile-menu">
                <summary aria-label={'Account menu for ' + operator.operatorId} title="Merchant account">
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
          </> : <>
            <Wordmark href="/ops" />
            <Link href="/" className="atelier-top-shop">Shop <Icon name="arrow" size={14} /></Link>
          </>}
        </header>

        <main className="atelier-ops-main" id="workspace">{children}</main>
      </div>

      {operator && <dialog className="atelier-command" ref={command}
        onClick={event => { if (event.target === command.current) command.current?.close(); }}>
        <header><label htmlFor="workspace-search">Find a workspace page</label>
          <form method="dialog"><button type="submit" className="atelier-icon-button"
            aria-label="Close page search"><Icon name="close" /></button></form>
        </header>
        <input id="workspace-search" className="atelier-input" type="search"
          placeholder="Inventory, orders, point of sale…" value={query}
          onChange={event => setQuery(event.target.value)} />
        <div className="atelier-command-links">
          {views.filter(view => view.title.toLowerCase().includes(query.trim().toLowerCase())).map(view => (
            <Link key={view.href} href={view.href} onClick={() => command.current?.close()}>
              <Icon name={view.icon} />{view.title}<Icon name="arrow" size={14} />
            </Link>
          ))}
          {!views.some(view => view.title.toLowerCase().includes(query.trim().toLowerCase())) &&
            <p>No matching pages.</p>}
        </div>
      </dialog>}
    </div>
  );
}
