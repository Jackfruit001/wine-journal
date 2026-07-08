"use client";

import type { EntryFields } from "@/lib/schema";
import type { FieldConfidenceMap, FieldConfLevel } from "@/lib/confidence";

const WINE_TYPES = ["Red", "White", "Rose", "Sparkling", "Dessert", "Fortified", "Other"];

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

const LEVEL_META: Record<FieldConfLevel, { label: string; dot: string; text: string }> = {
  high: { label: "high", dot: "bg-emerald-500", text: "text-emerald-600 dark:text-emerald-400" },
  moderate: { label: "moderate", dot: "bg-amber-500", text: "text-amber-600 dark:text-amber-400" },
  low: { label: "low", dot: "bg-rose-500", text: "text-rose-600 dark:text-rose-400" },
  missing: { label: "missing", dot: "bg-zinc-400", text: "text-zinc-500" },
};

function ConfChip({ level }: { level: FieldConfLevel }) {
  const meta = LEVEL_META[level];
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-medium ${meta.text}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
      {meta.label}
    </span>
  );
}

/**
 * The editable wine-field grid, shared by the recognition flow and the journal
 * detail view. Each field shows its confidence tier so the user knows what to
 * trust and what to check.
 */
export function WineFieldsEditor({
  fields,
  onChange,
  fieldConfidence,
}: {
  fields: EntryFields;
  onChange: (next: EntryFields) => void;
  fieldConfidence?: FieldConfidenceMap | null;
}) {
  function set<K extends keyof EntryFields>(key: K, value: EntryFields[K]) {
    onChange({ ...fields, [key]: value });
  }

  const conf = (key: keyof EntryFields): FieldConfLevel | null => fieldConfidence?.[key] ?? null;

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <TextField
        label={FIELD_LABELS.wine_name}
        value={fields.wine_name ?? ""}
        onChange={(v) => set("wine_name", v || null)}
        level={conf("wine_name")}
        span2
      />
      <TextField
        label={FIELD_LABELS.producer}
        value={fields.producer ?? ""}
        onChange={(v) => set("producer", v || null)}
        level={conf("producer")}
        span2
      />
      <TextField
        label={FIELD_LABELS.vintage}
        value={fields.vintage?.toString() ?? ""}
        onChange={(v) => set("vintage", v ? parseInt(v, 10) || null : null)}
        level={conf("vintage")}
        type="number"
      />
      <TextField
        label={FIELD_LABELS.abv}
        value={fields.abv?.toString() ?? ""}
        onChange={(v) => set("abv", v ? parseFloat(v) || null : null)}
        level={conf("abv")}
        type="number"
      />
      <TextField
        label={FIELD_LABELS.country}
        value={fields.country ?? ""}
        onChange={(v) => set("country", v || null)}
        level={conf("country")}
      />
      <TextField
        label={FIELD_LABELS.region}
        value={fields.region ?? ""}
        onChange={(v) => set("region", v || null)}
        level={conf("region")}
      />
      <TextField
        label={FIELD_LABELS.grape_variety}
        value={fields.grape_variety.join(", ")}
        onChange={(v) =>
          set(
            "grape_variety",
            v.split(",").map((s) => s.trim()).filter(Boolean)
          )
        }
        level={conf("grape_variety")}
        span2
      />
      <label className="flex flex-col gap-1 text-sm">
        <span className="flex items-center justify-between font-medium text-foreground/70">
          {FIELD_LABELS.wine_type}
          {conf("wine_type") && <ConfChip level={conf("wine_type")!} />}
        </span>
        <select
          value={fields.wine_type ?? ""}
          onChange={(e) => set("wine_type", e.target.value || null)}
          className="rounded-lg border border-black/10 bg-white/70 px-3 py-2 dark:border-white/10 dark:bg-white/5"
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
  );
}

function TextField({
  label,
  value,
  onChange,
  level,
  span2,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  level?: FieldConfLevel | null;
  span2?: boolean;
  type?: string;
}) {
  const isLow = level === "low" || level === "missing";
  return (
    <label className={`flex flex-col gap-1 text-sm ${span2 ? "sm:col-span-2" : ""}`}>
      <span className="flex items-center justify-between font-medium text-foreground/70">
        {label}
        {level && <ConfChip level={level} />}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`rounded-lg border px-3 py-2 outline-none transition-colors focus:border-wine dark:bg-white/5 ${
          isLow
            ? "border-amber-400/70 bg-amber-50 dark:bg-amber-900/15"
            : "border-black/10 bg-white/70 dark:border-white/10"
        }`}
      />
    </label>
  );
}
