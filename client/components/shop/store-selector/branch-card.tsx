import type { Store } from '@/contracts';

export function BranchCard({ store, isSelected, onSelect }: {
  store: Store; isSelected: boolean; onSelect: () => void;
}) {
  const illustrative = store.id.startsWith('dm-');
  return (
    <button type="button" onClick={onSelect} aria-pressed={isSelected}
      className={`atelier-store-card ${isSelected ? 'is-selected' : ''}`}>
      <span className="atelier-store-initial" aria-hidden="true">{store.name.slice(0, 1).toUpperCase()}</span>
      <span className="atelier-store-card-details">
        <span className="atelier-store-card-name">{store.name}</span>
        <span className="atelier-store-card-location">{[store.area, store.city].filter(Boolean).join(' · ')}</span>
        {store.address && <span className="atelier-store-card-address">{store.address}</span>}
        {illustrative && <span className="atelier-store-demo-label">Illustrative availability · Retailer not verified</span>}
      </span>
      <span className={`atelier-store-card-action ${isSelected ? 'is-selected' : ''}`}>
        {isSelected ? 'Selected ✓' : 'Select ↗'}
      </span>
    </button>
  );
}
