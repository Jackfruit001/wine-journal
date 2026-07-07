/**
 * Loads the Kaggle "Wine Reviews" CSV (winemag-data-130k-v2.csv) into the
 * Supabase `wines` table in batches, via the service-role key.
 *
 * Usage: place the CSV at /data/winemag-data-130k-v2.csv, then `npm run seed`.
 */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { parse } from "csv-parse";
import { createReadStream, existsSync } from "node:fs";
import path from "node:path";

const CSV_PATH = path.join(process.cwd(), "data", "winemag-data-130k-v2.csv");
const BATCH_SIZE = 500;

interface WineRow {
  id: number;
  title: string;
  winery: string | null;
  variety: string | null;
  country: string | null;
  province: string | null;
  region_1: string | null;
  vintage: number | null;
  description: string | null;
  points: number | null;
  price: number | null;
}

function extractVintage(title: string): number | null {
  const match = title.match(/\b(19|20)\d{2}\b/);
  return match ? parseInt(match[0], 10) : null;
}

function toNullableString(value: string | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

async function main() {
  if (!existsSync(CSV_PATH)) {
    console.error(`CSV not found at ${CSV_PATH}`);
    console.error(
      'Download the Kaggle "Wine Reviews" dataset and place winemag-data-130k-v2.csv in /data.'
    );
    process.exit(1);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    console.error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local");
    process.exit(1);
  }
  const db = createClient(url, serviceKey, { auth: { persistSession: false } });

  const parser = createReadStream(CSV_PATH).pipe(
    parse({ columns: true, skip_empty_lines: true })
  );

  let batch: WineRow[] = [];
  let total = 0;
  let rowId = 0;

  const flush = async () => {
    if (!batch.length) return;
    const { error } = await db.from("wines").upsert(batch, { onConflict: "id" });
    if (error) throw new Error(`Insert failed at row ${total}: ${error.message}`);
    total += batch.length;
    process.stdout.write(`\rSeeded ${total} wines...`);
    batch = [];
  };

  for await (const record of parser) {
    const title: string | undefined = record.title;
    if (!title) continue;

    rowId += 1;
    const row: WineRow = {
      id: rowId,
      title,
      winery: toNullableString(record.winery),
      variety: toNullableString(record.variety),
      country: toNullableString(record.country),
      province: toNullableString(record.province),
      region_1: toNullableString(record.region_1),
      vintage: extractVintage(title),
      description: toNullableString(record.description),
      points: record.points ? parseInt(record.points, 10) : null,
      price: record.price ? parseFloat(record.price) : null,
    };
    batch.push(row);

    if (batch.length >= BATCH_SIZE) await flush();
  }
  await flush();

  console.log(`\nDone. Seeded ${total} wines into Supabase.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
