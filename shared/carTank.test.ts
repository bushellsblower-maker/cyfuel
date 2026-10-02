import { describe, expect, it } from "vitest";
import { BROCHURE_NOTE, cleanCarQuery, knownCarTank, parseCarTank } from "./carTank";

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

  it("reads fenced JSON, string numbers, and ignores a later brace", () => {
    const estimate = parseCarTank(
      '```json\n{"tankLitres":"50","efficiencyLPer100km":"6.2","confidence":"high","notes":"Golf."}\n```\nThanks {friend}',
    );
    expect(estimate).toMatchObject({ tankLitres: 50, efficiencyLPer100km: 6.2, confidence: "high", notes: "Golf." });
  });

  it("guesses a known name when the model will not", () => {
    expect(knownCarTank("VW Golf")).toMatchObject({ tankLitres: 50, confidence: "medium", notes: BROCHURE_NOTE });
    expect(knownCarTank("Ford Focus estate")).toMatchObject({ tankLitres: 52 });
    expect(knownCarTank("Honda Civic")).toMatchObject({ tankLitres: 46 });
    expect(knownCarTank("a minivan")).toBeNull();
    expect(knownCarTank("Zorblax")).toBeNull();
  });

  it("keeps a short car name and drops the rest", () => {
    expect(cleanCarQuery("  2019 Golf 1.5 TSI!!!  ")).toBe("2019 Golf 1.5 TSI");
  });
});
