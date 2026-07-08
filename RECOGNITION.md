# Recognition Approach

A deep dive into how VinoBuzz Wine Journal turns a label photo into a trustworthy,
editable journal entry — and, more importantly, how it behaves when it *isn't* sure.

---

## 1. The thesis: treat recognition as a pipeline with an independent verifier

The naïve build is `photo → one VLM call → trust the JSON → save`. It demos beautifully
on a crisp label and falls apart on a blurry one, because a vision-language model's
confidence in its own output is **poorly calibrated** — it will happily invent a
plausible producer and rate itself 95%.

So we don't ask the model how sure it is and believe it. We make a **second, independent
source corroborate the answer**: a database of ~130,000 real wines. The model *proposes*
a wine; the database *confirms whether that wine actually exists*. When two independent
signals agree, that's real evidence. When they disagree, we surface the uncertainty
instead of hiding it.

That single decision drives everything the brief asked about uncertainty: confidence
levels, "ask the user to confirm", multiple candidate matches, and graceful failure.

```
                 ┌──────────────────────────────────────────────┐
  photo  ───────►│  POST /api/recognize                          │
                 │                                                │
                 │  Stage 1  VLM extraction (Qwen2.5-VL)          │
                 │    → structured fields + verbatim raw_text     │
                 │    → per-field & overall SELF-confidence       │
                 │            │                                   │
                 │  Stage 2  DB verification (Postgres pg_trgm)   │ ◄── independent verifier
                 │    → top-N real-wine candidates + scores       │
                 │            │                                   │
                 │  Stage 3  Reconcile (deterministic formula)    │
                 │    → status + overall confidence + per-field   │
                 │            │                                   │
                 │  Stage 4  Grounded tasting notes (lazy)        │
                 │    → chips distilled from real reviews         │
                 └───────────────────┬──────────────────────────┘
                                     ▼
        status ∈ { recognized · needs_confirmation · unrecognized }
```

---

## 2. Stage 1 — VLM extraction (`src/lib/vlm.ts`)

The label image (downscaled client-side to ≤1600px for speed) is sent to
**Qwen2.5-VL-72B** via **OpenRouter** as a base64 data URL. The request is:

- **`response_format: json_object`** + a strict schema in the prompt, **Zod-validated**
  on return (`vlmExtractionSchema`). Malformed output is a hard error, not a silent
  half-parse.
- **`temperature: 0`** for determinism.
- **`stream: true`** — the SSE stream is reassembled server-side. Streaming keeps the
  connection warm and lets us surface progress; it also sidesteps some provider-side
  buffering timeouts on large responses.
- **`max_tokens: 1024`** — without a cap, OpenRouter reserves the model's full context
  for billing and can 402 on limited-credit accounts.
- **One retry on 5xx** with a 1s backoff, since the underlying providers occasionally
  blip.

### The one non-negotiable prompt rule: never guess

The model is instructed that **an unreadable field must come back `null` with low
confidence, not a plausible invention**. "Inventing a vintage is a worse failure than
admitting you can't read it." This honesty is load-bearing: Stage 3's confidence math
assumes nulls are truthful.

The model returns two things kept deliberately separate:

- **`raw_text`** — verbatim text it can actually read off the label.
- **structured fields** — `wine_name, producer, vintage, country, region,
  grape_variety[], wine_type, abv`, plus `overall_confidence` and per-field
  `field_confidence`.

Storing raw OCR text separately from conclusions means the app can always **show its
work** ("What we read off the label"), which is both a trust feature for the user and a
debugging aid for us.

### Provider-agnostic by design

Everything model-specific lives behind `recognizeLabel(imageDataUrl)`. A **Gemini 2.5
Flash** implementation is included and used automatically as a fallback if OpenRouter
errors and `GOOGLE_API_KEY` is set. Swapping the primary model to Gemini/GPT/Claude is a
one-line change — the swappability *is* the engineering point, not an afterthought.

---

## 3. Stage 2 — Database verification (`src/lib/match.ts` + `match_wines` SQL)

We build the query string `producer + " " + wine_name` and run a Postgres **trigram
similarity** search over the reference table:

```sql
select id, title, winery, variety, country, province, region_1, vintage, description,
       similarity(lower(coalesce(winery,'') || ' ' || coalesce(title,'')), lower($1)) as score
from wines
order by score desc
limit 5;
```

A **GIN trigram index** (`pg_trgm`) backs it. Trigram was chosen over embeddings
deliberately:

- It's **robust to OCR typos** on names (`Chàteau` → `Chateau`, dropped accents, etc.)
  without any embedding step.
