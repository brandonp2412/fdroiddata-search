import { afterEach, describe, expect, test } from "bun:test";
import { fetchExists, fetchJson } from "./http";

const realFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = realFetch;
});

describe("fetchJson", () => {
  test("returns parsed JSON for a successful response", async () => {
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ ok: true }), { status: 200 })) as typeof fetch;

    await expect(fetchJson<{ ok: boolean }>("https://example.test")).resolves.toEqual({
      ok: true,
    });
  });

  test("surfaces HTTP failures with a short response detail", async () => {
    globalThis.fetch = (async () =>
      new Response("  rate   limit exceeded  ", { status: 429 })) as typeof fetch;

    await expect(fetchJson("https://example.test", undefined, 100, 1)).rejects.toThrow(
      "GitLab request failed with HTTP 429: rate limit exceeded",
    );
  });

  test("reports invalid JSON instead of leaking a parser stack trace", async () => {
    globalThis.fetch = (async () =>
      new Response("not-json", { status: 200 })) as typeof fetch;

    await expect(fetchJson("https://example.test")).rejects.toThrow(
      "GitLab returned invalid JSON (HTTP 200).",
    );
  });

  test("wraps transport failures with GitLab context", async () => {
    globalThis.fetch = (async () => {
      throw new Error("connection reset");
    }) as typeof fetch;

    await expect(fetchJson("https://example.test", undefined, 100, 1)).rejects.toThrow(
      "GitLab request failed: connection reset",
    );
  });

  test("times out stalled requests", async () => {
    globalThis.fetch = ((_input, init) =>
      new Promise<Response>((_resolve, reject) => {
        const signal = init?.signal;
        if (!signal) {
          reject(new Error("missing abort signal"));
          return;
        }
        signal.addEventListener("abort", () => reject(signal.reason), { once: true });
      })) as typeof fetch;

    await expect(fetchJson("https://example.test", undefined, 5, 1)).rejects.toThrow(
      "GitLab request timed out after 5ms.",
    );
  });

  test("retries transient GET failures", async () => {
    let attempts = 0;
    globalThis.fetch = (async () => {
      attempts++;
      if (attempts === 1) {
        return new Response("temporary upstream failure", { status: 500 });
      }
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    }) as typeof fetch;

    await expect(fetchJson<{ ok: boolean }>("https://example.test", undefined, 100, 2))
      .resolves.toEqual({ ok: true });
    expect(attempts).toBe(2);
  });

  test("does not retry non-idempotent requests", async () => {
    let attempts = 0;
    globalThis.fetch = (async () => {
      attempts++;
      return new Response("temporary upstream failure", { status: 500 });
    }) as typeof fetch;

    await expect(
      fetchJson("https://example.test", { method: "POST" }, 100, 3),
    ).rejects.toThrow("GitLab request failed with HTTP 500");
    expect(attempts).toBe(1);
  });
});

describe("fetchExists", () => {
  test("uses HEAD and returns true for an existing resource", async () => {
    let method: string | undefined;
    globalThis.fetch = (async (_input, init) => {
      method = init?.method;
      return new Response(null, { status: 200 });
    }) as typeof fetch;

    await expect(fetchExists("https://example.test")).resolves.toBe(true);
    expect(method).toBe("HEAD");
  });

  test("returns false for a missing resource", async () => {
    globalThis.fetch = (async () =>
      new Response(null, { status: 404 })) as typeof fetch;

    await expect(fetchExists("https://example.test")).resolves.toBe(false);
  });
});
