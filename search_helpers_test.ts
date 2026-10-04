import { describe, expect, test } from "bun:test";
import { metadataPathForPackageId, nextCommitUntil, nextPipelineCursor } from "./search_helpers";

describe("metadataPathForPackageId", () => {
  test("preserves mixed-case application IDs", () => {
    expect(metadataPathForPackageId("app.hkTransport")).toBe(
      "metadata/app.hkTransport.yml",
    );
  });
});

describe("nextPipelineCursor", () => {
  test("stops when there is no next page", () => {
    expect(nextPipelineCursor(false, null, "cursor-1")).toBeNull();
  });

  test("accepts an advancing cursor", () => {
    expect(nextPipelineCursor(true, "cursor-2", "cursor-1")).toBe("cursor-2");
  });

  test("rejects a missing next cursor", () => {
    expect(() => nextPipelineCursor(true, null, "cursor-1")).toThrow(
      "GitLab pipeline pagination did not advance.",
    );
  });

  test("rejects a repeated cursor", () => {
    expect(() => nextPipelineCursor(true, "cursor-1", "cursor-1")).toThrow(
      "GitLab pipeline pagination did not advance.",
    );
  });
});

describe("nextCommitUntil", () => {
  test("stops after a short final page", () => {
    expect(nextCommitUntil(19, 100, "2024-04-18T07:56:23.000Z", null, 19)).toBeNull();
  });

  test("uses the oldest commit timestamp as the next cursor", () => {
    expect(
      nextCommitUntil(100, 100, "2024-12-17T05:31:56.000Z", null, 100),
    ).toBe("2024-12-17T05:31:56.000Z");
  });

  test("allows boundary duplicates while new commits still arrive", () => {
    expect(
      nextCommitUntil(
        100,
        100,
        "2024-12-17T05:31:56.000Z",
        "2024-12-17T05:31:56.000Z",
        97,
      ),
    ).toBe("2024-12-17T05:31:56.000Z");
  });

  test("rejects a full page that makes no progress", () => {
    expect(() =>
      nextCommitUntil(
        100,
        100,
        "2024-12-17T05:31:56.000Z",
        "2024-12-17T05:31:56.000Z",
        0,
      ),
    ).toThrow("GitLab commit pagination did not advance.");
  });
});
