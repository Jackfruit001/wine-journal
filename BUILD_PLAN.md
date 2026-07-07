# VinoBuzz Take-Home — Build Plan & Reasoning

**Assignment:** AI-powered wine journal. Photo of a label → recognize the wine → auto-create a dated journal entry → user can correct → saved to a browsable journal.
**Deadline:** 2026-07-08, 12:00 noon. **Time budget:** ~1 day.
**Goal:** Not a production app. A clear working prototype with *strong AI product judgement* — especially around uncertainty — and clean engineering.

---

## 0. The one idea that wins this

Most candidates will build: `photo → single VLM call → trust the answer → save`. It demos fine on a clean label and falls apart on a blurry one. The CTO's email spends a whole section on *"how you approach uncertainty."* That is the actual test.

**Our differentiator: recognition is a pipeline, not a single model call — and a real wine database is used as an *independent verifier* of the AI, not just a data source.**

The VLM reads the label and proposes a wine. We then independently check that proposal against a database of ~130k real wines. Agreement between two independent signals (what the model *read* vs. what actually *exists*) is what produces a trustworthy confidence score. That single decision drives everything the CTO said they care about: confidence levels, "ask the user to confirm," multiple candidate matches, graceful failure.

This is the thing to say in the interview: *"I didn't trust the VLM's self-reported confidence, because VLM confidence is famously miscalibrated. I made the database corroborate it. Two independent sources agreeing is a real signal; a model saying '95%' about its own hallucination is not."*

---

## 1. What VinoBuzz actually values (design principles)

From the email + their live site (`vinobuzz.ai` — "perfect bottle in 10 seconds, no wine knowledge needed," mobile-first, brand color `#8b1a1a` wine red):

1. **Speed & low friction.** Capture a wine memory in seconds. Camera-first, minimal typing.
2. **No wine expertise assumed.** Plain language, sensible defaults, nothing intimidating.
3. **Honesty about uncertainty.** Never fake a confident answer. Degrade gracefully.
4. **Correction is a feature, not an error path.** Editing should feel native, not like fixing the app's mistake.
5. **Mobile-first.** They ship a mobile web app. So do we.

Mirror their aesthetic (wine-red accent, clean, calm) so it visibly "belongs" to their product. This signals you studied them.

---

## 2. Architecture

```
                    ┌─────────────────────────────────────────────┐
   photo  ─────────►│  /api/recognize  (Next.js server route)     │
 (camera/upload)    │                                             │
                    │  Stage 1  VLM extraction (Qwen2.5-VL)        │
                    │    → structured fields + raw OCR text        │
                    │    → per-field + overall self-confidence     │
                    │            │                                 │
                    │  Stage 2  DB match (Postgres pg_trgm)        │
                    │    → top-N candidates + similarity scores    │  ◄── independent verifier
                    │            │                                 │
                    │  Stage 3  Reconcile                          │
                    │    → combine signals → status + confidence   │
                    │    → fill gaps from best DB match            │
                    │            │                                 │
                    │  Stage 4  (bonus) Grounded tasting note      │
                    │    → RAG over real reviews of similar wines  │
                    └───────────────────┬─────────────────────────┘
                                        ▼
                         { status, confidence, fields,
                           raw_text, candidates[], tasting_note }
                                        ▼
     ┌───────────────────── Frontend (Next.js + Tailwind) ─────────────────────┐
     │  Result card → confidence badge → editable fields → Save                │
     │  Three UX states driven by `status` (see §5)                            │
     │  Journal list / history + search                                        │
     └─────────────────────────────────────────────────────────────────────────┘
                                        ▼
                          Supabase (Postgres + Storage)
```

---

## 3. Tech stack + why (have these reasons ready — they will ask)

