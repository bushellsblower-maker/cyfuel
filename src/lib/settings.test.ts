import { describe, expect, it } from "vitest";
import { fetchRadiusKm, insideScope, normalizeScope } from "./settings";

describe("scope", () => {
  it("fetches a local radius, a wide country search, and nothing for the world", () => {
    expect(fetchRadiusKm("5")).toBe(5);
    expect(fetchRadiusKm("15")).toBe(15);
    expect(fetchRadiusKm("50")).toBe(50);
    expect(fetchRadiusKm("country")).toBe(80);
    expect(fetchRadiusKm("world")).toBeNull();
  });

  it("keeps pumps inside the selected kilometre radius and drops the rest", () => {
    const here = { lat: 51.5, lon: -0.1 };
    const close = { lat: 51.53, lon: -0.1 };
    const mid = { lat: 51.62, lon: -0.1 };
    expect(insideScope(here, close, "5", null)).toBe(true);
    expect(insideScope(here, mid, "5", null)).toBe(false);
    expect(insideScope(here, mid, "15", null)).toBe(true);
    expect(insideScope(here, close, "world", true)).toBe(false);
    expect(insideScope(here, close, "country", true)).toBe(true);
    expect(insideScope(here, close, "country", false)).toBe(false);
    expect(insideScope(here, close, "country", null)).toBe(true);
  });

  it("keeps an explicit scope and maps the old radius slider onto a chip", () => {
    expect(normalizeScope("world", 12)).toBe("world");
    expect(normalizeScope(undefined, 12)).toBe("15");
    expect(normalizeScope(undefined, 5)).toBe("5");
    expect(normalizeScope(undefined, 40)).toBe("50");
    expect(normalizeScope("nope", undefined)).toBe("15");
  });
});
