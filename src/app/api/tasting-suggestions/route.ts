import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase";
import { generateTastingSuggestions } from "@/lib/tastingNote";
import { entryFieldsSchema } from "@/lib/schema";

// Involves an LLM call; allow headroom over the default 10s timeout.
export const maxDuration = 60;

const requestSchema = z.object({
  fields: entryFieldsSchema,
  matched_wine_id: z.number().nullable(),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  try {
    const suggestions = await generateTastingSuggestions(
      supabaseAdmin(),
      parsed.data.fields,
      parsed.data.matched_wine_id
    );
    return NextResponse.json({ suggestions });
  } catch (err) {
    console.error("Tasting suggestions failed:", err);
    // Non-critical feature — never fail the UI over it.
    return NextResponse.json({ suggestions: [] });
  }
}
