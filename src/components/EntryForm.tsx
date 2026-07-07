"use client";

import { useState } from "react";
import type {
  EntryFields,
  RecognitionStatus,
  VlmFieldConfidence,
  WineCandidate,
} from "@/lib/schema";

const WINE_TYPES = ["red", "white", "rose", "sparkling", "dessert", "fortified", "other"];

const FIELD_LABELS: Record<keyof EntryFields, string> = {
  wine_name: "Wine name",
  producer: "Producer / winery",
  vintage: "Vintage",
  country: "Country",
  region: "Region",
  grape_variety: "Grape variety",
  wine_type: "Type",
  abv: "ABV %",
};

function isLowConfidence(field: keyof VlmFieldConfidence, confidenceFields: VlmFieldConfidence | null) {
  if (!confidenceFields) return false;
  return confidenceFields[field] < 0.5;
}

export function EntryForm({
  imageUrl,
  initialFields,
  status,
  confidence,
  confidenceFields,
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
  confidenceFields: VlmFieldConfidence | null;
  rawOcrText: string;
  candidateMatches: WineCandidate[];
  matchedWineId: number | null;
  source: "database" | "label_only" | null;
  onSaved: () => void;
}) {
  const [fields, setFields] = useState<EntryFields>(initialFields);
  const [varietyText, setVarietyText] = useState(initialFields.grape_variety.join(", "));
  const [edited, setEdited] = useState(false);
  const [rating, setRating] = useState<number | null>(null);
  const [notes, setNotes] = useState("");
  const [showRawText, setShowRawText] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update<K extends keyof EntryFields>(key: K, value: EntryFields[K]) {
    setFields((f) => ({ ...f, [key]: value }));
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
          confidence_fields: confidenceFields,
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
    <div className="flex flex-col gap-4">
      {source === "label_only" && (
        <p className="rounded-lg bg-amber-100 px-3 py-2 text-sm text-amber-900 dark:bg-amber-900/30 dark:text-amber-200">
          Not in our database — filled in from the label only.
        </p>
      )}
      {status === "unrecognized" && (
        <p className="rounded-lg bg-zinc-100 px-3 py-2 text-sm text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
          We couldn&apos;t recognize this confidently. Fill in what you know below.
        </p>
      )}

      <div className="grid grid-cols-2 gap-3">
        <TextField
          label={FIELD_LABELS.wine_name}
          value={fields.wine_name ?? ""}
          onChange={(v) => update("wine_name", v || null)}
          low={isLowConfidence("wine_name", confidenceFields)}
          span2
        />
        <TextField
          label={FIELD_LABELS.producer}
          value={fields.producer ?? ""}
          onChange={(v) => update("producer", v || null)}
          low={isLowConfidence("producer", confidenceFields)}
          span2
        />
        <TextField
          label={FIELD_LABELS.vintage}
          value={fields.vintage?.toString() ?? ""}
          onChange={(v) => update("vintage", v ? parseInt(v, 10) || null : null)}
          low={isLowConfidence("vintage", confidenceFields)}
          type="number"
        />
        <TextField
          label={FIELD_LABELS.abv}
          value={fields.abv?.toString() ?? ""}
          onChange={(v) => update("abv", v ? parseFloat(v) || null : null)}
          low={isLowConfidence("abv", confidenceFields)}
          type="number"
        />
        <TextField
          label={FIELD_LABELS.country}
          value={fields.country ?? ""}
          onChange={(v) => update("country", v || null)}
          low={isLowConfidence("country", confidenceFields)}
        />
        <TextField
          label={FIELD_LABELS.region}
          value={fields.region ?? ""}
          onChange={(v) => update("region", v || null)}
          low={isLowConfidence("region", confidenceFields)}
        />
        <TextField
          label={FIELD_LABELS.grape_variety}
          value={varietyText}
          onChange={(v) => {
            setVarietyText(v);
            update(
              "grape_variety",
              v.split(",").map((s) => s.trim()).filter(Boolean)
            );
          }}
          low={isLowConfidence("grape_variety", confidenceFields)}
          span2
        />
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-foreground/70">{FIELD_LABELS.wine_type}</span>
          <select
            value={fields.wine_type ?? ""}
            onChange={(e) => update("wine_type", e.target.value || null)}
            className="rounded-lg border border-black/10 bg-white/70 px-3 py-2 dark:bg-white/5"
          >
            <option value="">—</option>
            {WINE_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-foreground/70">Rating</span>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setRating(rating === n ? null : n)}
              className={`text-xl ${n <= (rating ?? 0) ? "opacity-100" : "opacity-30"}`}
              aria-label={`${n} star`}
            >
              ⭐
            </button>
          ))}
        </div>
      </div>

      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-foreground/70">Notes</span>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          className="rounded-lg border border-black/10 bg-white/70 px-3 py-2 dark:bg-white/5"
          placeholder="What did you think?"
        />
      </label>

      {rawOcrText && (
        <div className="rounded-lg border border-black/10">
          <button
            type="button"
            onClick={() => setShowRawText((s) => !s)}
            className="w-full px-3 py-2 text-left text-sm font-medium text-foreground/70"
          >
            {showRawText ? "▾" : "▸"} What we read
          </button>
          {showRawText && (
            <pre className="whitespace-pre-wrap break-words border-t border-black/10 px-3 py-2 text-xs text-foreground/60">
              {rawOcrText}
            </pre>
          )}
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        onClick={handleSave}
        disabled={saving}
        className="rounded-full bg-wine px-4 py-3 font-medium text-white transition-transform active:scale-[0.98] disabled:opacity-50"
      >
        {saving ? "Saving…" : "Save to journal"}
      </button>
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  low,
  span2,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  low?: boolean;
  span2?: boolean;
  type?: string;
}) {
  return (
    <label className={`flex flex-col gap-1 text-sm ${span2 ? "col-span-2" : ""}`}>
      <span className="font-medium text-foreground/70">
        {label}
        {low && <span className="ml-1 text-amber-600">(low confidence)</span>}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`rounded-lg border px-3 py-2 dark:bg-white/5 ${
          low ? "border-amber-400 bg-amber-50 dark:bg-amber-900/20" : "border-black/10 bg-white/70"
        }`}
      />
    </label>
  );
}
