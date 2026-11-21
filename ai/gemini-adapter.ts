import {
  safeParseShopperIntent,
  type ShopperIntent,
  type ExplicitShopperConstraints,
} from "./intent-schema";
import { mergeShopperConstraints } from "./intent-merger";

export class GeminiError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = this.constructor.name;
  }
}

export class GeminiInvalidInputError extends GeminiError {}
export class GeminiTimeoutError extends GeminiError {}
export class GeminiQuotaError extends GeminiError {}
export class GeminiAuthError extends GeminiError {}
export class GeminiProviderError extends GeminiError {}
export class GeminiMalformedResponseError extends GeminiError {}
export class GeminiConfigError extends GeminiError {}

export interface GeminiAdapterOptions {
  apiKey?: string;
  model?: string;
  timeoutMs?: number;
  maxInputLength?: number;
  fetchFn?: typeof fetch;
}

export interface ExtractIntentOptions {
  explicitConstraints?: ExplicitShopperConstraints;
  timeoutMs?: number;
}

const DEFAULT_MODEL = "gemini-2.5-flash-lite";
const DEFAULT_TIMEOUT_MS = 5000;
const DEFAULT_MAX_INPUT_LENGTH = 500;

export const SYSTEM_INSTRUCTION = `You are a shopper intent extraction engine for a neighborhood retail catalog, not a conversational shopping assistant.
Your only task is to extract the shopper's stated product requirements and constraints from their query into a single JSON object.

Output JSON structure:
{
  "purpose": string, // core product or category search intent (e.g., "whole wheat atta", "tata tea gold")
  "maxPricePaise": integer, // maximum budget in paise (₹1 = 100 paise; e.g. 300 rupees = 30000 paise)
  "minPack": {
    "quantity": number, // positive pack quantity
    "unit": "g" | "kg" | "ml" | "l" | "count" // supported pack unit
  },
  "requiredAttributes": Record<string, string>, // key-value product attributes (e.g. { "brand": "Tata" })
  "preferences": string[] // preferred product traits or variants
}

STRICT INSTRUCTIONS:
- Return ONLY a valid JSON object matching the schema above.
- Do NOT assess prices, availability, or whether a requested product is realistic.
- Do NOT output conversational responses or invent fields such as "error", "message", "status", "product", "budget_inr", or "quantity_kg".
- Convert any rupee budgets into paise (₹1 = 100 paise).
- Use only the schema's supported units for minPack: "g", "kg", "ml", "l", and "count".
- Omit or set to null any constraints that the shopper did not specify.`;

interface GeminiApiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
}

export class GeminiModelAdapter {
  private readonly apiKey?: string;
  private readonly model: string;
  private readonly timeoutMs: number;
  private readonly maxInputLength: number;
  private readonly fetchFn: typeof fetch;

  constructor(options?: GeminiAdapterOptions) {
    this.apiKey = options?.apiKey !== undefined ? options.apiKey : process.env.GEMINI_API_KEY;
    this.model = options?.model ?? process.env.GEMINI_MODEL ?? DEFAULT_MODEL;
    this.timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.maxInputLength = options?.maxInputLength ?? DEFAULT_MAX_INPUT_LENGTH;
    this.fetchFn = options?.fetchFn ?? fetch;
  }

  isConfigured(): boolean {
    return typeof this.apiKey === "string" && this.apiKey.trim().length > 0;
  }

  async extractIntent(
    text: string,
    options?: ExtractIntentOptions
  ): Promise<ShopperIntent> {
    if (typeof text !== "string" || text.trim().length === 0) {
      throw new GeminiInvalidInputError("Input query cannot be empty or whitespace");
    }

    if (text.length > this.maxInputLength) {
      throw new GeminiInvalidInputError(
        `Input query exceeds maximum allowed length of ${this.maxInputLength} characters`
      );
    }

    if (!this.isConfigured()) {
      throw new GeminiConfigError("GEMINI_API_KEY is not configured");
    }

    const timeout = options?.timeoutMs ?? this.timeoutMs;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      this.model
    )}:generateContent`;

    const requestBody = {
      contents: [
        {
          parts: [
            {
              text,
            },
          ],
        },
      ],
      systemInstruction: {
        parts: [
          {
            text: SYSTEM_INSTRUCTION,
          },
        ],
      },
      generationConfig: {
        responseMimeType: "application/json",
      },
    };

    let response: Response;
    try {
      response = await this.fetchFn(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": this.apiKey!,
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") {
        throw new GeminiTimeoutError(`Gemini request timed out after ${timeout}ms`);
      }
      throw new GeminiProviderError("Network failure while contacting Gemini API");
    } finally {
      clearTimeout(timer);
    }

    if (response.status === 401 || response.status === 403) {
      throw new GeminiAuthError("Gemini authentication failed");
    }

    if (response.status === 429) {
      throw new GeminiQuotaError("Gemini quota exceeded");
    }

    if (response.status >= 500) {
      throw new GeminiProviderError(`Gemini service error: ${response.status}`);
    }

    if (!response.ok) {
      throw new GeminiProviderError(`Gemini request failed with status: ${response.status}`);
    }

    let responseData: unknown;
    try {
      responseData = await response.json();
    } catch {
      throw new GeminiMalformedResponseError("Failed to parse Gemini response as JSON");
    }

    const typedResponse = responseData as GeminiApiResponse | null | undefined;
    const candidateText = typedResponse?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (typeof candidateText !== "string") {
      throw new GeminiMalformedResponseError("Gemini response missing candidate text part");
    }

    let parsedContent: unknown;
    try {
      parsedContent = JSON.parse(candidateText);
    } catch {
      throw new GeminiMalformedResponseError("Gemini candidate text is not valid JSON");
    }

    const validated = safeParseShopperIntent(parsedContent);
    if (!validated.success) {
      throw new GeminiMalformedResponseError(
        `Gemini output failed schema validation: ${validated.error.message}`
      );
    }

    const extractedIntent = validated.data;

    if (options?.explicitConstraints) {
      return mergeShopperConstraints(extractedIntent, options.explicitConstraints);
    }

    return extractedIntent;
  }
}

let defaultAdapter: GeminiModelAdapter | null = null;

export function getGeminiAdapter(options?: GeminiAdapterOptions): GeminiModelAdapter {
  if (options) {
    return new GeminiModelAdapter(options);
  }
  if (!defaultAdapter) {
    defaultAdapter = new GeminiModelAdapter();
  }
  return defaultAdapter;
}
