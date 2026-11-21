import type { Metadata } from 'next';
import './globals.css';
import { StoreProvider } from '@/lib/session/store-context';
import { ShopperShell } from '@/components/shop/layout/shopper-shell';

export const metadata: Metadata = {
  title: 'SmartTijori',
  description:
    'Shop pantry and household essentials at your local branch.',
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
