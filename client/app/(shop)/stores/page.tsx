'use client';

import { useMemo, useState } from 'react';
import { useStore } from '@/lib/session/store-context';
import { BranchCard } from '@/components/shop/store-selector/branch-card';
import { Alert } from '@/components/shop/feedback/alert';

export default function StoresPage() {
  const { availableStores, selectedStoreId, selectStore } = useStore();
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
      <p className="atelier-directory-intro">Discover neighbourhood markets, corner kiranas and grocers. Select a branch to browse its own product catalogue.</p>
      <Alert type="info" className="mb-6">
        Store stock is separate for every branch. Changing branches clears an incompatible cart; a cart alone does not hold inventory.
      </Alert>
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
      <p className="atelier-store-count" role="status">{matches.length} stores found</p>
      <div className="atelier-directory-grid">
        {matches.map(store => <BranchCard key={store.id} store={store}
          isSelected={selectedStoreId === store.id} onSelect={() => selectStore(store)} />)}
        {!matches.length && <p className="atelier-store-empty">No stores found. Try another search or city.</p>}
      </div>
      <p className="atelier-store-note">Locations may contain clearly labelled demo outlets. Their inventories are illustrative, not claims of real-world availability.</p>
    </div>
  );
}
