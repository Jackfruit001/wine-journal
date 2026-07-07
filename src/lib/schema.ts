import { z } from "zod";

/**
 * The strict JSON contract every VLM provider must return. `null` is a first-class
 * value here — the model is instructed to admit it can't read a field rather than
 * invent one, and confidence 0 must accompany every null.
 */
export const vlmFieldConfidenceSchema = z.object({
  wine_name: z.number().min(0).max(1),
  producer: z.number().min(0).max(1),
  vintage: z.number().min(0).max(1),
  country: z.number().min(0).max(1),
  region: z.number().min(0).max(1),
  grape_variety: z.number().min(0).max(1),
  wine_type: z.number().min(0).max(1),
  abv: z.number().min(0).max(1),
});
export type VlmFieldConfidence = z.infer<typeof vlmFieldConfidenceSchema>;

export const vlmExtractionSchema = z.object({
  readable: z.boolean(),
  raw_text: z.string(),
  wine_name: z.string().nullable(),
  producer: z.string().nullable(),
  vintage: z.number().int().nullable(),
  country: z.string().nullable(),
  region: z.string().nullable(),
  grape_variety: z.array(z.string()).nullable(),
  wine_type: z.enum(["red", "white", "rose", "sparkling", "dessert", "fortified", "other"]).nullable(),
  abv: z.number().nullable(),
  overall_confidence: z.number().min(0).max(1),
  field_confidence: vlmFieldConfidenceSchema,
});

export type VlmExtraction = z.infer<typeof vlmExtractionSchema>;

export const recognitionStatusSchema = z.enum([
  "recognized",
  "needs_confirmation",
  "unrecognized",
]);
export type RecognitionStatus = z.infer<typeof recognitionStatusSchema>;

export const wineCandidateSchema = z.object({
  id: z.number(),
  title: z.string(),
  winery: z.string().nullable(),
  variety: z.string().nullable(),
  country: z.string().nullable(),
  province: z.string().nullable(),
  region_1: z.string().nullable(),
  vintage: z.number().nullable(),
  description: z.string().nullable(),
  score: z.number(),
});
export type WineCandidate = z.infer<typeof wineCandidateSchema>;

/** The fields a journal entry auto-fills and the user can edit. */
export const entryFieldsSchema = z.object({
  wine_name: z.string().nullable(),
  producer: z.string().nullable(),
  vintage: z.number().int().nullable(),
  country: z.string().nullable(),
  region: z.string().nullable(),
  grape_variety: z.array(z.string()),
  wine_type: z.string().nullable(),
  abv: z.number().nullable(),
});
export type EntryFields = z.infer<typeof entryFieldsSchema>;

/** Response shape returned by POST /api/recognize */
export const recognizeResponseSchema = z.object({
  status: recognitionStatusSchema,
  confidence: z.number().min(0).max(1),
  fields: entryFieldsSchema,
  confidence_fields: vlmFieldConfidenceSchema.nullable(),
  raw_ocr_text: z.string(),
  candidates: z.array(wineCandidateSchema),
  matched_wine_id: z.number().nullable(),
  source: z.enum(["database", "label_only"]).nullable(),
  image_url: z.string().nullable(),
});
export type RecognizeResponse = z.infer<typeof recognizeResponseSchema>;

export const createEntrySchema = z.object({
  image_url: z.string().nullable(),
  wine_name: z.string().nullable(),
  producer: z.string().nullable(),
  vintage: z.number().int().nullable(),
  country: z.string().nullable(),
  region: z.string().nullable(),
  grape_variety: z.array(z.string()),
  wine_type: z.string().nullable(),
  abv: z.number().nullable(),
  raw_ocr_text: z.string().nullable(),
  recognition_status: recognitionStatusSchema,
  confidence: z.number().nullable(),
  confidence_fields: vlmFieldConfidenceSchema.nullable(),
  candidate_matches: z.array(wineCandidateSchema).nullable(),
  matched_wine_id: z.number().nullable(),
  source: z.enum(["database", "label_only"]).nullable(),
  user_edited: z.boolean().default(false),
  tasting_note: z.string().nullable(),
  user_rating: z.number().int().min(1).max(5).nullable(),
  user_notes: z.string().nullable(),
});
export type CreateEntryInput = z.infer<typeof createEntrySchema>;
