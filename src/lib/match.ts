import type { SupabaseClient } from "@supabase/supabase-js";
import type { VlmExtraction } from "./schema";
import {
  type EntryFields,
  type RecognitionStatus,
  type WineCandidate,
  wineCandidateSchema,
} from "./schema";

const HIGH_CONFIDENCE_DB_SCORE = 0.7;
const LOW_CONFIDENCE_DB_SCORE = 0.4;
const AMBIGUOUS_GAP = 0.08;
const LABEL_ONLY_MIN_VLM_CONFIDENCE = 0.55;

export interface ReconcileResult {
  status: RecognitionStatus;
  confidence: number;
  fields: EntryFields;
  candidates: WineCandidate[];
  matchedWineId: number | null;
  source: "database" | "label_only" | null;
}

/** Stage 2 — independent verifier. Fuzzy-match "producer + name" against the reference DB. */
export async function queryWineCandidates(
  db: SupabaseClient,
  vlm: VlmExtraction,
  matchCount = 5
): Promise<WineCandidate[]> {
  const query = [vlm.producer, vlm.wine_name].filter(Boolean).join(" ").trim();
  if (!query) return [];

  const { data, error } = await db.rpc("match_wines", { query, match_count: matchCount });
  if (error) throw new Error(`match_wines RPC failed: ${error.message}`);

  return (data ?? []).map((row: Record<string, unknown>) => wineCandidateSchema.parse(row));
}

function fillFromCandidate(vlm: VlmExtraction, candidate: WineCandidate): EntryFields {
  return {
    wine_name: vlm.wine_name ?? candidate.title,
    producer: vlm.producer ?? candidate.winery,
    vintage: vlm.vintage ?? candidate.vintage,
    country: vlm.country ?? candidate.country,
    region: vlm.region ?? candidate.province ?? candidate.region_1,
    grape_variety: vlm.grape_variety ?? (candidate.variety ? [candidate.variety] : []),
    wine_type: vlm.wine_type,
    abv: vlm.abv,
  };
}

function fieldsFromVlmOnly(vlm: VlmExtraction): EntryFields {
  return {
    wine_name: vlm.wine_name,
    producer: vlm.producer,
    vintage: vlm.vintage,
    country: vlm.country,
    region: vlm.region,
    grape_variety: vlm.grape_variety ?? [],
    wine_type: vlm.wine_type,
    abv: vlm.abv,
  };
}

/**
 * Stage 3 — reconcile the VLM's self-reported extraction with the database's
 * independent verification into one of three states. Confidence is derived
 * primarily from the DB match score, not the VLM's self-confidence, because a
 * model rating its own output is poorly calibrated — see BUILD_PLAN.md §5.
 */
export function reconcile(vlm: VlmExtraction, candidates: WineCandidate[]): ReconcileResult {
  if (!vlm.readable || (!vlm.wine_name && !vlm.producer)) {
    return {
      status: "unrecognized",
      confidence: 0,
      fields: fieldsFromVlmOnly(vlm),
      candidates: [],
      matchedWineId: null,
      source: null,
    };
  }

  const best = candidates[0];
  const second = candidates[1];
  const gapIsAmbiguous = !!best && !!second && best.score - second.score < AMBIGUOUS_GAP;

  if (best && best.score >= HIGH_CONFIDENCE_DB_SCORE && !gapIsAmbiguous) {
    return {
      status: "recognized",
      confidence: 0.75 * best.score + 0.25 * vlm.overall_confidence,
      fields: fillFromCandidate(vlm, best),
      candidates: candidates.slice(0, 3),
      matchedWineId: best.id,
      source: "database",
    };
  }

  if (best && (best.score >= LOW_CONFIDENCE_DB_SCORE || gapIsAmbiguous)) {
    return {
      status: "needs_confirmation",
      confidence: best.score,
      fields: fieldsFromVlmOnly(vlm),
      candidates: candidates.slice(0, 3),
      matchedWineId: null,
      source: null,
    };
  }

  if (vlm.overall_confidence >= LABEL_ONLY_MIN_VLM_CONFIDENCE && vlm.wine_name && vlm.producer) {
    return {
      status: "recognized",
      confidence: Math.min(vlm.overall_confidence, 0.65),
      fields: fieldsFromVlmOnly(vlm),
      candidates: candidates.slice(0, 3),
      matchedWineId: null,
      source: "label_only",
    };
  }

  return {
    status: "unrecognized",
    confidence: 0,
    fields: fieldsFromVlmOnly(vlm),
    candidates: candidates.slice(0, 3),
    matchedWineId: null,
    source: null,
  };
}
