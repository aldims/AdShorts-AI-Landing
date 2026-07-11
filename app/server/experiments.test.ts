import { describe, expect, it } from "vitest";

import { firstVideoOfferVariants, resolveFirstVideoOfferVariant } from "./experiments.js";

describe("first video offer experiment", () => {
  it("keeps assignment stable for the same authenticated user", () => {
    const first = resolveFirstVideoOfferVariant("auth-user-4171");

    expect(resolveFirstVideoOfferVariant("auth-user-4171")).toBe(first);
    expect(firstVideoOfferVariants).toContain(first);
  });

  it("distributes a representative set across both variants", () => {
    const variants = new Set(
      Array.from({ length: 40 }, (_, index) => resolveFirstVideoOfferVariant(`auth-user-${index}`)),
    );

    expect(variants).toEqual(new Set(firstVideoOfferVariants));
  });
});
