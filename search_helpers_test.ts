import { describe, expect, test } from "bun:test";
import { nextPipelineCursor } from "./search_helpers";

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
