# 🍷 VinoBuzz Wine Journal

Photograph a wine label; the app reads it, tries to identify the wine against a
database of real wines, and creates a dated journal entry you can correct and save.
It's built as a prototype — the emphasis is on getting the recognition flow working
end to end and on being honest when the AI isn't sure, rather than on feature count.

**Live demo:** <link>https://wine-journal-tau.vercel.app</link>
**Screen recording:** _<paste link>_

---

## What it does

1. Take or upload a photo of a wine label (camera-first on mobile).
2. A vision model reads the label and proposes the wine.
3. The proposal is checked against ~130k real wines; the app computes a confidence
   score and routes to one of three outcomes:
   - **Recognized** — fields auto-filled, confidence shown.
   - **Needs confirmation** — a few close matches offered to pick from.
   - **Unrecognized** — the raw text is shown and you fill a clean form.
4. Every field is editable, each shows a per-field confidence tag, and you can add a
   rating and tasting notes (with one-tap AI suggestions).
5. Saved entries appear in a searchable journal; click any entry to view and edit it.

---

## How to run

**Prerequisites:** Node 18+, a Supabase project, and an OpenRouter API key
(optionally a Google AI Studio key for the fallback).

```bash
git clone <repo> && cd wine-journal
cp .env.local.example .env.local     # fill in the keys below
npm install
```

**1. Environment variables** (`.env.local`)

```
OPENROUTER_API_KEY=            # primary VLM (Qwen2.5-VL)
GOOGLE_API_KEY=                # optional: Gemini fallback
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

**2. Supabase setup**
- Run [`supabase/schema.sql`](./supabase/schema.sql) in the SQL editor. It creates the
  `wines` and `entries` tables, the `pg_trgm` extension + trigram index, the
  `match_wines` search function, and permissive RLS policies for the demo.
- Create a **public** Storage bucket named `wine-journal` (holds the label images).

**3. Seed the wine database**
- Download the Kaggle [*Wine Reviews*](https://www.kaggle.com/datasets/zynicide/wine-reviews)
  dataset and place `winemag-data-130k-v2.csv` in `/data`.
- `npm run seed` — streams ~130k rows into Postgres (a few minutes).

**4. Run**
```bash
npm run dev          # http://localhost:3000
npm test             # unit tests for the confidence math + reconcile logic
```

**Deploy:** push to GitHub, import into Vercel, set the same env vars, deploy.

---

## What AI / models / APIs I used

- **Vision-language model — Qwen2.5-VL (open-weight) via OpenRouter.** Reads the label
  and returns structured fields + the raw text it read + per-field self-confidence, in
  one call. Chosen because it has strong OCR / document understanding, is open-weight,
  and is hosted (no GPU to manage).
- **Provider-agnostic layer.** All model access sits behind `lib/vlm.ts`. A **Gemini
  2.5 Flash** implementation is included and used automatically if the OpenRouter call
  fails and a Google key is set. Switching the primary model is a one-line change.
- **Wine reference database — Kaggle *Wine Reviews* (~130k wines).** Loaded into
  Postgres. It doubles as the identity check and as the grounding source for tasting
  notes (it carries real review text).
- **Matching — Postgres `pg_trgm`** trigram similarity: fuzzy, tolerant of OCR typos,
  no embedding step.

---

## Recognition approach

Instead of trusting a single model call, recognition runs as a short pipeline where the
database independently checks the model's answer:

```
photo → /api/recognize
   1. Extract   (Qwen2.5-VL)   → fields + raw_text + self-confidence
   2. Verify    (pg_trgm)      → top candidates from ~130k real wines + scores
   3. Reconcile (formula)      → status + overall confidence + per-field tiers
   4. Notes     (lazy, grounded) → tasting-note chips from real reviews
