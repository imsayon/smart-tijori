'use client';

import React from 'react';
import { Header } from './header';
import { Footer } from './footer';
import { StoreModal } from '../store-selector/store-modal';
import { BranchSwitchDialog } from '../cart/branch-switch-dialog';
import { useStore } from '@/lib/session/store-context';

export function ShopperShell({ children }: { children: React.ReactNode }) {
  const { isStoreModalOpen, closeStoreModal } = useStore();

  return (
    <div className="min-h-screen flex flex-col bg-[#FAF8F5] text-stone-900 antialiased selection:bg-lime-200">
      <Header />
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
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
