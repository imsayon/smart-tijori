import { handlePostInterest } from '@/server/http/routes/interest-handler';

export async function POST(request: Request) {
  return handlePostInterest(request);
}
