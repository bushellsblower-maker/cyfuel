import { describe, expect, it } from "vitest";
import { cleanCarQuery, parseCarTank } from "./carTank";

describe("parseCarTank", () => {
  it("reads a JSON object and clamps a boastful tank", () => {
    const estimate = parseCarTank(
      'Sure.\n{"tankLitres": 180, "efficiencyLPer100km": 5.5, "confidence": "high", "notes": "Golf-sized."}',
    );
    expect(estimate).toEqual({
      tankLitres: 150,
      efficiencyLPer100km: 5.5,
      confidence: "high",
      notes: "Golf-sized.",
    });
  });

  it("refuses a tank that is not a car", () => {
    expect(parseCarTank('{"tankLitres": 4000, "efficiencyLPer100km": 7, "confidence": "low", "notes": ""}')).toBeNull();
  });

  it("drops an efficiency that is not a real car", () => {
    const estimate = parseCarTank('{"tankLitres": 55, "efficiencyLPer100km": 0.2, "confidence": "nope", "notes": ""}');
    expect(estimate?.tankLitres).toBe(55);
    expect(estimate?.efficiencyLPer100km).toBeNull();
    expect(estimate?.confidence).toBe("medium");
  });

  it("rejects prose with no object", () => {
    expect(parseCarTank("I like cars.")).toBeNull();
  });

  it("keeps a short car name and drops the rest", () => {
    expect(cleanCarQuery("  2019 Golf 1.5 TSI!!!  ")).toBe("2019 Golf 1.5 TSI");
  });
});
