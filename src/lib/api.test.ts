import { afterEach, describe, expect, it, vi } from "vitest";
import { LOOKUP_TIMEOUT_MS, LOOKUP_TOO_SLOW, lookupCar } from "./api";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("lookupCar", () => {
  it("gives up when the request never finishes", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      () => new Promise(() => undefined),
    );
    const pending = lookupCar("2019 Golf 1.5 TSI");
    const assertion = expect(pending).rejects.toThrow(LOOKUP_TOO_SLOW);
    await vi.advanceTimersByTimeAsync(LOOKUP_TIMEOUT_MS);
    await assertion;
  });

  it("returns the tank when the worker answers in time", async () => {
    vi.stubGlobal(
      "fetch",
      async () =>
        new Response(
          JSON.stringify({
            tankLitres: 45,
            efficiencyLPer100km: 6,
            confidence: "high",
            notes: "A Golf-sized sipper.",
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
    );
    await expect(lookupCar("Golf")).resolves.toMatchObject({ tankLitres: 45, efficiencyLPer100km: 6 });
  });

  it("passes a worker timeout message through", async () => {
    vi.stubGlobal(
      "fetch",
      async () =>
        new Response(JSON.stringify({ error: "Pip wandered off with the brochure. Try again, or set the tank yourself." }), {
          status: 504,
          headers: { "content-type": "application/json" },
        }),
    );
    await expect(lookupCar("Golf")).rejects.toThrow(/wandered off/);
  });
});
