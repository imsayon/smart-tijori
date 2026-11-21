import { OpsRecords } from '../records';

export default async function Page({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  return <OpsRecords kind="orders" page={(await searchParams).page} />;
}
