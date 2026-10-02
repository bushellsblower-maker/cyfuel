import { afterEach, describe, expect, it, vi } from "vitest";
import { LOOKUP_TIMEOUT_MS, LOOKUP_TOO_SLOW, LookupFailed, lookupCar, lookupFailureCode } from "./api";

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

  it("labels a bad reply, a slow reply, and a missing AbortSignal.any", async () => {
    expect(lookupFailureCode(502, false)).toBe("bad reply");
    expect(lookupFailureCode(504, false)).toBe("too slow");
    expect(lookupFailureCode(429, false)).toBe("rate limited");
    expect(lookupFailureCode(null, false)).toBe("network");

    vi.stubGlobal(
      "fetch",
      async () =>
        new Response(JSON.stringify({ error: "Pip stared at the brochure and learned nothing." }), {
          status: 502,
          headers: { "content-type": "application/json" },
        }),
    );
    await expect(lookupCar("Zorblax")).rejects.toMatchObject({
      message: "Pip stared at the brochure and learned nothing.",
      code: "bad reply",
    } satisfies Partial<LookupFailed>);

    const descriptor = Object.getOwnPropertyDescriptor(AbortSignal, "any");
    Object.defineProperty(AbortSignal, "any", { value: undefined, configurable: true });
    vi.stubGlobal(
      "fetch",
      async () =>
        new Response(JSON.stringify({ tankLitres: 40, efficiencyLPer100km: 5, confidence: "medium", notes: "ok" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    );
    try {
      await expect(lookupCar("Polo")).resolves.toMatchObject({ tankLitres: 40 });
    } finally {
      if (descriptor) Object.defineProperty(AbortSignal, "any", descriptor);
    }
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
