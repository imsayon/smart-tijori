'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon, Wordmark } from '@/components/ui/atelier';
import { useStore } from '@/lib/session/store-context';

export function Header({ onOpenStoreSelector }: { onOpenStoreSelector?: () => void }) {
  const pathname = usePathname();
  const { selectedStore, cartItemCount, openStoreModal } = useStore();

  return <>
    <div className="atelier-ribbon"><span>THE NEIGHBOURHOOD EDITION</span><span>STOCK YOU CAN TRUST. SHOP LOCAL.</span><span>WALNUT ATELIER&nbsp; / &nbsp;INDIA</span></div>
    <header className="atelier-shop-top">
      <Wordmark href="/" />
      <nav aria-label="Shop navigation" className="atelier-shop-nav">
        <Link href="/" aria-current={pathname === '/' ? 'page' : undefined}>Discover</Link>
        <Link href="/search" aria-current={pathname === '/search' ? 'page' : undefined}>Shop products</Link>
        <Link href="/stores" aria-current={pathname === '/stores' ? 'page' : undefined}>Our stores</Link>
        <Link href="/#stock">How it works</Link>
        <Link href="/ops">For merchants <Icon name="upRight" size={13} /></Link>
      </nav>
      <div className="atelier-shop-tools">
        <button type="button" className="atelier-branch-select" onClick={onOpenStoreSelector ?? openStoreModal}
          aria-label={`Current branch: ${selectedStore?.name ?? 'Choose a branch'}. Change branch`}>
          <Icon name="pin" size={15} /><span>{selectedStore?.name ?? 'Choose a branch'}</span><span aria-hidden="true">⌄</span>
        </button>
        <Link className="atelier-shop-icon" href="/search" aria-label="Search products"><Icon name="search" /></Link>
        <Link className="atelier-profile-link" href="/account" aria-label="Your account"><Icon name="person" size={18} /></Link>
        <details className="atelier-shop-menu">
          <summary className="atelier-shop-icon" aria-label="Open menu" title="Menu"><Icon name="menu" /></summary>
          <nav aria-label="More shop links" className="atelier-shop-popover">
            <p className="atelier-label">Your shop</p>
            <Link href="/"><Icon name="shop" />Discover</Link>
            <Link href="/search"><Icon name="shelf" />Shop products</Link>
            <Link href="/#stock"><Icon name="lock" />How it works</Link>
            <Link href="/stores"><Icon name="pin" />Choose a branch</Link>
            <Link href="/orders"><Icon name="receipt" />Orders</Link>
            <Link href="/account"><Icon name="person" />Account</Link>
            <Link href="/ops"><Icon name="shelf" />Retail workspace<Icon name="upRight" size={13} /></Link>
          </nav>
        </details>
        <Link className="atelier-bag-link" href="/cart" aria-label={`Bag with ${cartItemCount} items`}>
          <span>Bag</span><b>{cartItemCount}</b><Icon name="arrow" size={14} />
        </Link>
      </div>
    </header>
  </>;
}
