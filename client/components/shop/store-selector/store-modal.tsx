'use client';

import { useEffect, useMemo, useState } from 'react';
import { useStore } from '@/lib/session/store-context';
import { BranchCard } from './branch-card';

interface StoreModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function StoreModal({ isOpen, onClose }: StoreModalProps) {
  const { availableStores, selectedStoreId, selectStore } = useStore();
  const [city, setCity] = useState('ALL');
  const [search, setSearch] = useState('');

  const cities = useMemo(
    () => [...new Set(availableStores.map(store => store.city))].sort((a, b) => a.localeCompare(b, 'en-IN')),
    [availableStores],
  );
  const matches = useMemo(() => availableStores.filter(store => {
    if (city !== 'ALL' && store.city !== city) return false;
    const needle = search.trim().toLocaleLowerCase('en-IN');
    return !needle || [store.name, store.city, store.area, store.address, store.id]
      .some(value => value?.toLocaleLowerCase('en-IN').includes(needle));
  }).sort((a, b) => a.city.localeCompare(b.city, 'en-IN') || a.name.localeCompare(b.name, 'en-IN')),
  [availableStores, city, search]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="atelier-store-backdrop" onMouseDown={event => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section role="dialog" aria-modal="true" aria-labelledby="store-modal-title"
        className="atelier-store-dialog">
        <div className="atelier-store-dialog-head">
          <div>
            <p className="atelier-label">THE NEIGHBOURHOOD DIRECTORY / INDIA</p>
            <h2 id="store-modal-title" className="atelier-heading">Choose your <em>local shop.</em></h2>
            <p>Each branch has its own stock and checkout allocation. Only participating outlets can fulfil orders.</p>
          </div>
          <button className="atelier-icon-button" type="button" onClick={onClose} aria-label="Close store selector">✕</button>
        </div>
        <div className="atelier-store-filters">
          <label className="atelier-store-search">Find a shop, city or neighbourhood
            <input autoFocus className="atelier-input" type="search" value={search}
              onChange={event => setSearch(event.target.value)}
              placeholder="Search Koramangala, Guwahati, kirana…" />
          </label>
          <label className="atelier-store-city">City
            <select className="atelier-input" value={city} onChange={event => setCity(event.target.value)}>
              <option value="ALL">All cities ({cities.length})</option>
              {cities.map(name => <option value={name} key={name}>{name}</option>)}
            </select>
          </label>
        </div>
        <p className="atelier-store-count" role="status">{matches.length} {matches.length === 1 ? 'shop' : 'shops'} found</p>
        <div className="atelier-store-results">
          {matches.length ? matches.map(store => (
            <BranchCard key={store.id} store={store} isSelected={selectedStoreId === store.id}
              onSelect={() => { selectStore(store); onClose(); }} />
          )) : <div className="atelier-store-empty">No stores match those filters. Try another city or locality.</div>}
        </div>
        <p className="atelier-store-note">Switching branches may clear a cart from another store. Illustrative outlets are not verified retail partners.</p>
      </section>
    </div>
  );
}
