import { handlePostPosSale } from '@/server/http/routes/pos-handler';

export async function POST(request: Request) {
  return handlePostPosSale(request);
}
