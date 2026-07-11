export const trackedFirstVideoOfferEvents = new Set([
    "first_free_video_offer_viewed",
    "first_video_offer_checkout_clicked",
    "first_video_offer_compare_plans_clicked",
    "first_free_video_offer_dismissed",
]);
export const isTrackedFirstVideoOfferEvent = (value) => trackedFirstVideoOfferEvents.has(String(value ?? "").trim());
