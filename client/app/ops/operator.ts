import 'server-only';
import { cookies } from 'next/headers';
import { readMerchant } from '@server/http/auth/merchant';
import { readOperatorToken } from '@server/http/auth/operator-guard';

export async function readWorkbenchOperator() {
  const fixture = process.env.SMARTTIJORI_DEMO_MODE === 'true';
  const actor = fixture ? readOperatorToken('ops_cashier_blr-01') : await readMerchant((await cookies()).toString());
  return { actor, fixture };
}
