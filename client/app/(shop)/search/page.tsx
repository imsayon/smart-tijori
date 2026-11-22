import { BranchBanner } from '@/components/shop/navigation/branch-banner';
import { Catalog } from '@/components/shop/catalog/catalog';
import { AtelierTitle } from '@/components/ui/atelier';

export default async function SearchPage({ searchParams }: PageProps<'/search'>) {
  const { q } = await searchParams;
  const query = typeof q === 'string' ? q : '';

  return (
    <>
      <AtelierTitle lead="Good finds," accent="close to home." description="Browse products at the branch you’ve selected." />
      <BranchBanner />
      <Catalog key={query} initialQuery={query} />
    </>
  );
}
