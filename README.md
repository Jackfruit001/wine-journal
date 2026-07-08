# 🍷 VinoBuzz Wine Journal — Take-Home Demo

An AI-powered wine journal. Photograph a wine label, and the app recognizes the wine, auto-creates a dated journal entry, and lets you correct anything before saving to a searchable history.

**Live demo:** _<paste Vercel link>_
**Screen recording:** _<paste link>_

> Built as a prototype. The focus is AI *product judgement* — specifically, being honest about uncertainty — over feature count.

---

## What it does

1. Capture or upload a photo of a wine label (camera-first on mobile).
2. AI reads the label and proposes the wine.
3. The app creates a journal entry dated today, auto-filling wine name, producer, vintage, region/country, grape variety, type, and ABV where possible.
4. It shows **how confident** it is and **exactly what text it read**, and every field is editable.
5. When it isn't sure, it says so — offering candidate matches to confirm, or a clean manual form, instead of guessing.
6. Saved entries appear in a searchable journal.

---

## How to run

```bash
git clone <repo> && cd vinobuzz-wine-journal
cp .env.local.example .env.local     # fill in the keys below
npm install

# one-time Supabase setup:
#   1. run supabase/schema.sql in the SQL editor (tables + pg_trgm + match_wines RPC)
#   2. create a PUBLIC storage bucket named "wine-journal"

# one-time: load the wine reference database
# download Kaggle "Wine Reviews" -> place winemag-data-130k-v2.csv in /data
npm run seed

npm run dev                          # http://localhost:3000
```

**Environment variables**

```
OPENROUTER_API_KEY=          # VLM (Qwen2.5-VL). Or GOOGLE_API_KEY for the Gemini fallback.
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

> **Deep dive:** [`RECOGNITION.md`](./RECOGNITION.md) documents the full pipeline, the
> confidence math (formulas + tunable constants), how vintage/type are derived from the
> dataset, and a thorough limitations/future-work analysis.

---

## What AI / model / API I used

- **Vision-language model:** **Qwen2.5-VL** (open-weight) via **OpenRouter**, for reading the label and extracting structured fields + raw text in one pass.
- **Provider-agnostic by design:** all model access sits behind `lib/vlm.ts`, so the backend can switch to Gemini 2.5 Flash, GPT, or Claude with a one-line change. A Gemini fallback is included.
- **Wine reference database:** the open Kaggle *Wine Reviews* dataset (~130k real wines with tasting notes), loaded into Postgres.
- **Matching:** Postgres `pg_trgm` trigram similarity (fuzzy, OCR-typo tolerant). `pgvector` semantic matching is scoped as an upgrade.

---

## Recognition approach

Recognition is treated as a **pipeline with an independent verifier**, not a single model call:

1. **Extract (VLM).** The model returns structured fields, the raw text it read, and per-field confidence. It is instructed **not to guess** — unreadable fields come back `null`, not invented.
2. **Verify (database).** The proposed `producer + name` is matched against ~130k real wines. This is an *independent* check on whether the wine actually exists — a signal the model can't fake.
3. **Reconcile.** Overall confidence is a **deterministic formula** (`lib/confidence.ts`), derived **primarily from the database match** (weight 0.6) with the VLM's self-confidence as a soft nudge (0.25) and candidate separation as a tiebreaker (0.15). The result routes to one of three states:
   - **Recognized** — strong match; fields auto-filled.
   - **Needs confirmation** — plausible but ambiguous; top candidate wines shown with match bars for a one-tap confirm.
   - **Unrecognized** — can't confirm; the raw text is shown and the user fills a clean form.
   Every field also gets a **high / moderate / low** confidence tier, so the user knows what to trust vs. check.
4. **Ground.** Suggested tasting-note chips are distilled from *real* reviews of the matched/similar wines, and clearly labeled as AI suggestions — not free-form hallucination.

Raw OCR text is stored separately from conclusions, so the system always shows its work.

**Full write-up with the confidence formulas is in [`RECOGNITION.md`](./RECOGNITION.md).**

---

## What works well

- End-to-end flow from photo to saved, editable journal entry.
- Honest uncertainty: confidence badges, low-confidence fields flagged, and three distinct UX states instead of one confident guess.
- Graceful handling of blurry / angled / cropped labels — they route to confirmation or manual entry rather than a wrong "answer."
- Correction is first-class: every field is inline-editable; edits are recorded.
- Mobile-first, camera-first, minimal typing.

---

## Known limitations

- **Database coverage.** ~130k wines skews toward reviewed/notable bottles; obscure wines are handled as "from the label only," clearly labeled, but won't get database enrichment.
- **Confidence thresholds are heuristic**, not calibrated on a labeled photo set.
- **Trigram matching** can miss on heavy OCR noise or very different naming conventions (the pgvector path addresses this).
- **Single-label assumption** — one bottle per photo.
- **VLM self-reported field confidence** is used only as a soft signal, by design.

---

## What I'd improve with more time

- Calibrate thresholds on a labeled set of real label photos; measure recognition precision/recall.
- Capture user corrections (`user_edited`) as labeled training data to improve extraction over time.
- `pgvector` semantic matching for robustness to OCR noise and paraphrase.
- Multi-crop / de-skew preprocessing for angled labels.
- A lightweight two-tap "confirm producer + vintage" flow for the ambiguous case.
- Cache by image hash to avoid re-charging for repeat photos.

---

## Architecture

```
photo → /api/recognize
          ├─ Stage 1  VLM extraction (Qwen2.5-VL)      → fields + raw text + confidence
          ├─ Stage 2  Postgres pg_trgm match           → candidates + scores  (verifier)
          ├─ Stage 3  Reconcile                        → status + confidence
          └─ Stage 4  Grounded tasting note (bonus)     → RAG over real reviews
       → frontend renders recognized / needs_confirmation / unrecognized
       → Supabase (Postgres + Storage)
```

Tech: Next.js (App Router) + TypeScript + Tailwind · Supabase (Postgres + Storage) · Qwen2.5-VL via OpenRouter · Vercel.
