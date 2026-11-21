import 'server-only';
import { cookies } from 'next/headers';
import { OPERATOR_COOKIE_NAME, readOperatorToken } from '@server/http/auth/operator-guard';

export async function readWorkbenchOperator() {
  const fixture = process.env.SMARTTIJORI_DEMO_MODE === 'true';
  const token = fixture ? 'ops_cashier_blr-01' : (await cookies()).get(OPERATOR_COOKIE_NAME)?.value;
  return { actor: readOperatorToken(token), fixture };
}
