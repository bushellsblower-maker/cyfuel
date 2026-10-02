import { describe, expect, it } from "vitest";
import { fetchRadiusKm, normalizeScope } from "./settings";

describe("scope", () => {
  it("fetches a local radius, a wide country search, and nothing for the world", () => {
    expect(fetchRadiusKm("5")).toBe(5);
    expect(fetchRadiusKm("15")).toBe(15);
    expect(fetchRadiusKm("50")).toBe(50);
    expect(fetchRadiusKm("country")).toBe(80);
    expect(fetchRadiusKm("world")).toBeNull();
  });

  it("keeps an explicit scope and maps the old radius slider onto a chip", () => {
    expect(normalizeScope("world", 12)).toBe("world");
    expect(normalizeScope(undefined, 12)).toBe("15");
    expect(normalizeScope(undefined, 5)).toBe("5");
    expect(normalizeScope(undefined, 40)).toBe("50");
    expect(normalizeScope("nope", undefined)).toBe("15");
  });
});
