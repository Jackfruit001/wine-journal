import type { EntryFields, VlmFieldConfidence } from "./schema";

/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  Confidence model
 * ─────────────────────────────────────────────────────────────────────────────
 *  Everything here is a deterministic formula, NOT an LLM call. A model rating
 *  its own output is poorly calibrated, so the overall confidence is driven
 *  primarily by the database match — an *independent* signal the model can't fake.
 *
 *  All weights and thresholds are exported constants so a developer can retune
 *  them later (ideally against a labelled set of real label photos).
 * ─────────────────────────────────────────────────────────────────────────────
 */

/** Weights for the three overall-confidence signals. Must sum to 1. */
export const CONFIDENCE_WEIGHTS = {
  /** Trigram similarity of the best DB match — the independent verifier. Dominant on purpose. */
  db: 0.6,
  /** VLM's self-reported overall confidence — a soft, secondary signal. */
  vlm: 0.25,
  /** Separation between the #1 and #2 DB candidates. A clear winner = less ambiguity. */
  margin: 0.15,
} as const;

/** A margin of this many similarity points between #1 and #2 counts as "fully separated". */
export const MARGIN_NORM = 0.2;

/** Label-only wines (read confidently but absent from our 130k DB) can't exceed this. */
export const LABEL_ONLY_BASE = 0.35;
export const LABEL_ONLY_VLM_WEIGHT = 0.3;
export const LABEL_ONLY_CAP = 0.65;

/** A human tapping "yes, this one" is a strong signal — floor the confidence here. */
export const USER_CONFIRMED_FLOOR = 0.85;

/** Per-field VLM-confidence thresholds for the high / moderate / low tiers. */
export const FIELD_HIGH_THRESHOLD = 0.7;
export const FIELD_MODERATE_THRESHOLD = 0.45;

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

/**
 * Overall recognition confidence for a database-matched wine.
 *   overall = W_db·db + W_vlm·vlm + W_margin·clamp(margin / MARGIN_NORM)
 */
export function overallConfidence(params: {
  dbScore: number;
  vlmConfidence: number;
  margin: number;
}): number {
  const { dbScore, vlmConfidence, margin } = params;
  const marginSignal = clamp01(margin / MARGIN_NORM);
  return clamp01(
    CONFIDENCE_WEIGHTS.db * dbScore +
      CONFIDENCE_WEIGHTS.vlm * vlmConfidence +
      CONFIDENCE_WEIGHTS.margin * marginSignal
  );
}

/** Confidence when the wine is read confidently from the label but isn't in our database. */
export function labelOnlyConfidence(vlmConfidence: number): number {
  return clamp01(Math.min(LABEL_ONLY_BASE + LABEL_ONLY_VLM_WEIGHT * vlmConfidence, LABEL_ONLY_CAP));
}

/** Confidence after a human explicitly confirms one of the candidate matches. */
export function userConfirmedConfidence(dbScore: number, vlmConfidence: number): number {
  return Math.max(
    overallConfidence({ dbScore, vlmConfidence, margin: MARGIN_NORM }),
    USER_CONFIRMED_FLOOR
  );
}

export type ConfidenceTier = "high" | "moderate" | "low";

export interface ConfidenceDescriptor {
  /** 0..100, for a progress-bar fill. */
  pct: number;
  /** User-facing phrase. */
  label: string;
  /** Colour bucket. */
  tier: ConfidenceTier;
}

/** Turn a 0..1 overall confidence into a human-readable meter descriptor. */
export function describeConfidence(score: number): ConfidenceDescriptor {
  const pct = Math.round(clamp01(score) * 100);
  if (score >= 0.8) return { pct, label: "Very confident", tier: "high" };
  if (score >= 0.6) return { pct, label: "Confident", tier: "high" };
  if (score >= 0.4) return { pct, label: "Fairly confident", tier: "moderate" };
  if (score > 0) return { pct, label: "Not sure — please check", tier: "low" };
  return { pct, label: "Couldn't identify", tier: "low" };
}

export type FieldConfLevel = "high" | "moderate" | "low" | "missing";
export type FieldConfidenceMap = Record<keyof EntryFields, FieldConfLevel>;

const ENTRY_FIELD_KEYS: (keyof EntryFields)[] = [
  "wine_name",
  "producer",
  "vintage",
  "country",
  "region",
  "grape_variety",
  "wine_type",
  "abv",
];

/** Fields our reference database can corroborate. abv & wine_type aren't in the dataset. */
export const DB_BACKED_FIELDS: ReadonlySet<keyof EntryFields> = new Set([
  "wine_name",
  "producer",
  "vintage",
  "country",
  "region",
  "grape_variety",
]);

function isEmpty(value: EntryFields[keyof EntryFields]): boolean {
  if (value === null || value === undefined) return true;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === "string") return value.trim() === "";
  return false;
}

/**
 * Per-field confidence tier. A field confirmed by the locked DB record is `high`
 * (an independent source agrees it exists); otherwise we fall back to the VLM's
 * self-reported per-field confidence; an empty field is `missing`.
 */
export function computeFieldConfidence(
  fields: EntryFields,
  vlmFieldConfidence: VlmFieldConfidence | null,
  dbConfirmedFields: ReadonlySet<keyof EntryFields>
): FieldConfidenceMap {
  const map = {} as FieldConfidenceMap;
  for (const key of ENTRY_FIELD_KEYS) {
    if (isEmpty(fields[key])) {
      map[key] = "missing";
    } else if (dbConfirmedFields.has(key)) {
      map[key] = "high";
    } else {
      const vlmConf = vlmFieldConfidence?.[key] ?? 0;
      map[key] =
        vlmConf >= FIELD_HIGH_THRESHOLD
          ? "high"
          : vlmConf >= FIELD_MODERATE_THRESHOLD
            ? "moderate"
            : "low";
    }
  }
  return map;
}
