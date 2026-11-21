import { handleGetStores } from '@/server/http/routes/stores-handler';

export async function GET(request: Request) {
  return handleGetStores(request);
}
