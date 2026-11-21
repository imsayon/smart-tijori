import { handlePostReservations } from '@/server/http/routes/reservations-handler';

export async function POST(request: Request) {
  return handlePostReservations(request);
}