| Layer | Choice | Why this, not the alternative |
|---|---|---|
| App | **Next.js (App Router) + TypeScript** | One codebase, one deploy, server routes keep API keys off the client. Rejected a separate Python/FastAPI backend: for a 1-day demo, a second service doubles deploy/debug surface for zero benefit — the AI work here is API calls + SQL, not heavy Python. |
| UI | **Tailwind CSS**, mobile-first | Fast to build a clean, consistent, responsive UI. Matches their mobile-web-app product. |
| VLM | **Qwen2.5-VL** via **OpenRouter** | Open-weight (you asked for open source), strong native OCR + document/structured understanding, ~GPT-4o-level on DocVQA, cheap, and no GPU to manage (hosted). Wrapped behind `lib/vlm.ts` so it's a one-line swap to Gemini 2.5 Flash / GPT / Claude. Swappability *is* the engineering point. |
| DB + storage | **Supabase (Postgres + Storage)** | Deploys instantly, pairs with Vercel, `pg_trgm` gives fuzzy matching with zero extra infra, `pgvector` available if we upgrade to semantic matching. You already use it. |
| Wine dataset | **Kaggle "Wine Reviews"** (~130k, Wine Enthusiast) | Open, fully local, no per-call cost or rate limit, and it carries **real tasting notes** — so it doubles as (a) the identity verifier and (b) the grounding corpus for suggested tasting notes. |
| Deploy | **Vercel** | One-click from the repo, gives the "working demo link" deliverable. Deploy the skeleton in hour 1 so "it's live" is never a last-minute risk. |
| Matching | **`pg_trgm` trigram similarity** (baseline), **`pgvector`** (optional upgrade) | Trigram handles OCR typos on `producer + name` with no embedding step — reliable in a day. pgvector/embeddings is the documented upgrade path for paraphrase/synonym robustness. |

**Fallback plan if OpenRouter/Qwen is flaky during the build:** flip `lib/vlm.ts` to **Gemini 2.5 Flash** (generous free tier, fast, strong vision). Because everything is behind one interface, this is a 5-minute change, not a rewrite. Mention this abstraction in the README — it reads as maturity.

---

## 4. Data model

Single table `entries` (plus optional `wines` reference table from the dataset).

```
entries
  id                uuid pk
  created_at        timestamptz default now()   -- the "today's date" the entry auto-fills
  image_url         text                        -- Supabase Storage; nullable (degrade gracefully)
  -- recognized / edited fields
  wine_name         text
  producer          text
  vintage           int
  country           text
  region            text
  grape_variety     text[]                       -- array; may be empty
  wine_type         text                         -- red/white/rosé/sparkling/…
  abv               numeric
  -- AI transparency (this is what impresses)
  raw_ocr_text      text                         -- exactly what the model read off the label
  recognition_status text                        -- 'recognized' | 'needs_confirmation' | 'unrecognized'
  confidence        numeric                      -- 0..1 overall (our computed score, not the VLM's)
  confidence_fields jsonb                        -- per-field confidence, for amber-flagging
  candidate_matches jsonb                        -- top-N DB candidates shown to user
  matched_wine_id   text                         -- which DB wine we locked to (nullable)
  source            text                         -- 'database' | 'label_only' -> shown to user
  -- user layer
  user_edited       boolean default false        -- did the human correct anything? (a real signal)
  tasting_note      text                         -- AI-suggested, grounded, clearly labeled
  user_rating       int                          -- 1..5, optional
  user_notes        text                         -- free text
```

Design notes to defend:
- `raw_ocr_text` stored separately from conclusions → **transparency**. The user (and you, debugging) can always see *what was read* vs *what was inferred*.
- `source` = `label_only` vs `database` → we're honest when a wine isn't in our DB rather than pretending certainty.
- `user_edited` → in production this is gold: every human correction is a labeled training example. Call this out under "what I'd improve."

---

## 5. The recognition pipeline (the core)

### Stage 1 — VLM extraction
Send the image to Qwen2.5-VL with a strict JSON-schema prompt. Key prompt rules:
- Return `raw_text` (verbatim text you can read on the label) **separately** from structured fields.
- Extract: `wine_name, producer, vintage, country, region, grape_variety[], wine_type, abv`.
- **Do not guess.** If a field is not visible/legible, return `null` and lower its confidence. Inventing a vintage or producer is worse than admitting you can't read it.
- Return `overall_confidence` and `field_confidence{}` in [0,1].
- If the image has no legible wine label, set `readable:false`.

Enforce structure via JSON response mode / a parser (Zod validate the response). This ties to structured-output discipline (BAML/Instructor-style) — mention it.

### Stage 2 — DB match (the independent verifier)
Normalize `producer + " " + wine_name`, query Postgres:
```sql
select id, title, winery, variety, country, province, region_1, description,
       similarity(lower(winery||' '||title), lower($1)) as score
from wines
order by score desc
limit 5;
```
(`pg_trgm` + a GIN trigram index.) The top score is an **independent** estimate of "does this wine actually exist."

### Stage 3 — Reconcile → status + confidence
Concrete, explainable heuristic (tune later; say so):

