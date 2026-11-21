import type { Store } from '@/contracts';

export function BranchCard({ store, isSelected, onSelect }: {
  store: Store; isSelected: boolean; onSelect: () => void;
}) {
  const demo = /\bdemo\b/i.test(store.name);
  return (
    <button type="button" onClick={onSelect} aria-pressed={isSelected}
      className={`atelier-store-card ${isSelected ? 'is-selected' : ''}`}>
      <span className="atelier-store-initial" aria-hidden="true">{store.name.replace(/^Demo · /i, '').slice(0, 1).toUpperCase()}</span>
      <span className="atelier-store-card-details">
        <span className="atelier-store-card-name">{store.name}</span>
        <span className="atelier-store-card-location">{[store.area, store.city].filter(Boolean).join(' · ')}</span>
        {store.address && <span className="atelier-store-card-address">{store.address}</span>}
        {demo && <span className="atelier-store-demo-label">SAMPLE LOCATION · DEMO STOCK</span>}
      </span>
      <span className={`atelier-store-card-action ${isSelected ? 'is-selected' : ''}`}>
        {isSelected ? 'Selected ✓' : 'Select ↗'}
      </span>
    </button>
  );
}
