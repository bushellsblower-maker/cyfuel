import { describe, expect, it } from "vitest";
import { countryAt, countryShapes } from "./country";

describe("country shapes", () => {
  const shapes = countryShapes();

  it("knows which country a pin is standing in", () => {
    expect(countryAt(51.5074, -0.1278, shapes)?.code).toBe("GB");
    expect(countryAt(48.8566, 2.3522, shapes)?.code).toBe("FR");
    expect(countryAt(40.4168, -3.7038, shapes)?.code).toBe("ES");
    expect(countryAt(41.9028, 12.4964, shapes)?.code).toBe("IT");
    expect(countryAt(-31.9523, 115.8613, shapes)?.code).toBe("AU");
    expect(countryAt(0, 0, shapes)).toBeNull();
  });

  it("pins the UK on London, not the middle of a field", () => {
    const uk = shapes.find((shape) => shape.code === "GB");
    expect(uk?.pin.place).toBe("London");
    expect(uk?.pin.lat).toBeGreaterThan(51);
    expect(uk?.pin.lat).toBeLessThan(52);
  });
});
