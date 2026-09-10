import { describe, expect, test } from "bun:test";
import { parsePageLimit } from "./args";

describe("parsePageLimit", () => {
  test("uses the default when pages are omitted", () => {
    expect(parsePageLimit(undefined)).toBe(50);
  });

  test("accepts positive integers", () => {
    expect(parsePageLimit("1")).toBe(1);
    expect(parsePageLimit("999")).toBe(999);
  });

  test.each(["0", "-1", "1.5", "nope", "Infinity"])(
    "rejects invalid page limit %s",
    (value) => {
      expect(() => parsePageLimit(value)).toThrow(
        "PAGES must be a positive integer.",
      );
    },
  );
});
