import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/** Browser/client-safe. Respects RLS. */
export const supabase: SupabaseClient = createClient(url, anonKey);

let adminClient: SupabaseClient | null = null;

/** Server-only. Bypasses RLS with the service role key — never import from client components. */
export function supabaseAdmin(): SupabaseClient {
  if (adminClient) return adminClient;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  }
  adminClient = createClient(url, serviceKey, {
    auth: { persistSession: false },
  });
  return adminClient;
}

export const LABEL_IMAGES_BUCKET = "label-images";
