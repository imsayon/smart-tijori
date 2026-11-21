import { NextResponse } from "next/server";
import { handlePostRecovery } from "@server/http/routes/recovery-handler";

export async function POST(request: Request): Promise<NextResponse> {
  if (process.env.ST_CATALOG_SOURCE === "postgres" || process.env.SMARTTIJORI_DEMO_MODE === "true") {
    return handlePostRecovery(request);
  }

  return NextResponse.json(
    { error: { code: "DEPENDENCY_UNAVAILABLE", message: "Recovery service is not integrated." } },
    { status: 503 },
  );
}
