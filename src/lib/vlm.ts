import { vlmExtractionSchema, type VlmExtraction } from "./schema";

/**
 * Provider-agnostic wine-label extraction. This is the single swap point: to move
 * off Qwen2.5-VL/OpenRouter onto Gemini, GPT, or Claude, only this file changes.
 *
 * The prompt's one non-negotiable rule: never invent a field. Unreadable text comes
 * back `null` with confidence 0, not a guess — the reconciliation stage in
 * `match.ts` depends on that honesty to compute a trustworthy confidence score.
 */

const EXTRACTION_INSTRUCTIONS = `You are reading a photograph of a wine bottle label. Extract structured information and return ONLY a single JSON object — no markdown, no commentary.

Required JSON shape:
{
  "readable": boolean,            // false if there is no legible wine label in the image at all
  "raw_text": string,             // verbatim text you can actually read on the label, line by line; "" if none
  "wine_name": string | null,     // the cuvée / bottling name, NOT the producer
  "producer": string | null,      // winery / producer / house name
  "vintage": number | null,       // 4-digit year, or null if non-vintage / illegible
  "country": string | null,
  "region": string | null,        // e.g. "Napa Valley", "Barossa Valley", "Rioja"
  "grape_variety": string[] | null,
  "wine_type": "red" | "white" | "rose" | "sparkling" | "dessert" | "fortified" | "other" | null,
  "abv": number | null,           // percent, e.g. 13.5
  "overall_confidence": number,   // 0..1, your honest confidence in this whole extraction
  "field_confidence": {           // 0..1 per field
    "wine_name": number, "producer": number, "vintage": number, "country": number,
    "region": number, "grape_variety": number, "wine_type": number, "abv": number
  }
}

Critical rule: if a field is not visible, blurry, cropped out, or you are genuinely unsure, return null for it and a low number (< 0.3) in its field_confidence. Do NOT guess a plausible-sounding value. Inventing a vintage or producer is a worse failure than admitting you can't read it. If the image has no legible wine label at all, set "readable": false and null out every field.`;

function stripJsonFences(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  return fenced ? fenced[1] : trimmed;
}

/** Reads (without consuming) an error response to find which upstream provider failed. */
async function extractProviderName(res: Response): Promise<string | null> {
  try {
    const body = await res.clone().json();
    return body?.error?.metadata?.provider_name ?? null;
  } catch {
    return null;
  }
}

/** LLM output is a system boundary — normalize the couple of fields models get wrong despite instructions. */
function normalizeExtraction(raw: unknown): unknown {
  if (typeof raw !== "object" || raw === null) return raw;
  const obj = raw as Record<string, unknown>;
  return { ...obj, raw_text: obj.raw_text ?? "" };
}

/** Consumes an OpenRouter SSE stream and returns the concatenated `delta.content` text. */
async function readStreamedContent(res: Response): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) throw new Error("OpenRouter response had no body to stream");

  const decoder = new TextDecoder();
  let buffer = "";
  let content = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const data = trimmed.slice("data:".length).trim();
      if (data === "[DONE]") continue;

      const chunk = JSON.parse(data);
      const delta = chunk.choices?.[0]?.delta?.content;
      if (delta) content += delta;
    }
  }

  return content;
}

async function callOpenRouterOnce(
  imageDataUrl: string,
  apiKey: string,
  model: string,
  ignoreProviders?: string[]
) {
  return fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      response_format: { type: "json_object" },
      temperature: 0,
      max_tokens: 1024,
      stream: true,
      // On retry we exclude whichever upstream provider just failed/rate-limited us,
      // so OpenRouter routes the retry to a different provider instead of the same one.
      ...(ignoreProviders?.length ? { provider: { ignore: ignoreProviders } } : {}),
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: EXTRACTION_INSTRUCTIONS },
            { type: "image_url", image_url: { url: imageDataUrl } },
          ],
        },
      ],
    }),
  });
}

async function recognizeWithOpenRouter(imageDataUrl: string): Promise<VlmExtraction> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY not set");

  const model = process.env.OPENROUTER_VLM_MODEL || "qwen/qwen2.5-vl-72b-instruct";

  let res = await callOpenRouterOnce(imageDataUrl, apiKey, model);

  // One retry for transient upstream failures (5xx) or a rate-limited provider (429).
  // For 429s we exclude that specific provider so the retry routes elsewhere instead
  // of hitting the same limit again; no artificial delay, since a different provider
  // is a fresh capacity pool, not something that needs time to recover.
  if (!res.ok && (res.status >= 500 || res.status === 429)) {
    const failedProvider = await extractProviderName(res);
    res = await callOpenRouterOnce(
      imageDataUrl,
      apiKey,
      model,
      failedProvider ? [failedProvider] : undefined
    );
  }

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`OpenRouter error ${res.status}: ${body}`);
  }

  const content = await readStreamedContent(res);
  if (!content) throw new Error("OpenRouter returned no content");

  const parsed = normalizeExtraction(JSON.parse(stripJsonFences(content)));
  return vlmExtractionSchema.parse(parsed);
}

async function recognizeWithGemini(imageDataUrl: string): Promise<VlmExtraction> {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) throw new Error("GOOGLE_API_KEY not set");

  const model = process.env.GEMINI_VLM_MODEL || "gemini-2.5-flash";
  const [meta, base64] = imageDataUrl.split(",");
  const mimeType = meta.match(/data:(.*?);base64/)?.[1] || "image/jpeg";

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [
              { text: EXTRACTION_INSTRUCTIONS },
              { inline_data: { mime_type: mimeType, data: base64 } },
            ],
          },
        ],
        generationConfig: { temperature: 0, responseMimeType: "application/json" },
      }),
    }
  );

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Gemini error ${res.status}: ${body}`);
  }

  const json = await res.json();
  const content = json.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!content) throw new Error("Gemini returned no content");

  const parsed = normalizeExtraction(JSON.parse(stripJsonFences(content)));
  return vlmExtractionSchema.parse(parsed);
}

/**
 * Extract structured wine fields + raw OCR text from a label photo.
 * @param imageDataUrl a `data:image/...;base64,...` data URL
 */
export async function recognizeLabel(imageDataUrl: string): Promise<VlmExtraction> {
  if (process.env.OPENROUTER_API_KEY) {
    try {
      return await recognizeWithOpenRouter(imageDataUrl);
    } catch (err) {
      if (!process.env.GOOGLE_API_KEY) throw err;
      console.error("OpenRouter VLM call failed, falling back to Gemini:", err);
    }
  }
  return recognizeWithGemini(imageDataUrl);
}
