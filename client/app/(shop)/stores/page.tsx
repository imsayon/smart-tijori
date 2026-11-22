'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useStore } from '@/lib/session/store-context';
import { BranchCard } from '@/components/shop/store-selector/branch-card';
import { Icon } from '@/components/ui/atelier';

export default function StoresPage() {
  const { availableStores, selectedStoreId, selectStore, isLoading, error } = useStore();
  const [city, setCity] = useState('ALL');
  const [search, setSearch] = useState('');
  const cities = useMemo(() => [...new Set(availableStores.map(store => store.city))]
    .sort((a, b) => a.localeCompare(b, 'en-IN')), [availableStores]);
  const matches = availableStores.filter(store => {
    if (city !== 'ALL' && store.city !== city) return false;
    const q = search.trim().toLocaleLowerCase('en-IN');
    return !q || [store.name, store.city, store.area, store.address]
      .some(value => value?.toLocaleLowerCase('en-IN').includes(q));
  }).sort((a, b) => a.city.localeCompare(b.city, 'en-IN') || a.name.localeCompare(b.name, 'en-IN'));

  return (
    <div className="atelier-directory">
      <p className="atelier-label">SHOP LOCAL / THE INDIA DIRECTORY</p>
      <h1 className="atelier-heading">A good shop <em>closer home.</em></h1>
      <p className="atelier-directory-intro">Find a local market, kirana, or grocer. Each store has its own catalog.</p>
      <div className="atelier-store-filters">
        <label className="atelier-store-search">Shop, locality or city
          <input className="atelier-input" type="search" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search city, kirana, market…" />
        </label>
        <label className="atelier-store-city">City
          <select className="atelier-input" value={city} onChange={e => setCity(e.target.value)}>
            <option value="ALL">All cities ({cities.length})</option>
            {cities.map(name => <option value={name} key={name}>{name}</option>)}
          </select>
        </label>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 my-4">
        <p className="atelier-store-count" role="status">{isLoading ? 'Loading stores…' : error ? 'Stores could not be loaded' : `${matches.length} stores found`}</p>
        {selectedStoreId && <Link href="/search" className="atelier-action">Browse selected store <Icon name="upRight" size={15} /></Link>}
      </div>
      <div className="atelier-directory-grid">
        {matches.map(store => <BranchCard key={store.id} store={store}
          isSelected={selectedStoreId === store.id} onSelect={() => selectStore(store)} />)}
        {!isLoading && !error && !matches.length && <p className="atelier-store-empty">No stores found. Try another search or city.</p>}
      </div>
      <p className="atelier-store-note">Certain outlets are illustrative profiles, not verified retail partners. Availability is based on the selected store record only.</p>
    </div>
  );
}
