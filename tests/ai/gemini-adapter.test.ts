import { describe, it, expect } from "vitest";
import {
  GeminiModelAdapter,
  GeminiInvalidInputError,
  GeminiTimeoutError,
  GeminiQuotaError,
  GeminiAuthError,
  GeminiProviderError,
  GeminiMalformedResponseError,
  GeminiConfigError,
} from "../../ai/gemini-adapter";

function createMockGeminiResponse(extractedPayload: Record<string, unknown>): Response {
  const body = {
    candidates: [
      {
        content: {
          parts: [
            {
              text: JSON.stringify(extractedPayload),
            },
          ],
        },
      },
    ],
  };

  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

describe("GeminiModelAdapter - Bounded Model Extraction", () => {
  it("successfully extracts valid intent from shopper query", async () => {
    const mockFetch: typeof fetch = async (input, init) => {
      const url = String(input);
      expect(url).toContain("models/gemini-2.5-flash-lite:generateContent");
      expect(url).toContain("key=test-api-key");

      const requestBody = JSON.parse(String(init?.body));
      expect(requestBody.contents[0].parts[0].text).toBe("Need 5kg whole wheat atta under 300 rupees");
      expect(requestBody.generationConfig.responseMimeType).toBe("application/json");

      return createMockGeminiResponse({
        purpose: "whole-wheat-atta",
        maxPricePaise: 30000,
        minPack: { quantity: 5, unit: "kg" },
        requiredAttributes: { brand: "Aashirvaad" },
        preferences: ["fresh-milled"],
      });
    };

    const adapter = new GeminiModelAdapter({
      apiKey: "test-api-key",
      model: "gemini-2.5-flash-lite",
      fetchFn: mockFetch,
    });

    const intent = await adapter.extractIntent("Need 5kg whole wheat atta under 300 rupees");
    expect(intent.purpose).toBe("whole-wheat-atta");
    expect(intent.maxPricePaise).toBe(30000);
    expect(intent.minPack).toEqual({ quantity: 5, unit: "kg" });
    expect(intent.requiredAttributes).toEqual({ brand: "Aashirvaad" });
    expect(intent.preferences).toEqual(["fresh-milled"]);
  });

  it("missing or null fields remain undefined (never invented)", async () => {
    const mockFetch: typeof fetch = async () => {
      return createMockGeminiResponse({
        purpose: "tea",
        maxPricePaise: null,
        minPack: null,
        requiredAttributes: null,
        preferences: null,
      });
    };

    const adapter = new GeminiModelAdapter({
      apiKey: "test-api-key",
      fetchFn: mockFetch,
    });

    const intent = await adapter.extractIntent("Looking for tea");
    expect(intent.purpose).toBe("tea");
    expect(intent.maxPricePaise).toBeUndefined();
    expect(intent.minPack).toBeUndefined();
    expect(intent.requiredAttributes).toBeUndefined();
    expect(intent.preferences).toBeUndefined();
  });

  it("handles invalid JSON returned by provider", async () => {
    const mockFetch: typeof fetch = async () => {
      return new Response("<html><body>Bad Gateway</body></html>", {
        status: 200,
        headers: { "Content-Type": "text/html" },
      });
    };

    const adapter = new GeminiModelAdapter({
      apiKey: "test-api-key",
      fetchFn: mockFetch,
    });

    await expect(adapter.extractIntent("I need detergent")).rejects.toThrow(GeminiMalformedResponseError);
  });

  it("handles invalid schema output (e.g. invalid pack unit)", async () => {
    const mockFetch: typeof fetch = async () => {
      return createMockGeminiResponse({
        purpose: "tea",
        minPack: { quantity: 2, unit: "invalid-boxes" },
      });
    };

    const adapter = new GeminiModelAdapter({
      apiKey: "test-api-key",
      fetchFn: mockFetch,
    });

    await expect(adapter.extractIntent("tea")).rejects.toThrow(GeminiMalformedResponseError);
  });

  it("overrides conflicting model extraction with explicit shopper constraints", async () => {
    const mockFetch: typeof fetch = async () => {
      return createMockGeminiResponse({
        purpose: "laundry-detergent",
        maxPricePaise: 40000, // Model extracted ₹400
        minPack: { quantity: 2, unit: "l" }, // Model extracted 2L
      });
    };

    const adapter = new GeminiModelAdapter({
      apiKey: "test-api-key",
      fetchFn: mockFetch,
    });

    const intent = await adapter.extractIntent("laundry detergent", {
      explicitConstraints: {
        maxPricePaise: 25000, // Shopper explicit ₹250
        minPack: { quantity: 1, unit: "l" }, // Shopper explicit 1L
      },
    });

    expect(intent.maxPricePaise).toBe(25000);
    expect(intent.minPack).toEqual({ quantity: 1, unit: "l" });
    expect(intent.purpose).toBe("laundry-detergent");
  });

  it("throws GeminiTimeoutError when request times out", async () => {
    const mockFetch: typeof fetch = async (_input, init) => {
      return new Promise((_, reject) => {
        init?.signal?.addEventListener("abort", () => {
          const error = new Error("The operation was aborted");
          error.name = "AbortError";
          reject(error);
        });
      });
    };

    const adapter = new GeminiModelAdapter({
      apiKey: "test-api-key",
      timeoutMs: 50,
      fetchFn: mockFetch,
    });

    await expect(adapter.extractIntent("quick query", { timeoutMs: 30 })).rejects.toThrow(GeminiTimeoutError);
  });

  it("handles HTTP 429 quota errors", async () => {
    const mockFetch: typeof fetch = async () => {
      return new Response(JSON.stringify({ error: { message: "Quota exceeded" } }), {
        status: 429,
        headers: { "Content-Type": "application/json" },
      });
    };

    const adapter = new GeminiModelAdapter({
      apiKey: "test-api-key",
      fetchFn: mockFetch,
    });

    await expect(adapter.extractIntent("any text")).rejects.toThrow(GeminiQuotaError);
  });

  it("handles HTTP 401/403 authentication errors", async () => {
    const mockFetch: typeof fetch = async () => {
      return new Response(JSON.stringify({ error: { message: "API key not valid" } }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    };

    const adapter = new GeminiModelAdapter({
      apiKey: "invalid-key",
      fetchFn: mockFetch,
    });

    await expect(adapter.extractIntent("tea")).rejects.toThrow(GeminiAuthError);
  });

  it("handles HTTP 500/503 provider errors", async () => {
    const mockFetch: typeof fetch = async () => {
      return new Response("Internal Server Error", {
        status: 503,
        statusText: "Service Unavailable",
      });
    };

    const adapter = new GeminiModelAdapter({
      apiKey: "test-api-key",
      fetchFn: mockFetch,
    });

    await expect(adapter.extractIntent("tea")).rejects.toThrow(GeminiProviderError);
  });

  it("rejects excessively long or hostile input (> 500 characters)", async () => {
    const adapter = new GeminiModelAdapter({
      apiKey: "test-api-key",
      maxInputLength: 500,
    });

    const oversizedText = "a".repeat(501);
    await expect(adapter.extractIntent(oversizedText)).rejects.toThrow(GeminiInvalidInputError);
  });

  it("rejects empty or whitespace-only input", async () => {
    const adapter = new GeminiModelAdapter({
      apiKey: "test-api-key",
    });

    for (const emptyInput of ["", "   ", "\n\t"]) {
      await expect(adapter.extractIntent(emptyInput)).rejects.toThrow(GeminiInvalidInputError);
    }
  });

  it("throws GeminiConfigError if API key is missing", async () => {
    const prevKey = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;
    try {
      const adapter = new GeminiModelAdapter({ apiKey: undefined });
      expect(adapter.isConfigured()).toBe(false);
      await expect(adapter.extractIntent("tea")).rejects.toThrow(GeminiConfigError);
    } finally {
      if (prevKey) process.env.GEMINI_API_KEY = prevKey;
    }
  });
});
