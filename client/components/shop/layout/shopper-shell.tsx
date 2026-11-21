'use client';

import React from 'react';
import { Header } from './header';
import { Footer } from './footer';
import { StoreModal } from '../store-selector/store-modal';
import { BranchSwitchDialog } from '../cart/branch-switch-dialog';
import { useStore } from '@/lib/session/store-context';

export function ShopperShell({ children }: { children: React.ReactNode }) {
  const { isStoreModalOpen, closeStoreModal, error } = useStore();

  return (
    <div className="atelier-shopper min-h-screen flex flex-col antialiased">
      <Header />
      <main className="atelier-shop-main flex-1">
        {error && <p role="alert" className="mb-4 border border-[#dcd6c9] bg-[#f3eee5] p-3">{error}</p>}
        {children}
      </main>
      <Footer />

      <StoreModal
        isOpen={isStoreModalOpen}
        onClose={closeStoreModal}
      />
      <BranchSwitchDialog />
    </div>
  );
}
