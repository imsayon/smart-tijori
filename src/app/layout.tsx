import type { Metadata } from 'next';
import './globals.css';
import { StoreProvider } from '@/lib/session/store-context';
import { ShopperShell } from '@/components/shop/layout/shopper-shell';

export const metadata: Metadata = {
  title: 'SmartTijori — One Stock Truth. Every Channel.',
  description:
    'Omnichannel neighborhood retail with ShelfSync atomic stock guarantees, CartLock checkout holds, and ZeroDeadEnd recovery.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col font-sans" suppressHydrationWarning>
        <StoreProvider>
          <ShopperShell>{children}</ShopperShell>
        </StoreProvider>
      </body>
    </html>
  );
}
