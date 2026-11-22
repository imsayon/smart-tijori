'use client';

import { Icon } from '@/components/ui/atelier';
import { useStore } from '@/lib/session/store-context';

export function BranchBanner({ onOpenStoreSelector }: { onOpenStoreSelector?: () => void }) {
  const { selectedStore, openStoreModal } = useStore();
  if (!selectedStore) return null;

  return <div className="atelier-panel flex flex-wrap items-center justify-between gap-4 mb-6 px-5 py-4">
    <div className="flex gap-3 items-start">
      <span className="mt-1"><Icon name="pin" size={18} /></span>
      <div>
        <p className="font-semibold">{selectedStore.name}</p>
        <p className="text-sm text-stone-600">{[selectedStore.area, selectedStore.city, selectedStore.address].filter(Boolean).join(' · ')}</p>
        {selectedStore.id.startsWith('dm-') && <p className="text-sm text-[#6e4731] mt-1">Illustrative store and stock</p>}
      </div>
    </div>
    <button type="button" onClick={onOpenStoreSelector ?? openStoreModal} className="atelier-secondary">
      Change store <Icon name="arrow" size={15} />
    </button>
  </div>;
}
