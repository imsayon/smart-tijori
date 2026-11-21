import { handleGetCart, handlePutCart } from '@/server/http/routes/cart-handler';

export async function GET(request: Request) {
  return handleGetCart(request);
}

export async function PUT(request: Request) {
  return handlePutCart(request);
}
