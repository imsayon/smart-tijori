import { BranchBanner } from '@/components/shop/navigation/branch-banner';
import { Catalog } from '@/components/shop/catalog/catalog';

export default async function SearchPage({ searchParams }: PageProps<'/search'>) {
  const { q } = await searchParams;
  const query = typeof q === 'string' ? q : '';

  return (
    <>
      <BranchBanner />
      <h1 className="mb-4 text-2xl font-black text-stone-900">Search catalog</h1>
      <Catalog key={query} initialQuery={query} />
    </>
  );
}
