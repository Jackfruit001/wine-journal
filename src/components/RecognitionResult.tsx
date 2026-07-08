"use client";

import { useState } from "react";
import { ConfidenceMeter } from "./ConfidenceMeter";
import { CandidatePicker } from "./CandidatePicker";
import { EntryForm } from "./EntryForm";
import type { EntryFields, RecognizeResponse, WineCandidate } from "@/lib/schema";
import {
  computeFieldConfidence,
  DB_BACKED_FIELDS,
  userConfirmedConfidence,
  type FieldConfidenceMap,
} from "@/lib/confidence";

interface ResolvedState {
  fields: EntryFields;
  fieldConfidence: FieldConfidenceMap;
  status: "recognized" | "unrecognized";
  matchedWineId: number | null;
  source: "database" | "label_only" | null;
  confidence: number;
}

/** Merge a picked DB candidate over the VLM fields (VLM value wins if present). */
function fieldsFromPick(response: RecognizeResponse, c: WineCandidate): EntryFields {
  const f = response.fields;
  return {
    wine_name: f.wine_name ?? c.title,
    producer: f.producer ?? c.winery,
    vintage: f.vintage ?? c.vintage,
    country: f.country ?? c.country,
    region: f.region ?? c.province ?? c.region_1,
    grape_variety: f.grape_variety.length ? f.grape_variety : c.variety ? [c.variety] : [],
    wine_type: f.wine_type,
    abv: f.abv,
  };
}

export function RecognitionResult({
  result,
  onSaved,
  onRetake,
}: {
  result: RecognizeResponse;
  onSaved: () => void;
  onRetake: () => void;
}) {
  const [resolved, setResolved] = useState<ResolvedState | null>(
    result.status === "needs_confirmation"
      ? null
      : {
          fields: result.fields,
          fieldConfidence: result.field_confidence,
          status: result.status === "recognized" ? "recognized" : "unrecognized",
          matchedWineId: result.matched_wine_id,
          source: result.source,
          confidence: result.confidence,
        }
  );

  if (result.status === "needs_confirmation" && !resolved) {
    return (
      <div className="flex flex-col gap-4">
        <ConfidenceMeter confidence={result.confidence} status={result.status} />
        <div className="flex items-center justify-end">
          <button onClick={onRetake} className="text-sm text-foreground/60 underline underline-offset-2">
            Retake photo
          </button>
        </div>
        <CandidatePicker
          candidates={result.candidates}
          onPick={(c) => {
            const fields = fieldsFromPick(result, c);
            setResolved({
              fields,
              // A confirmed DB match makes the DB-backed fields high-confidence.
              fieldConfidence: computeFieldConfidence(
                fields,
                result.vlm_field_confidence,
                DB_BACKED_FIELDS
              ),
              status: "recognized",
              matchedWineId: c.id,
              source: "database",
              confidence: userConfirmedConfidence(
                c.score,
                result.confidence // best-effort vlm proxy
              ),
            });
          }}
          onNoneOfThese={() =>
            setResolved({
              fields: result.fields,
              fieldConfidence: computeFieldConfidence(result.fields, result.vlm_field_confidence, new Set()),
              status: "unrecognized",
              matchedWineId: null,
              source: null,
              confidence: 0,
            })
          }
        />
      </div>
    );
  }

  const state = resolved as ResolvedState;
  return (
    <div className="flex flex-col gap-4">
      <ConfidenceMeter confidence={state.confidence} status={state.status} source={state.source} />
      <div className="flex items-center justify-end">
        <button onClick={onRetake} className="text-sm text-foreground/60 underline underline-offset-2">
          Retake photo
        </button>
      </div>
      <EntryForm
        imageUrl={result.image_url}
        initialFields={state.fields}
        status={state.status}
        confidence={state.confidence}
        fieldConfidence={state.fieldConfidence}
        rawOcrText={result.raw_ocr_text}
        candidateMatches={result.candidates}
        matchedWineId={state.matchedWineId}
        source={state.source}
        onSaved={onSaved}
      />
    </div>
  );
}
