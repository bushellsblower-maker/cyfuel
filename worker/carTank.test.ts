import { afterEach, describe, expect, it, vi } from "vitest";
import { BROCHURE_NOTE } from "../shared/carTank";
import worker, { AI_TIMEOUT_MS, CAR_MODEL } from "./index";

const ctx = {
  waitUntil(promise: Promise<unknown>) {
    return promise.catch(() => undefined);
  },
  passThroughOnException() {},
  props: {},
} as unknown as ExecutionContext;

function env(response: string | Error | Array<string | Error>) {
  const replies = Array.isArray(response) ? response : [response];
  let calls = 0;
  return {
    APP_VERSION: "test",
    calls: () => calls,
    AI: {
      run: async () => {
        const next = replies[Math.min(calls, replies.length - 1)];
        calls += 1;
        if (next instanceof Error) throw next;
        return { response: next };
      },
    },
  } as unknown as Env & { calls: () => number };
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
    const logs: string[] = [];
    const spy = vi.spyOn(console, "log").mockImplementation((line?: unknown) => {
      logs.push(String(line));
    });
    const binding = env("I like cars. The tank is big.");
    const muddle = await worker.fetch(post("Zorblax"), binding, ctx);
    expect(muddle.status).toBe(502);
    const body = (await muddle.json()) as { error: string };
    expect(body.error).toMatch(/brochure/i);
    expect(binding.calls()).toBe(2);
    const bad = logs
      .map((line) => {
        try {
          return JSON.parse(line) as { event?: string; sample?: string };
        } catch {
          return null;
        }
      })
      .find((entry) => entry?.event === "car_ai_bad_json");
    expect(bad?.sample).toMatch(/I like cars/);
    spy.mockRestore();
  });

  it("retries once and keeps the stricter JSON", async () => {
    const binding = env([
      "Sure, here you go: not json",
      '{"tankLitres":47,"efficiencyLPer100km":5.4,"confidence":"high","notes":"Second try."}',
    ]);
    const response = await worker.fetch(post("Zorblax"), binding, ctx);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ tankLitres: 47, notes: "Second try." });
    expect(binding.calls()).toBe(2);
  });

  it("uses a known brochure when both replies waffle", async () => {
    const binding = env("The Ford Focus has a decent tank, about fifty litres.");
    const response = await worker.fetch(post("Ford Focus"), binding, ctx);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      tankLitres: 52,
      confidence: "medium",
      notes: BROCHURE_NOTE,
    });
    expect(binding.calls()).toBe(2);
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
