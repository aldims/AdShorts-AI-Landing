export const trackedFirstVideoOfferEvents = new Set([
  "first_free_video_offer_viewed",
  "first_video_offer_checkout_clicked",
  "first_video_offer_compare_plans_clicked",
  "first_free_video_offer_dismissed",
]);

export const trackedWebFunnelEvents = new Set([
  ...trackedFirstVideoOfferEvents,
  "pricing_page_viewed",
]);

export const isTrackedFirstVideoOfferEvent = (value: unknown) =>
  trackedFirstVideoOfferEvents.has(String(value ?? "").trim());

export const isTrackedWebFunnelEvent = (value: unknown) =>
  trackedWebFunnelEvents.has(String(value ?? "").trim());