- It's **reliable to ship in a day** with zero extra infra.
- `pgvector` semantic matching is the documented upgrade for paraphrase/synonym
  robustness — scoped as a future improvement, not a core dependency.

The top score is an **independent estimate of "does this wine actually exist"** — the
signal the model cannot fake.

---

## 4. Stage 3 — Reconciliation & the confidence math (`src/lib/confidence.ts`)

This is where the two signals combine. **All of it is a deterministic formula, not an
LLM call**, and every weight/threshold is an exported constant a developer can retune.

### 4a. Routing state machine (`reconcile()`)

| Condition | Status | UX |
|---|---|---|
| best DB score ≥ `HIGH_CONFIDENCE_DB_SCORE` (0.55) and not ambiguous | **recognized** (`database`) | Auto-fill, DB-backed fields marked high-confidence |
| `LOW…` (0.32) ≤ score < `HIGH…`, **or** top-2 within `AMBIGUOUS_GAP` (0.08) | **needs_confirmation** | Show top-3 candidate cards with match bars |
| score < `LOW…` but VLM readable, has name+producer & self-confidence ≥ 0.55 | **recognized** (`label_only`) | Fill from label, banner "not in our database" |
| unreadable, or no name and no match | **unrecognized** | Show raw text + clean manual form |

> **Why the thresholds are 0.55 / 0.32 and not 0.70 / 0.40:** trigram `similarity()` is
> diluted by the extra tokens real DB titles carry (vintage, appellation, "(California)").
> A *strong* real match — e.g. "Kendall-Jackson Chardonnay" against
> "Kendall-Jackson 2012 Avant Chardonnay (California)" — scores ~0.56, not 0.9. The
> thresholds were calibrated to the dataset's actual score distribution. They remain
> heuristics I'd tune on a labelled photo set in production.

### 4b. Overall confidence (the meter you see)

For a database match:

```
overall = W_db · dbScore  +  W_vlm · vlmConfidence  +  W_margin · clamp(margin / MARGIN_NORM)

  W_db = 0.60   ← the independent verifier dominates, on purpose
  W_vlm = 0.25  ← the model's self-opinion is a soft, secondary nudge
  W_margin = 0.15  ← separation between #1 and #2 (a clear winner = less ambiguity)
  MARGIN_NORM = 0.20
```

Special cases:

- **Label-only** (confident read, absent from DB): `min(0.35 + 0.30·vlm, 0.65)` — capped,
  because we genuinely cannot verify it.
- **User-confirmed** (they tapped a candidate): `max(formula, 0.85)` — a human saying "yes,
  this one" is a strong signal and should floor high.

`describeConfidence(score)` maps the number to a phrase + colour: **Very confident /
Confident / Fairly confident / Not sure**.

### 4c. Per-field confidence tiers

Every field gets a tier — **high / moderate / low / missing** — so the user knows
exactly what to trust vs. check:

- Empty value → **missing**.
- Field corroborated by the locked DB record (name, producer, vintage, country, region,
  grape) → **high** (an independent source agrees).
- Otherwise fall back to the VLM's per-field self-confidence:
  ≥ 0.70 high · ≥ 0.45 moderate · else low.

Because `abv` and `wine_type` are **not in the dataset** (see §6), they never get the DB
"high" bump — they're tiered purely on what the model saw on the label. This is exactly
the behaviour you'd want: after you confirm a match, name/region/vintage show **high**
while ABV might show **moderate/low** because only the label vouches for it.

The per-field map is recomputed **client-side** the instant a user picks a candidate
(`computeFieldConfidence` is a pure function shared by server and client), so the tiers
update live to reflect the confirmed match.

---

## 5. Stage 4 — Grounded tasting-note suggestions (`src/lib/tastingNote.ts`)

