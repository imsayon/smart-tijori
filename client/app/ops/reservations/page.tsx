import { OpsRecords } from '../records';

export default async function Page({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  return <OpsRecords kind="reservations" page={(await searchParams).page} />;
}