| Condition | Status | UX |
|---|---|---|
| best DB score ≥ 0.70 (and VLM read a name) | `recognized` (high) | Auto-fill from DB record; `source=database` |
| 0.40 ≤ best DB score < 0.70, or top-2 candidates within ~0.08 | `needs_confirmation` | Show top-3 candidate cards + the VLM guess; user taps the right one |
| best DB score < 0.40, but VLM `readable` and has name+producer & high self-confidence | `recognized` (medium) | Fill from label; `source=label_only`, banner "not in our database — from the label" |
| VLM `readable:false`, or no name and no DB match | `unrecognized` | Show `raw_text`, empty editable form, friendly "couldn't recognize confidently" message |

`confidence` (0..1) surfaced to the user is derived mainly from the DB match score, nudged by VLM self-confidence — **not** the VLM number alone. Gap-fill: where VLM returned `null` but the locked DB record has the field, fill it (flag as inferred).

**Interview line:** *"The database match is the primary confidence signal precisely because it's independent of the model that might be hallucinating. The thresholds are heuristics I'd calibrate on a labeled photo set in production."*

### Stage 4 (bonus) — Grounded tasting note
Don't let the model free-hallucinate flavors. Retrieve real `description`s from the matched wine and/or same variety+region, then have the LLM synthesize a 1–2 sentence *suggested* note, labeled **"AI-suggested tasting note, based on similar wines."** Grounding = defensible, on-brand for an AI-wine company, and connects to their core matching product.

---

## 6. Frontend states (mobile-first)

- **Capture:** big camera/upload button. `<input type="file" accept="image/*" capture="environment">` for native camera on mobile. Optional client-side downscale before upload (speed).
- **Reading…:** simple progress ("Reading the label…"). Under ~10s is the bar (their promise).
- **Result card**, branched by `status`:
  - *recognized* → filled fields, green/amber confidence badge, low-confidence fields tinted amber, collapsible "What we read" (raw text).
  - *needs_confirmation* → "We think it's one of these" → 3 tappable candidate cards + "None of these / edit manually."
  - *unrecognized* → "We couldn't read this confidently" → editable form pre-filled with raw text, no shame framing.
- **Every field editable inline.** Saving after edit sets `user_edited=true`.
- **Save** → journal.
- **Journal / history:** cards (image, name, vintage, date, rating). **Search** by name/producer/variety/country (bonus) — trivial with Postgres `ilike`/trgm.

---

## 7. Bonus items — do only if core is solid, in this order
1. **Graceful bad-photo handling** — already emergent from the pipeline. Just *test it on purpose* with a blurry/angled/cropped shot and make sure it lands in `needs_confirmation`/`unrecognized` cleanly. This is the highest-value bonus because it's literally the "uncertainty" evaluation criterion, demonstrated live.
2. **Grounded tasting notes** (§Stage 4).
3. **Search/history UX** — filters by type/country/rating.
4. **Semantic matching** via pgvector (embed `winery+title`, ANN search) — better on OCR noise/paraphrase. Frame as the upgrade over trigram.

---

## 8. Repo structure (for Claude Code)

```
vinobuzz-wine-journal/
  README.md
  .env.local.example
  package.json
  next.config.js
  tailwind.config.ts
  /scripts
    seed_wines.ts          # load Kaggle CSV → Supabase, create pg_trgm index
  /src
    /app
      page.tsx             # capture + result flow
      /journal/page.tsx    # history + search
      /api/recognize/route.ts
      /api/entries/route.ts
    /components
      CaptureButton.tsx
      RecognitionResult.tsx  # the 3 states
      ConfidenceBadge.tsx
      CandidatePicker.tsx
      EntryForm.tsx
      JournalList.tsx
    /lib
      vlm.ts               # recognizeLabel(image) — provider-agnostic (the swap point)
      match.ts             # DB fuzzy match + reconcile + confidence
      tastingNote.ts       # grounded note (bonus)
      supabase.ts
      schema.ts            # Zod schemas for the VLM JSON contract
```

Keep `lib/` pure and testable; keep provider details behind `vlm.ts`. That separation is the "clean engineering" they grade.

---

## 9. Build order (hour-by-hour, ~11h + buffer)

1. **H0–1:** Scaffold Next.js + Tailwind + Supabase client. Deploy empty skeleton to Vercel → **get the live link now** so it's never a last-minute risk. Create `entries` table.
2. **H1–2:** `seed_wines.ts` — load Kaggle CSV into `wines`, add trigram index. Verify a sample fuzzy query.
3. **H2–4:** `lib/vlm.ts` + `/api/recognize` Stage 1. Get clean structured JSON off a real label. Zod-validate.
4. **H4–5:** `lib/match.ts` — Stages 2–3 (match + reconcile + confidence + status).
5. **H5–7:** Frontend capture → `RecognitionResult` (3 states) → `EntryForm` (editable) → Save.
6. **H7–8:** Journal list + search.
7. **H8–9:** Bonus: grounded tasting note; **deliberately test blurry/angled/cropped**.
8. **H9–10:** Mobile polish (wine-red brand), empty/error states, test 5–6 real bottles.
9. **H10–11:** Finalize README, record 2–3 min screen recording (show a clean hit *and* a graceful miss), final deploy.

