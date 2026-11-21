import { handleGetProducts } from '@/server/http/routes/products-handler';

export async function GET(request: Request) {
  return handleGetProducts(request);
}
