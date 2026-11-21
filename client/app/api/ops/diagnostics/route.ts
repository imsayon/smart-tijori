import { handleGetOpsDiagnostics } from '@/server/http/routes/ops-handler';

export async function GET(request: Request) {
  return handleGetOpsDiagnostics(request);
}
