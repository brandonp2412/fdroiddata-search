import { afterEach, describe, expect, test } from "bun:test";
import { fetchJson } from "./http";

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

    await expect(fetchJson("https://example.test")).rejects.toThrow(
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

    await expect(fetchJson("https://example.test")).rejects.toThrow(
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

    await expect(fetchJson("https://example.test", undefined, 5)).rejects.toThrow(
      "GitLab request timed out after 5ms.",
    );
  });
});
