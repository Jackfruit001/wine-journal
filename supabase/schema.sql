-- VinoBuzz Wine Journal — schema
-- Run this once against your Supabase project (SQL Editor, or `supabase db push`).

create extension if not exists pg_trgm;

-- Reference database of real wines, loaded from the Kaggle "Wine Reviews" dataset
-- by scripts/seed_wines.ts. Used as an independent verifier of VLM extractions.
create table if not exists wines (
  id            bigint primary key,
  title         text not null,
  winery        text,
  variety       text,
  country       text,
  province      text,
  region_1      text,
  vintage       int,
  description   text,
  points        int,
  price         numeric
);

-- trigram index on "winery + title" — this is the string we fuzzy-match against
create index if not exists wines_winery_title_trgm_idx
  on wines using gin ((coalesce(winery, '') || ' ' || coalesce(title, '')) gin_trgm_ops);

-- Journal entries created from a recognized (or manually entered) label.
create table if not exists entries (
  id                  uuid primary key default gen_random_uuid(),
  created_at          timestamptz not null default now(),
  image_url           text,

  -- recognized / user-editable fields
  wine_name           text,
  producer            text,
  vintage             int,
  country             text,
  region              text,
  grape_variety       text[] default '{}',
  wine_type           text,
  abv                 numeric,

  -- AI transparency
  raw_ocr_text        text,
  recognition_status  text not null default 'unrecognized'
                        check (recognition_status in ('recognized', 'needs_confirmation', 'unrecognized')),
  confidence          numeric,
  confidence_fields   jsonb,
  candidate_matches   jsonb,
  matched_wine_id     bigint references wines(id),
  source              text check (source in ('database', 'label_only')),

  -- user layer
  user_edited         boolean not null default false,
  tasting_note         text,
  user_rating         int check (user_rating between 1 and 5),
  user_notes          text
);

create index if not exists entries_created_at_idx on entries (created_at desc);

-- Public read/write for demo purposes (no auth in this prototype).
alter table entries enable row level security;
create policy "public read entries" on entries for select using (true);
create policy "public insert entries" on entries for insert with check (true);
create policy "public update entries" on entries for update using (true);

alter table wines enable row level security;
create policy "public read wines" on wines for select using (true);

-- Independent verifier: fuzzy-match "producer + name" against the reference database.
-- Called via supabase.rpc('match_wines', { query, match_count }) from lib/match.ts.
create or replace function match_wines(query text, match_count int default 5)
returns table (
  id bigint,
  title text,
  winery text,
  variety text,
  country text,
  province text,
  region_1 text,
  vintage int,
  description text,
  score real
)
language sql stable
as $$
  select
    id, title, winery, variety, country, province, region_1, vintage, description,
    similarity(lower(coalesce(winery, '') || ' ' || coalesce(title, '')), lower(query)) as score
  from wines
  order by score desc
  limit match_count;
$$;
