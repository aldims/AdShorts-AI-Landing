import { describe, expect, it } from "vitest";

import { isTrackedFirstVideoOfferEvent } from "./first-video-offer.js";

describe("first video offer configuration", () => {
  it("forwards only known offer analytics events", () => {
    expect(isTrackedFirstVideoOfferEvent("first_video_offer_checkout_clicked")).toBe(true);
    expect(isTrackedFirstVideoOfferEvent("arbitrary_client_event")).toBe(false);
  });
});
