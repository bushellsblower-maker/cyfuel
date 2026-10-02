import { afterEach, describe, expect, it, vi } from "vitest";
import worker, { AI_TIMEOUT_MS, CAR_MODEL } from "./index";

const ctx = {
  waitUntil(promise: Promise<unknown>) {
    return promise.catch(() => undefined);
  },
  passThroughOnException() {},
  props: {},
} as unknown as ExecutionContext;

function env(response: string | Error) {
  return {
    APP_VERSION: "test",
    AI: {
      run: async () => {
        if (response instanceof Error) throw response;
        return { response };
      },
    },
  } as unknown as Env;
}

function post(car: string) {
  return new Request("https://cyfuel.cybush.uk/api/car-tank", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ car }),
  });
}

describe("POST /api/car-tank", () => {
  it("applies a checked tank and efficiency from the model", async () => {
    const response = await worker.fetch(
      post("2019 Golf 1.5 TSI"),
      env('{"tankLitres":50,"efficiencyLPer100km":5.4,"confidence":"high","notes":"A Golf-sized sipper."}'),
      ctx,
    );
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      tankLitres: 50,
      efficiencyLPer100km: 5.4,
      confidence: "high",
      notes: "A Golf-sized sipper.",
    });
  });

  it("refuses a blank car and a model that will not speak JSON", async () => {
    const blank = await worker.fetch(post("  "), env("{}"), ctx);
    expect(blank.status).toBe(400);
    const muddle = await worker.fetch(post("Golf"), env("I like cars."), ctx);
    expect(muddle.status).toBe(502);
    const body = (await muddle.json()) as { error: string };
    expect(body.error).toMatch(/brochure/i);
  });

  it("keeps the slider path when Workers AI throws", async () => {
    const response = await worker.fetch(post("Golf"), env(new Error("binding down")), ctx);
    expect(response.status).toBe(502);
    const body = (await response.json()) as { error: string };
    expect(body.error).toMatch(/slider/i);
  });

  it("stops waiting when Workers AI never answers", async () => {
    vi.useFakeTimers();
    const logs: string[] = [];
    const spy = vi.spyOn(console, "log").mockImplementation((line?: unknown) => {
      logs.push(String(line));
    });
    const pending = worker.fetch(
      post("Golf"),
      {
        APP_VERSION: "test",
        AI: { run: () => new Promise(() => undefined) },
      } as unknown as Env,
      ctx,
    );
    await vi.advanceTimersByTimeAsync(AI_TIMEOUT_MS);
    const response = await pending;
    expect(response.status).toBe(504);
    const body = (await response.json()) as { error: string };
    expect(body.error).toMatch(/brochure/i);
    const event = logs
      .map((line) => {
        try {
          return JSON.parse(line) as { event?: string; model?: string; durationMs?: number };
        } catch {
          return null;
        }
      })
      .find((entry) => entry?.event === "car_ai_timeout");
    expect(event?.model).toBe(CAR_MODEL);
    expect(event?.durationMs).toBeGreaterThanOrEqual(AI_TIMEOUT_MS);
    spy.mockRestore();
  });
});

afterEach(() => {
  vi.useRealTimers();
});
