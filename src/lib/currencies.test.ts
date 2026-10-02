import { describe, expect, it } from "vitest";
import { displayCurrency } from "./currencies";

describe("display currency", () => {
  it("follows the country under the pin until the user picks one", () => {
    expect(displayCurrency("standing", "GBP")).toBe("GBP");
    expect(displayCurrency("standing", null)).toBe("EUR");
    expect(displayCurrency("USD", "GBP")).toBe("USD");
    expect(displayCurrency("nope", "AUD")).toBe("AUD");
  });
});
