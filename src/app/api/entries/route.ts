import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { createEntrySchema } from "@/lib/schema";

export async function GET() {
  const db = supabaseAdmin();
  const { data, error } = await db
    .from("entries")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ entries: data });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = createEntrySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  const db = supabaseAdmin();
  const { data, error } = await db
    .from("entries")
    .insert(parsed.data)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ entry: data }, { status: 201 });
}
