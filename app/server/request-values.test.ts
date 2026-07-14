import { describe, expect, it } from "vitest";

import { normalizeRequiredJsonNonNegativeInteger } from "./request-values.js";

describe("request JSON values", () => {
  it("accepts only actual non-negative integer numbers", () => {
    expect(normalizeRequiredJsonNonNegativeInteger(0)).toBe(0);
    expect(normalizeRequiredJsonNonNegativeInteger(12)).toBe(12);

    for (const value of [undefined, null, true, false, "0", "12", 1.5, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(normalizeRequiredJsonNonNegativeInteger(value)).toBeUndefined();
    }
  });
});
