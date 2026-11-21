import { StoreProvider } from '@/lib/session/store-context';
import { ShopperShell } from '@/components/shop/layout/shopper-shell';

export default function ShopLayout({ children }: { children: React.ReactNode }) {
  return <StoreProvider><ShopperShell>{children}</ShopperShell></StoreProvider>;
}
