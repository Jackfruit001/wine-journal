"use client";

import { useState } from "react";
import { ConfidenceBadge } from "./ConfidenceBadge";
import { CandidatePicker } from "./CandidatePicker";
import { EntryForm } from "./EntryForm";
import type { EntryFields, RecognizeResponse } from "@/lib/schema";

interface ConfirmedState {
  fields: EntryFields;
  status: "recognized" | "unrecognized";
  matchedWineId: number | null;
  source: "database" | "label_only" | null;
  confidence: number;
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
  const [confirmed, setConfirmed] = useState<ConfirmedState | null>(
    result.status === "needs_confirmation"
      ? null
      : {
          fields: result.fields,
          status: result.status === "recognized" ? "recognized" : "unrecognized",
          matchedWineId: result.matched_wine_id,
          source: result.source,
          confidence: result.confidence,
        }
  );

  if (result.status === "needs_confirmation" && !confirmed) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <ConfidenceBadge status={result.status} confidence={result.confidence} />
          <button onClick={onRetake} className="text-sm text-foreground/60 underline">
            Retake
          </button>
        </div>
        <CandidatePicker
          candidates={result.candidates}
          onPick={(c) =>
            setConfirmed({
              fields: {
                wine_name: result.fields.wine_name ?? c.title,
                producer: result.fields.producer ?? c.winery,
                vintage: result.fields.vintage ?? c.vintage,
                country: result.fields.country ?? c.country,
                region: result.fields.region ?? c.province ?? c.region_1,
                grape_variety: result.fields.grape_variety.length
                  ? result.fields.grape_variety
                  : c.variety
                    ? [c.variety]
                    : [],
                wine_type: result.fields.wine_type,
                abv: result.fields.abv,
              },
              status: "recognized",
              matchedWineId: c.id,
              source: "database",
              confidence: c.score,
            })
          }
          onNoneOfThese={() =>
            setConfirmed({
              fields: result.fields,
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

  const state = confirmed as ConfirmedState;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <ConfidenceBadge status={state.status} confidence={state.confidence} />
        <button onClick={onRetake} className="text-sm text-foreground/60 underline">
          Retake
        </button>
      </div>
      <EntryForm
        imageUrl={result.image_url}
        initialFields={state.fields}
        status={state.status}
        confidence={state.confidence}
        confidenceFields={result.confidence_fields}
        rawOcrText={result.raw_ocr_text}
        candidateMatches={result.candidates}
        matchedWineId={state.matchedWineId}
        source={state.source}
        onSaved={onSaved}
      />
    </div>
  );
}
