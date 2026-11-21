import { handlePostRecovery } from '@/server/http/routes/recovery-handler';

export async function POST(request: Request) {
  return handlePostRecovery(request);
}
