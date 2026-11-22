import { cookies } from 'next/headers';
import { AccessLayout } from '@/components/ops/layout/access-layout';
import { AccountOverview } from '@/components/account/account-overview';
import { readAccount } from '@server/http/auth/email-session';

export default async function AccountPage({ searchParams }: PageProps<'/account'>) {
  const user = await readAccount((await cookies()).toString());
  const next = (await searchParams).next === 'checkout' ? '/checkout' : undefined;
  if (!user) return <AccessLayout next={next} />;
  return <AccountOverview email={user.email}/>;
}