```

**Why a verifier instead of the model's own confidence.** A vision model rating its own
output is poorly calibrated — it stays confident even when it has misread a label. So I
use the **database match as the primary confidence signal**, because it's independent of
the model that might be wrong. When both agree, that's real evidence; when they don't,
the app asks the user rather than guessing.

**The model is told not to guess.** Unreadable fields must come back `null` with low
confidence, not an invented value. The reconciliation math relies on nulls being honest.
The raw text the model read is stored separately from the conclusions, so the app can
always show its work ("What we read off the label").

### The confidence math (deterministic, in `lib/confidence.ts`)

None of this is an LLM call — it's a formula with constants a developer can retune.

- **Overall confidence** for a database match:
  ```
  overall = 0.60·dbScore + 0.25·vlmConfidence + 0.15·clamp(margin / 0.20)
  ```
  The DB match dominates (0.60); the model's self-confidence is a soft nudge (0.25);
  the gap between the #1 and #2 candidates breaks ties (0.15). Label-only wines (read
  confidently but absent from the DB) are capped at 0.65 because we can't verify them; a
  user confirming a candidate floors at 0.85.
- **Routing** on the best trigram score:

  | Condition | Status |
  |---|---|
  | score ≥ 0.55 and not ambiguous | `recognized` (from database) |
  | 0.32 ≤ score < 0.55, or top-2 within 0.08 | `needs_confirmation` |
  | score < 0.32 but a confident readable label | `recognized` (label-only) |
  | unreadable / no name / no match | `unrecognized` |

  > The thresholds are 0.55 / 0.32 rather than something higher because trigram
  > similarity is diluted by the extra tokens real DB titles carry (vintage, appellation,
  > "(California)"). A strong match — e.g. "Kendall-Jackson Chardonnay" vs.
  > "Kendall-Jackson 2012 Avant Chardonnay (California)" — scores ~0.56, not 0.9. I tuned
  > them against the dataset's actual score distribution; they'd want proper calibration
  > on labelled photos in production.

- **Per-field tiers (high / moderate / low / missing).** A field confirmed by the matched
  DB record is `high`; otherwise it falls back to the model's per-field confidence
  (≥0.70 high, ≥0.45 moderate, else low); empty is `missing`. This is why, after you
  confirm a match, name/region/vintage read `high` while ABV may read lower — only the
  label vouches for ABV (see below).

### How vintage and wine type are derived

The Kaggle dataset has no `vintage` or `wine_type` column, so it's worth being explicit:

- **Vintage** — parsed with a regex from the wine `title` at seed time
  (`"…2011 Avidagos Red"` → 2011). At recognition, the vintage comes mainly from the
  model reading the label; the DB value is a fallback.
- **Wine type (red/white/…)** — not in the dataset at all (the `variety` column is a
  grape). So `wine_type` comes only from the model. That's why it's never DB-confirmed
  and shows lower confidence than DB-backed fields — an honest reflection of its source.

---

## What works well

- The core flow works end to end on desktop and mobile: photo → recognize → editable,
  auto-filled entry → saved, searchable journal → reopen and edit.
- Uncertainty is visible and honest: an overall confidence meter, per-field confidence
  tags, three distinct outcome states, and a "what we read" view. The app doesn't show a
  single confident guess where it should show doubt.
- Fallback handling is real: OpenRouter → Gemini failover, one retry on transient 5xx,
  and graceful degradation (a failed image upload or a failed tasting-note call never
  breaks recognition or saving).
- Correction is first-class: everything is inline-editable in both the capture flow and
  the saved entry, and edits set `user_edited`.
- The logic is separable and tested: the confidence math and matching are pure
  functions with unit tests (`npm test`, 21 cases), and provider details are isolated
  behind one file.

## Known limitations

- **Assumes a legible label.** Recognition works from label text; a bare/unlabelled
  bottle or a decanter can't be identified from pixels alone. In practice wine bottles
  almost always carry a label (it's legally required), so this is a boundary rather than
  a common failure — but it's real.
- **Database coverage & skew.** ~130k Wine Enthusiast wines skew toward reviewed/notable
  bottles. Obscure wines land in `label_only` (clearly labelled) with no DB enrichment.
- **Thresholds are heuristic**, tuned to the dataset's score distribution by hand, not
  calibrated on labelled label photos.
- **Trigram limits.** Heavy OCR noise or very different naming can miss; long DB titles
  dilute similarity. The dataset also contains many near-duplicate bottlings, so
  candidate lists look repetitive.
- **No auth** — the demo journal is a single shared history. Tests cover the pure logic;
  the network/DB paths are exercised manually.

---

## Project structure

```
src/
  app/
    page.tsx                        capture → reading → result → saved flow
    journal/page.tsx                searchable history (grid)
    journal/[id]/page.tsx           entry detail + edit
    api/recognize/route.ts          orchestrates extract → verify → reconcile
    api/entries/route.ts            list / create entries
    api/entries/[id]/route.ts       get / edit / delete one entry
    api/tasting-suggestions/route.ts grounded note chips (lazy)
  lib/
    vlm.ts            provider-agnostic VLM extraction (Qwen2.5-VL / Gemini)
    match.ts          DB candidate query + reconciliation state machine
    confidence.ts     all confidence math — weights, thresholds, per-field tiers
    tastingNote.ts    grounded tasting-note generation
    schema.ts         Zod contracts (VLM output, API responses, entries)
    storage.ts        label-image upload to Supabase Storage
    supabase.ts       client + admin (service-role) helpers
    image.ts          client-side downscale before upload
  components/         capture button, result states, confidence meter, editors, journal
scripts/seed_wines.ts CSV → Postgres loader
supabase/schema.sql   tables, trigram index, match_wines function, RLS
tests/                unit tests for confidence.ts and match.ts (reconcile)
```

**Stack:** Next.js (App Router) + TypeScript + Tailwind · Supabase (Postgres + Storage) ·
Qwen2.5-VL via OpenRouter (Gemini fallback) · deployed on Vercel.
