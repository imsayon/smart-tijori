import { handleGetOpsInventory } from '@/server/http/routes/ops-handler';

export async function GET(request: Request) {
  return handleGetOpsInventory(request);
}