Most people won't write prose, so we offer one-tap descriptor chips — but we refuse to
free-hallucinate flavours. When there's a DB match we pull the **real Wine Enthusiast
review(s)** for that wine (and others of the same grape) and ask a small LLM to distil
5 short chips *from those reviews only*. If the LLM is unavailable, we fall back to
extracting known descriptor words straight from the reviews — still grounded, just
cruder. With no match at all, chips are clearly generic ("well balanced", "food
friendly").

This runs on a **separate lazy endpoint** (`/api/tasting-suggestions`) fired when the
notes section mounts — so it never adds latency to the critical recognition path.

---

## 6. Data: the dataset, and how vintage & type are derived

**Source:** the open Kaggle *Wine Reviews* dataset (`winemag-data-130k-v2.csv`,
129,971 rows). Columns: `country, description, designation, points, price, province,
region_1, region_2, taster_name, title, variety, winery`.

We do **not** read the CSV/Excel at request time. `scripts/seed_wines.ts` streams it
once into a Postgres `wines` table with a trigram index; every recognition then hits
Postgres, not the file.

Two fields the brief asks for aren't first-class columns in the dataset, so note how each
is derived:

- **Vintage** — there is **no vintage column**. We regex it out of the `title` at seed
  time (`\b(19|20)\d{2}\b`), e.g. *"Quinta dos Avidagos **2011** Avidagos Red (Douro)"* →
  `2011`. At recognition time the vintage primarily comes from the **VLM reading the
  label** (the freshest, most specific source); the DB vintage is a fallback/cross-check.
- **Wine type** (red/white/rosé/…) — also **not in the dataset**. The `variety` column is
  a grape ("Pinot Noir", "Chardonnay") or occasionally a style ("Portuguese Red"), but
  there's no reliable colour classification. So `wine_type` comes **only from the VLM**.
  A future enrichment (see §8) is a grape→colour lookup to backfill it from `variety`.

---

## 7. What works well

- **End-to-end core flow** — photo → recognize → auto-filled, editable entry → saved,
  searchable journal — works on desktop and mobile.
- **Honest uncertainty, made visible** — a real confidence meter, per-field high/moderate/
  low tiers, three distinct UX states, and "what we read" transparency. The app never
  shows one confident guess where it should show doubt.
- **Independent verification** — confidence is anchored to a source the model can't fake,
  which is the whole differentiator.
- **Graceful degradation** — blurry/angled/obscure labels route to confirmation or a
  no-shame manual form instead of a wrong "answer". Image-upload failure doesn't block
  recognition; tasting-note failure doesn't block the UI.
- **Correction as a first-class feature** — every field is inline-editable in both the
  capture flow and the saved entry; edits set `user_edited`.
- **Clean seams** — provider-agnostic VLM, pure/testable confidence + match libs, thin
  API routes. Swapping the model or retuning the math is a localized change.

## 8. Known limitations

- **Dataset coverage & skew** — 130k Wine Enthusiast wines skew toward reviewed/notable
  bottles. Obscure wines correctly land in `label_only` (clearly labelled), but get no DB
  enrichment.
- **Thresholds are heuristic** — calibrated to the dataset's score distribution by hand,
  not against a labelled set of real label photos. They're honest guesses.
- **Trigram limits** — heavy OCR noise or very different naming conventions can miss;
  `similarity()` is also diluted by long DB titles. pgvector is the fix.
- **Duplicate DB rows** — the dataset has many near-duplicate bottlings (same wine,
  different vintages), so candidate lists can look repetitive.
- **`wine_type` / `abv` are label-only** — never DB-verified, by dataset design.
- **Single-label assumption** — one bottle per photo.
- **No auth** — the demo journal is a single shared history with public RLS policies.

## 9. What I'd improve with more time

- **Calibrate on real photos** — assemble a labelled set of label shots, measure
  recognition precision/recall, and fit the weights/thresholds instead of hand-picking
  them.
- **pgvector semantic matching** — embed `winery + title`, ANN search; robust to OCR
  noise and paraphrase where trigram misses.
- **Learn from corrections** — `user_edited` diffs are labelled training data; feed them
  back to improve extraction and recalibrate confidence over time.
- **Multi-crop / de-skew preprocessing** for angled or partial labels before the VLM.
- **Grape→colour enrichment** to backfill `wine_type` from `variety`, and vintage
  reconciliation between label and DB.
- **De-duplicate candidates** by collapsing bottlings that differ only by vintage.
- **Cache by image hash** so re-uploading the same photo doesn't re-charge the model.

---

## 10. File map

| Path | Role |
|---|---|
| `src/lib/vlm.ts` | Provider-agnostic VLM extraction (Qwen2.5-VL / Gemini), streaming, retry |
| `src/lib/match.ts` | DB candidate query + reconciliation state machine |
| `src/lib/confidence.ts` | **All confidence math** — formulas, weights, thresholds, per-field tiers |
| `src/lib/tastingNote.ts` | Grounded tasting-note chip generation |
| `src/lib/schema.ts` | Zod contracts for the VLM output, API responses, and entries |
| `src/app/api/recognize/route.ts` | Orchestrates Stages 1–3 |
| `src/app/api/tasting-suggestions/route.ts` | Stage 4 (lazy) |
| `src/app/api/entries/[id]/route.ts` | Get / edit / delete a saved entry |
| `scripts/seed_wines.ts` | One-time CSV → Postgres loader |
| `supabase/schema.sql` | Tables, trigram index, `match_wines` RPC, RLS |
