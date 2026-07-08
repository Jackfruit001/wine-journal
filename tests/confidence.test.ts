import { describe, it, expect } from "vitest";
import {
  overallConfidence,
  labelOnlyConfidence,
  userConfirmedConfidence,
  describeConfidence,
  computeFieldConfidence,
  DB_BACKED_FIELDS,
  USER_CONFIRMED_FLOOR,
  LABEL_ONLY_CAP,
} from "../src/lib/confidence";
import type { EntryFields, VlmFieldConfidence } from "../src/lib/schema";

const vlmFieldConf = (overrides: Partial<VlmFieldConfidence> = {}): VlmFieldConfidence => ({
  wine_name: 0.9,
  producer: 0.9,
  vintage: 0.9,
  country: 0.9,
  region: 0.9,
  grape_variety: 0.9,
  wine_type: 0.9,
  abv: 0.9,
  ...overrides,
});

const fields = (overrides: Partial<EntryFields> = {}): EntryFields => ({
  wine_name: "Avant Chardonnay",
  producer: "Kendall-Jackson",
  vintage: 2012,
  country: "US",
  region: "California",
  grape_variety: ["Chardonnay"],
  wine_type: "white",
  abv: 13.5,
  ...overrides,
});

describe("overallConfidence", () => {
  it("is dominated by the database score (weight 0.6)", () => {
    // 0.6*0.56 + 0.25*0.8 + 0.15*(0.1/0.2) = 0.336 + 0.2 + 0.075
    expect(overallConfidence({ dbScore: 0.56, vlmConfidence: 0.8, margin: 0.1 })).toBeCloseTo(0.611, 3);
  });

  it("reaches 1 only when every signal is maxed", () => {
    expect(overallConfidence({ dbScore: 1, vlmConfidence: 1, margin: 0.2 })).toBeCloseTo(1, 5);
  });

  it("floors at 0 with no signal", () => {
    expect(overallConfidence({ dbScore: 0, vlmConfidence: 0, margin: 0 })).toBe(0);
  });

  it("clamps the margin term so a huge gap can't over-count", () => {
    const big = overallConfidence({ dbScore: 0.5, vlmConfidence: 0.5, margin: 5 });
    const atNorm = overallConfidence({ dbScore: 0.5, vlmConfidence: 0.5, margin: 0.2 });
    expect(big).toBeCloseTo(atNorm, 5);
  });
});

describe("labelOnlyConfidence", () => {
  it("is capped even for a maximally confident read", () => {
    expect(labelOnlyConfidence(1)).toBeCloseTo(LABEL_ONLY_CAP, 5);
    expect(labelOnlyConfidence(1)).toBeLessThanOrEqual(LABEL_ONLY_CAP);
  });

  it("scales with the model's self-confidence below the cap", () => {
    // 0.35 + 0.3*0.5 = 0.5
    expect(labelOnlyConfidence(0.5)).toBeCloseTo(0.5, 5);
  });
});

describe("userConfirmedConfidence", () => {
  it("floors high when the DB score alone was weak (a human confirmed it)", () => {
    expect(userConfirmedConfidence(0.1, 0.1)).toBe(USER_CONFIRMED_FLOOR);
  });

  it("can exceed the floor when signals are strong", () => {
    expect(userConfirmedConfidence(1, 1)).toBeGreaterThan(USER_CONFIRMED_FLOOR);
  });
});

describe("describeConfidence", () => {
  it("maps scores to tiers and phrases", () => {
    expect(describeConfidence(0.85)).toMatchObject({ tier: "high", label: "Very confident", pct: 85 });
    expect(describeConfidence(0.65)).toMatchObject({ tier: "high", label: "Confident" });
    expect(describeConfidence(0.5)).toMatchObject({ tier: "moderate", label: "Fairly confident" });
    expect(describeConfidence(0.1)).toMatchObject({ tier: "low" });
    expect(describeConfidence(0)).toMatchObject({ tier: "low", label: "Couldn't identify", pct: 0 });
  });
});

describe("computeFieldConfidence", () => {
  it("marks empty fields missing regardless of source", () => {
    const map = computeFieldConfidence(
      fields({ region: null, grape_variety: [] }),
      vlmFieldConf(),
      DB_BACKED_FIELDS
    );
    expect(map.region).toBe("missing");
    expect(map.grape_variety).toBe("missing");
  });

  it("marks DB-backed fields high when a match is locked", () => {
    const map = computeFieldConfidence(fields(), vlmFieldConf({ wine_name: 0.1 }), DB_BACKED_FIELDS);
    // wine_name is DB-backed, so it's high even though the VLM was unsure of it
    expect(map.wine_name).toBe("high");
    expect(map.producer).toBe("high");
  });

  it("falls back to VLM per-field confidence for non-DB fields (abv, wine_type)", () => {
    const map = computeFieldConfidence(
      fields(),
      vlmFieldConf({ abv: 0.3, wine_type: 0.6 }),
      DB_BACKED_FIELDS
    );
    expect(map.abv).toBe("low"); // 0.3 < 0.45
    expect(map.wine_type).toBe("moderate"); // 0.45 <= 0.6 < 0.7
  });

  it("uses VLM confidence for every field when there is no DB match", () => {
    const map = computeFieldConfidence(
      fields(),
      vlmFieldConf({ wine_name: 0.95, producer: 0.5, vintage: 0.2 }),
      new Set()
    );
    expect(map.wine_name).toBe("high");
    expect(map.producer).toBe("moderate");
    expect(map.vintage).toBe("low");
  });
});
