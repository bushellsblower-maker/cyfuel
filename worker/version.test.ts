import { describe, expect, it, vi } from "vitest";
import { APP_VERSION, CYBUSH_BUILT } from "../shared/version";
import worker from "./index";

const ctx = {
  waitUntil(promise: Promise<unknown>) {
    return promise.catch(() => undefined);
  },
  passThroughOnException() {},
  props: {},
} as unknown as ExecutionContext;

describe("version stamp", () => {
  it("keeps /api/health and stamps the injected sha", async () => {
    const response = await worker.fetch(new Request("https://cyfuel.cybush.uk/api/health"), {} as Env, ctx);
    expect(response.status).toBe(200);
    expect(response.headers.get("X-Cybush-Version")).toBe(APP_VERSION);
    await expect(response.json()).resolves.toEqual({ ok: true, version: APP_VERSION });
  });

  it("answers GET /__version before assets", async () => {
    const fetchAsset = vi.fn(async () => new Response("spa"));
    const response = await worker.fetch(
      new Request("https://cyfuel.cybush.uk/__version"),
      { ASSETS: { fetch: fetchAsset }, CF_VERSION: { id: "version-123" } } as unknown as Env,
      ctx,
    );
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("X-Cybush-Version")).toBe(APP_VERSION);
    await expect(response.json()).resolves.toEqual({
      app: "cyfuel",
      sha: APP_VERSION,
      built: CYBUSH_BUILT,
      cf_version_id: "version-123",
    });
    expect(fetchAsset).not.toHaveBeenCalled();
  });

  it("returns a null cf version id when the binding is absent", async () => {
    const response = await worker.fetch(new Request("https://cyfuel.cybush.uk/__version"), {} as Env, ctx);
    const body = (await response.json()) as { cf_version_id: string | null };
    expect(body.cf_version_id).toBeNull();
  });

  it("clones asset headers and adds the version", async () => {
    const response = await worker.fetch(
      new Request("https://cyfuel.cybush.uk/", { method: "HEAD" }),
      {
        ASSETS: {
          fetch: async () =>
            new Response(null, {
              status: 200,
              headers: { "content-type": "text/html; charset=utf-8", "x-from-asset": "yes" },
            }),
        },
      } as unknown as Env,
      ctx,
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("x-from-asset")).toBe("yes");
    expect(response.headers.get("content-type")).toBe("text/html; charset=utf-8");
    expect(response.headers.get("X-Cybush-Version")).toBe(APP_VERSION);
  });

  it("records a document hit on waitUntil and skips /api/health", async () => {
    const writeDataPoint = vi.fn();
    let waited: Promise<unknown> = Promise.resolve();
    const auditCtx = {
      waitUntil(promise: Promise<unknown>) {
        waited = promise;
      },
      passThroughOnException() {},
      props: {},
    } as unknown as ExecutionContext;
    const env = {
      AUDIT_HITS: { writeDataPoint },
      ASSETS: { fetch: async () => new Response("page", { headers: { "content-type": "text/html" } }) },
    } as unknown as Env;

    const page = await worker.fetch(
      new Request("https://cyfuel.cybush.uk/", { headers: { accept: "text/html" } }),
      env,
      auditCtx,
    );
    expect(page.status).toBe(200);
    expect(page.headers.get("X-Cybush-Version")).toBe(APP_VERSION);
    await waited;
    expect(writeDataPoint).toHaveBeenCalledOnce();

    writeDataPoint.mockClear();
    const health = await worker.fetch(new Request("https://cyfuel.cybush.uk/api/health"), env, auditCtx);
    expect(health.status).toBe(200);
    await waited;
    expect(writeDataPoint).not.toHaveBeenCalled();
  });
});
