import { NextResponse } from "next/server";
import { z } from "zod";
import { recognizeLabel } from "@/lib/vlm";
import { queryWineCandidates, reconcile } from "@/lib/match";
import { supabaseAdmin } from "@/lib/supabase";
import { uploadLabelImage } from "@/lib/storage";
import type { RecognizeResponse } from "@/lib/schema";

const requestSchema = z.object({
  image: z.string().startsWith("data:image/"),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Expected { image: <data URL> }" }, { status: 400 });
  }
  const { image } = parsed.data;

  try {
    const [vlm, imageUrl] = await Promise.all([
      recognizeLabel(image),
      uploadLabelImage(image).catch((err) => {
        // Degrade gracefully: recognition should still work even if storage upload fails.
        console.error("Image upload failed:", err);
        return null;
      }),
    ]);

    const candidates = await queryWineCandidates(supabaseAdmin(), vlm);
    const result = reconcile(vlm, candidates);

    const response: RecognizeResponse = {
      status: result.status,
      confidence: result.confidence,
      fields: result.fields,
      field_confidence: result.fieldConfidence,
      vlm_field_confidence: vlm.field_confidence,
      raw_ocr_text: vlm.raw_text,
      candidates: result.candidates,
      matched_wine_id: result.matchedWineId,
      source: result.source,
      image_url: imageUrl,
    };

    return NextResponse.json(response);
  } catch (err) {
    console.error("Recognition failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Recognition failed" },
      { status: 502 }
    );
  }
}
