import { cookies } from 'next/headers';
import Link from 'next/link';
import { AccessLayout } from '@/components/ops/layout/access-layout';
import { AccountAccess } from '@/components/account/account-access';
import { readAccount } from '@server/http/auth/firebase-session';

export default async function AccountPage({ searchParams }: PageProps<'/account'>) {
  const user = await readAccount((await cookies()).toString());
  const next = (await searchParams).next === 'checkout' ? '/checkout' : undefined;
  if (!user) return <AccessLayout next={next} />;

  return (
    <section className="space-y-5">
      <h1 className="atelier-heading text-5xl">Your account</h1>
      <p>{user.email}</p>
      <Link className="block underline" href="/orders">Order history</Link>
      <AccountAccess signedIn />
    </section>
  );
}
