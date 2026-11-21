import { NextResponse } from "next/server";
import { handlePostRecovery as handleDemoRecovery } from "@server/http/routes/recovery-handler";

/**
 * Standalone shopper-demo route only.
 * Production recovery is owned by the intelligence track; until integrated,
 * fail closed rather than pretending that rules-mode fixtures are real AI.
 */
export async function POST(request: Request): Promise<NextResponse> {
  if (process.env.SMARTTIJORI_DEMO_MODE === "true") {
    return handleDemoRecovery(request);
  }

  return NextResponse.json(
    { error: { code: "DEPENDENCY_UNAVAILABLE", message: "Recovery service is not integrated." } },
    { status: 503 },
  );
}
