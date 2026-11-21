import { describe, it, expect } from "vitest";
import { GeminiModelAdapter } from "../../ai/gemini-adapter";

describe("GeminiModelAdapter - Live API Integration", () => {
  it("performs live extraction when GEMINI_API_KEY is configured", async (ctx) => {
    if (!process.env.GEMINI_API_KEY) {
      ctx.skip();
      return;
    }

    const adapter = new GeminiModelAdapter();
    expect(adapter.isConfigured()).toBe(true);

    const query = "I need 1kg Tata Tea gold under 600 rupees";
    const intent = await adapter.extractIntent(query);

    expect(intent.purpose).toBeDefined();
    if (intent.maxPricePaise !== undefined) {
      expect(intent.maxPricePaise).toBeLessThanOrEqual(60000);
    }
    if (intent.minPack) {
      expect(intent.minPack.unit).toBe("kg");
    }
  });
});
