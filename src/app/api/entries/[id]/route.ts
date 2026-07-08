import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { updateEntrySchema } from "@/lib/schema";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const { id } = await params;
  const db = supabaseAdmin();
  const { data, error } = await db.from("entries").select("*").eq("id", id).single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }
  return NextResponse.json({ entry: data });
}

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = updateEntrySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  const db = supabaseAdmin();
  const { data, error } = await db
    .from("entries")
    .update(parsed.data)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ entry: data });
}

export async function DELETE(_req: Request, { params }: Params) {
  const { id } = await params;
  const db = supabaseAdmin();
  const { error } = await db.from("entries").delete().eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
