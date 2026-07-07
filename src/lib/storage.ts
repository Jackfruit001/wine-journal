import { randomUUID } from "node:crypto";
import { LABEL_IMAGES_BUCKET, supabaseAdmin } from "./supabase";

/** Uploads a `data:image/...;base64,...` URL to Supabase Storage and returns its public URL. */
export async function uploadLabelImage(imageDataUrl: string): Promise<string> {
  const match = imageDataUrl.match(/^data:(image\/\w+);base64,(.+)$/);
  if (!match) throw new Error("Expected a base64 image data URL");
  const [, mimeType, base64] = match;
  const ext = mimeType.split("/")[1] || "jpg";
  const buffer = Buffer.from(base64, "base64");

  const db = supabaseAdmin();
  const path = `${randomUUID()}.${ext}`;
  const { error } = await db.storage
    .from(LABEL_IMAGES_BUCKET)
    .upload(path, buffer, { contentType: mimeType });
  if (error) throw new Error(`Image upload failed: ${error.message}`);

  const { data } = db.storage.from(LABEL_IMAGES_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
