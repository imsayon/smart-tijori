import { handleGetReservation, handleDeleteReservation } from '@/server/http/routes/reservations-handler';

export async function GET(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  const { id } = await props.params;
  return handleGetReservation(request, id);
}

export async function DELETE(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  const { id } = await props.params;
  return handleDeleteReservation(request, id);
}
