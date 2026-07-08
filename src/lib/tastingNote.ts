import type { SupabaseClient } from "@supabase/supabase-js";
import type { EntryFields } from "./schema";

/**
 * Short, tappable tasting-note chips the user can add without writing prose.
 *
 * Grounding: when we have a database match we pull the *real* Wine Enthusiast
 * review(s) for that wine (and its variety) and ask the LLM to distil short
 * descriptors from them — so the suggestions come from real reviews, not free
 * hallucination. If the LLM is unavailable, we fall back to extracting descriptor
 * phrases straight from those reviews (still grounded, just cruder).
 */

const DESCRIPTOR_HINTS = [
  "cherry", "blackberry", "plum", "raspberry", "strawberry", "citrus", "lemon",
  "apple", "pear", "peach", "apricot", "tropical", "melon", "vanilla", "oak",
  "spice", "pepper", "chocolate", "coffee", "tobacco", "leather", "earthy",
  "floral", "honey", "butter", "mineral", "smoky", "herbal", "tannic", "crisp",
  "silky", "full-bodied", "light-bodied", "dry", "sweet", "bright", "juicy",
  "elegant", "balanced", "rich", "toasty", "velvety", "fresh",
];

async function fetchGroundingReviews(
  db: SupabaseClient,
  matchedWineId: number | null,
  variety: string | null
): Promise<string[]> {
  const reviews: string[] = [];

  if (matchedWineId !== null) {
    const { data } = await db.from("wines").select("description").eq("id", matchedWineId).single();
    if (data?.description) reviews.push(data.description);
  }

  if (variety) {
    const { data } = await db
      .from("wines")
      .select("description")
      .ilike("variety", variety)
      .not("description", "is", null)
      .limit(4);
    for (const row of data ?? []) if (row.description) reviews.push(row.description);
  }

  return reviews;
}

/** Crude, LLM-free fallback: pull known descriptor words out of the real reviews. */
function descriptorsFromReviews(reviews: string[]): string[] {
  const found = new Set<string>();
  const haystack = reviews.join(" ").toLowerCase();
  for (const word of DESCRIPTOR_HINTS) {
    if (haystack.includes(word)) found.add(word);
    if (found.size >= 6) break;
  }
  return [...found];
}

async function suggestWithLLM(prompt: string): Promise<string[] | null> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return null;

  const model = process.env.OPENROUTER_TEXT_MODEL || "openai/gpt-4o-mini";
  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        temperature: 0.4,
        max_tokens: 200,
        response_format: { type: "json_object" },
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    const content = json.choices?.[0]?.message?.content;
    if (!content) return null;
    const parsed = JSON.parse(content);
    const list: unknown = Array.isArray(parsed) ? parsed : parsed.suggestions;
    if (!Array.isArray(list)) return null;
    return list
      .filter((s): s is string => typeof s === "string")
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 6);
  } catch {
    return null;
  }
}

export async function generateTastingSuggestions(
  db: SupabaseClient,
  fields: EntryFields,
  matchedWineId: number | null
): Promise<string[]> {
  const variety = fields.grape_variety[0] ?? null;
  const reviews = await fetchGroundingReviews(db, matchedWineId, variety);

  const wineLabel =
    [fields.producer, fields.wine_name].filter(Boolean).join(" ") || "this wine";

  if (reviews.length > 0) {
    const prompt = `You are a sommelier. Based ONLY on these real published reviews of ${wineLabel} (or the same grape), produce 5 very short tasting-note chips a casual drinker could tap to add to their journal. Each chip: 2-4 words, lowercase, a flavour/texture/impression (e.g. "dark cherry", "silky tannins", "bright acidity"). Do not invent flavours not supported by the reviews.

Reviews:
${reviews.map((r, i) => `${i + 1}. ${r}`).join("\n")}

Return JSON: {"suggestions": ["...", "..."]}`;
    const llm = await suggestWithLLM(prompt);
    if (llm && llm.length) return llm;
    const fallback = descriptorsFromReviews(reviews);
    if (fallback.length) return fallback;
  }

  // No database grounding — make gentle, clearly-generic prompts from the fields.
  const typeHint = fields.wine_type ? fields.wine_type.toLowerCase() : "wine";
  const generic = [
    variety ? `${variety.toLowerCase()} character` : `classic ${typeHint}`,
    "well balanced",
    "food friendly",
    "would buy again",
    "smooth finish",
  ];
  return generic.slice(0, 5);
}
