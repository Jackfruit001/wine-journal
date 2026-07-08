import { describe, it, expect } from "vitest";
import { reconcile } from "../src/lib/match";
import type { VlmExtraction, WineCandidate } from "../src/lib/schema";

const vlm = (overrides: Partial<VlmExtraction> = {}): VlmExtraction => ({
  readable: true,
  raw_text: "KENDALL-JACKSON\nAvant Chardonnay\n2012\nCalifornia",
  wine_name: "Avant Chardonnay",
  producer: "Kendall-Jackson",
  vintage: 2012,
  country: "US",
  region: "California",
  grape_variety: ["Chardonnay"],
  wine_type: "white",
  abv: 13.5,
  overall_confidence: 0.8,
  field_confidence: {
    wine_name: 0.9,
    producer: 0.9,
    vintage: 0.8,
    country: 0.8,
    region: 0.7,
    grape_variety: 0.8,
    wine_type: 0.7,
    abv: 0.3,
  },
  ...overrides,
});

const candidate = (score: number, id = 1): WineCandidate => ({
  id,
  title: "Kendall-Jackson 2012 Avant Chardonnay (California)",
  winery: "Kendall-Jackson",
  variety: "Chardonnay",
  country: "US",
  province: "California",
  region_1: "California",
  vintage: 2012,
  description: "Bright citrus and stone fruit.",
  score,
});

describe("reconcile — routing state machine", () => {
  it("returns unrecognized for an unreadable image", () => {
    const r = reconcile(vlm({ readable: false }), []);
    expect(r.status).toBe("unrecognized");
    expect(r.confidence).toBe(0);
    expect(r.source).toBeNull();
  });

  it("returns unrecognized when the label has neither name nor producer", () => {
    const r = reconcile(vlm({ wine_name: null, producer: null }), [candidate(0.9)]);
    expect(r.status).toBe("unrecognized");
  });

  it("recognizes from the database on a strong, unambiguous match", () => {
    const r = reconcile(vlm(), [candidate(0.7, 42), candidate(0.4, 43)]);
    expect(r.status).toBe("recognized");
    expect(r.source).toBe("database");
    expect(r.matchedWineId).toBe(42);
    expect(r.confidence).toBeGreaterThan(0.5);
    // DB-backed fields are high-confidence after a lock
    expect(r.fieldConfidence.wine_name).toBe("high");
    // abv isn't in the dataset, so it keeps the VLM's (low) confidence
    expect(r.fieldConfidence.abv).toBe("low");
  });

  it("asks for confirmation on a mid-strength match", () => {
    const r = reconcile(vlm(), [candidate(0.45, 7), candidate(0.1, 8)]);
    expect(r.status).toBe("needs_confirmation");
    expect(r.matchedWineId).toBeNull();
    expect(r.candidates.length).toBeGreaterThan(0);
  });

  it("asks for confirmation when two strong matches are too close to separate", () => {
    // Both high, but gap (0.05) < AMBIGUOUS_GAP (0.08) → don't auto-pick
    const r = reconcile(vlm(), [candidate(0.6, 1), candidate(0.55, 2)]);
    expect(r.status).toBe("needs_confirmation");
  });

  it("falls back to label-only when confident but the wine isn't in the DB", () => {
    const r = reconcile(vlm({ overall_confidence: 0.7 }), [candidate(0.2, 9)]);
    expect(r.status).toBe("recognized");
    expect(r.source).toBe("label_only");
    expect(r.matchedWineId).toBeNull();
    expect(r.confidence).toBeLessThanOrEqual(0.65);
  });

  it("returns unrecognized when nothing matches and the read is weak", () => {
    const r = reconcile(vlm({ overall_confidence: 0.3 }), []);
    expect(r.status).toBe("unrecognized");
    expect(r.confidence).toBe(0);
  });

  it("fills gaps from the DB record without overwriting what the model read", () => {
    const r = reconcile(vlm({ region: null }), [candidate(0.7, 5)]);
    // model didn't read a region; the locked DB record supplies it
    expect(r.fields.region).toBe("California");
    // model's own reading is preserved
    expect(r.fields.wine_name).toBe("Avant Chardonnay");
  });
});