Ship the core before touching bonuses. A rock-solid core beats a broken feature list.

---

## 10. Claude Code kickoff prompt (paste this first)

> Build a mobile-first AI wine journal in **Next.js (App Router) + TypeScript + Tailwind**, deployed to Vercel, backed by **Supabase (Postgres + Storage)**. Follow the attached BUILD_PLAN.md exactly — architecture, data model, and the 4-stage recognition pipeline in §5.
>
> Core flow: user photographs a wine label → `/api/recognize` runs (1) VLM extraction via `lib/vlm.ts` (Qwen2.5-VL through OpenRouter, provider-agnostic interface), (2) Postgres `pg_trgm` fuzzy match against a `wines` table, (3) reconciliation that computes an overall confidence **primarily from the DB match, not the VLM's self-confidence**, returning status `recognized | needs_confirmation | unrecognized`. Frontend renders the correct one of three states, shows a confidence badge, flags low-confidence fields, exposes the raw OCR text in a "What we read" section, makes every field inline-editable, and saves to a searchable journal.
>
> Requirements: never fabricate fields the label doesn't show (return null + low confidence); store `raw_ocr_text` separately from conclusions; keep `lib/vlm.ts` swappable to Gemini/GPT/Claude; validate the VLM JSON with Zod. Read your frontend-design skill for the UI. Start by scaffolding + deploying an empty skeleton to Vercel so the live link works early, then build in the order in §9. Ask me for env keys when you need them.

Then feed it `seed_wines.ts` needs, the schema, and iterate route-by-route.

---

## 11. Interview defense cheat sheet

- **Why a pipeline, not one VLM call?** Independent corroboration. A model's confidence in its own output is miscalibrated; a second, independent source (does this wine exist in a 130k DB?) is a real signal. Agreement → trust; disagreement → ask the user.
- **Why Qwen2.5-VL / open source?** Strong OCR+doc understanding at ~GPT-4o level, open-weight, cheap, hosted (no GPU). Behind an interface so swapping is trivial — I optimized for a good result *and* not being locked in.
- **Why store raw OCR text separately?** Transparency and correctability. Users trust a system that shows its work; it also makes every failure debuggable.
- **How do you handle a wine that isn't in the DB?** Fall back to label-only extraction, but *label it* `label_only` so we never imply false certainty.
- **Why trigram, not embeddings?** It's reliable in a day and robust to OCR typos on names. pgvector is the documented upgrade for paraphrase/synonyms — I scoped it as a bonus, not a core dependency.
- **What would you improve with more time?** Calibrate thresholds on a labeled photo set; capture user corrections as training data (`user_edited`); pgvector semantic matching; multi-crop for angled labels; a "confirm producer + vintage" two-tap flow; caching by image hash.
- **Biggest risk / tradeoff?** Dataset coverage — 130k wines skews to reviewed/notable wines, so obscure bottles land in `label_only`. That's the honest tradeoff, and the UX handles it instead of hiding it.

---

## 12. What only YOU need to do (not Claude Code)

1. **Accounts + keys** (do first, ~20 min):
   - **OpenRouter** account → API key (for Qwen2.5-VL). *Backup:* a **Google AI Studio (Gemini)** key.
   - **Supabase** project → URL + anon key + service-role key. Enable Storage bucket + `pg_trgm` extension.
   - **Vercel** account (log in with GitHub) for deploy.
   - **Kaggle** account → download the "Wine Reviews" dataset CSV (`winemag-data-130k-v2.csv`).
2. **Put the CSV where the seed script expects it** and run the seed (Claude Code writes the script; you run it with your keys).
3. **Photograph real bottles** — 5–6 of them, including at least one **blurry / angled / cropped** shot. Only you can produce these, and they're essential for testing *and* the screen recording. Grab a couple of well-known wines (likely in the DB) and one obscure one (to show the `label_only` path).
4. **Record the demo** (2–3 min): show one clean recognition *and* one graceful miss/confirmation. This narrative — "it's honest when unsure" — is your winning story.
5. **Read the code** enough to explain every stage. They will quiz you on tradeoffs; §11 is your script.
6. **Deploy final + paste the live link** into the README and your submission email to rev.huang@vino-intel.com.

Cost: a handful of cents on OpenRouter. Nothing else paid.
