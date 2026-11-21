import { handlePostOrders } from '@/server/http/routes/orders-handler';

export async function POST(request: Request) {
  return handlePostOrders(request);
}
