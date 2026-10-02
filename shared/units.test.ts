import { describe, expect, it } from "vitest";
import {
  clampThirstDraft,
  formatTank,
  formatThirst,
  lPer100kmToUkMpg,
  litresFromThirstDraft,
  litresToUkGallons,
  thirstFieldText,
  ukGallonsToLitres,
  ukMpgToLPer100km,
} from "./units";

describe("UK imperial units", () => {
  it("turns 50 L into about 11 imperial gallons and back", () => {
    expect(litresToUkGallons(50)).toBeCloseTo(11.0, 1);
    expect(ukGallonsToLitres(litresToUkGallons(50))).toBeCloseTo(50, 5);
  });

  it("turns 7 L/100km into about 40 UK mpg and back", () => {
    expect(lPer100kmToUkMpg(7)).toBeCloseTo(40.35, 1);
    expect(ukMpgToLPer100km(lPer100kmToUkMpg(7))).toBeCloseTo(7, 5);
  });

  it("accepts a typed UK mpg or L/100km and clamps the wild ones", () => {
    expect(litresFromThirstDraft("40", "imperial")).toBeCloseTo(ukMpgToLPer100km(40), 5);
    expect(litresFromThirstDraft("4", "imperial")).toBeNull();
    expect(clampThirstDraft("4", "imperial")).toBe(25);
    expect(litresFromThirstDraft("7.5", "metric")).toBe(7.5);
    expect(litresFromThirstDraft("30", "metric")).toBeNull();
    expect(clampThirstDraft("30", "metric")).toBe(25);
    expect(thirstFieldText(7, "imperial")).toBe("40");
    expect(thirstFieldText(7, "metric")).toBe("7.0");
  });

  it("labels the same car in both systems", () => {
    expect(formatTank(50, "metric")).toBe("50 L");
    expect(formatTank(50, "imperial")).toBe("11.0 gal");
    expect(formatThirst(7, "metric")).toBe("7.0 L/100km");
    expect(formatThirst(7, "imperial")).toBe("40 mpg");
  });
});
