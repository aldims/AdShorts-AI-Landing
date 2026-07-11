// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";

import {
  clearPricingEntryIntent,
  readPricingEntryIntent,
  writePricingEntryIntent,
} from "./pricing-entry-intent";

afterEach(() => {
  clearPricingEntryIntent();
});

describe("pricing entry intent", () => {
  it.each(["first-video-success", "insufficient-credits"] as const)(
    "persists the %s entry source",
    (source) => {
      writePricingEntryIntent({ section: "plans", source });

      expect(readPricingEntryIntent()).toEqual({ section: "plans", source });
    },
  );

  it("keeps first-video experiment attribution", () => {
    writePricingEntryIntent({
      offerVariant: "plans_redirect_v1",
      section: "plans",
      source: "first-video-success",
    });

    expect(readPricingEntryIntent()).toEqual({
      offerVariant: "plans_redirect_v1",
      section: "plans",
      source: "first-video-success",
    });
  });
});
