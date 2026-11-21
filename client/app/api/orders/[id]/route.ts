import { handleGetOrder } from '@/server/http/routes/orders-handler';

export async function GET(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  const { id } = await props.params;
  return handleGetOrder(request, id);
}
