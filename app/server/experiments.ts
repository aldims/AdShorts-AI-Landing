import { createHash } from "node:crypto";

export const firstVideoOfferVariants = ["plans_redirect_v1", "start_direct_v1"] as const;

export type FirstVideoOfferVariant = (typeof firstVideoOfferVariants)[number];

export const resolveFirstVideoOfferVariant = (userId: string): FirstVideoOfferVariant => {
  const stableKey = String(userId ?? "").trim() || "anonymous";
  const bucket = createHash("sha256")
    .update(`first-video-offer-v1:${stableKey}`)
    .digest()[0] ?? 0;

  return bucket % firstVideoOfferVariants.length === 0 ? "plans_redirect_v1" : "start_direct_v1";
};
