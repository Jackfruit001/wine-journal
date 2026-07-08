"use client";

import { useState } from "react";
import { WineFieldsEditor } from "./WineFieldsEditor";
import { TastingNoteInput } from "./TastingNoteInput";
import { StarRating } from "./StarRating";
import type { EntryFields, RecognitionStatus, WineCandidate } from "@/lib/schema";
import type { FieldConfidenceMap } from "@/lib/confidence";

/** The editable result form shown after recognition; saves a new journal entry. */
export function EntryForm({
  imageUrl,
  initialFields,
  status,
  confidence,
  fieldConfidence,
  rawOcrText,
  candidateMatches,
  matchedWineId,
  source,
  onSaved,
}: {
  imageUrl: string | null;
  initialFields: EntryFields;
  status: RecognitionStatus;
  confidence: number;
  fieldConfidence: FieldConfidenceMap;
  rawOcrText: string;
  candidateMatches: WineCandidate[];
  matchedWineId: number | null;
  source: "database" | "label_only" | null;
  onSaved: () => void;
}) {
  const [fields, setFields] = useState<EntryFields>(initialFields);
  const [edited, setEdited] = useState(false);
  const [rating, setRating] = useState<number | null>(null);
  const [notes, setNotes] = useState("");
  const [showRawText, setShowRawText] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleFieldsChange(next: EntryFields) {
    setFields(next);
    setEdited(true);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image_url: imageUrl,
          ...fields,
          raw_ocr_text: rawOcrText,
          recognition_status: status,
          confidence,
          confidence_fields: fieldConfidence,
          candidate_matches: candidateMatches.length ? candidateMatches : null,
          matched_wine_id: matchedWineId,
          source,
          user_edited: edited,
          tasting_note: null,
          user_rating: rating,
          user_notes: notes || null,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to save entry");
      }
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save entry");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {source === "label_only" && (
        <p className="rounded-lg bg-amber-100 px-3 py-2 text-sm text-amber-900 dark:bg-amber-900/30 dark:text-amber-200">
          Not in our database — filled in from the label only. Please double-check.
        </p>
      )}
      {status === "unrecognized" && (
        <p className="rounded-lg bg-zinc-100 px-3 py-2 text-sm text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
          We couldn&apos;t recognize this confidently. Fill in what you know below — no pressure to be exact.
        </p>
      )}

      <WineFieldsEditor fields={fields} onChange={handleFieldsChange} fieldConfidence={fieldConfidence} />

      <StarRating value={rating} onChange={setRating} />

      <TastingNoteInput
        fields={fields}
        matchedWineId={matchedWineId}
        notes={notes}
        onChangeNotes={setNotes}
      />

      {rawOcrText && (
        <div className="rounded-lg border border-black/10 dark:border-white/10">
          <button
            type="button"
            onClick={() => setShowRawText((s) => !s)}
            className="w-full px-3 py-2 text-left text-sm font-medium text-foreground/70"
          >
            {showRawText ? "▾" : "▸"} What we read off the label
          </button>
          {showRawText && (
            <pre className="whitespace-pre-wrap break-words border-t border-black/10 px-3 py-2 text-xs text-foreground/60 dark:border-white/10">
              {rawOcrText}
            </pre>
          )}
        </div>
      )}

      {error && <p className="text-sm text-rose-600">{error}</p>}

      <button
        onClick={handleSave}
        disabled={saving}
        className="rounded-full bg-wine px-4 py-3 font-medium text-white shadow-sm transition-transform active:scale-[0.98] disabled:opacity-50"
      >
        {saving ? "Saving…" : "Save to journal"}
      </button>
    </div>
  );
}
