import { type CheckoutProductId } from "./payment-return";

const REFERRAL_STORAGE_KEY = "adshorts.referral-code";
const REFERRAL_CODE_PATTERN = /^[a-z0-9][a-z0-9_-]{2,63}$/;

const normalizeReferralCode = (value: unknown) => {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s.]+/g, "-")
    .replace(/[^a-z0-9_-]/g, "")
    .replace(/-{2,}/g, "-")
    .replace(/_{2,}/g, "_")
    .replace(/^[-_]+|[-_]+$/g, "");

  return REFERRAL_CODE_PATTERN.test(normalized) ? normalized : "";
};

export const getStoredReferralCode = () => {
  if (typeof window === "undefined") return "";

  try {
    return normalizeReferralCode(window.localStorage.getItem(REFERRAL_STORAGE_KEY));
  } catch {
    return "";
  }
};

const storeReferralCode = (code: string) => {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(REFERRAL_STORAGE_KEY, code);
  } catch {
    // Ignore storage errors.
  }
};

export const captureReferralFromLocation = (location: {
  hash?: string;
  pathname: string;
  search: string;
}) => {
  if (typeof window === "undefined") return;

  const params = new URLSearchParams(location.search);
  const code = normalizeReferralCode(params.get("ref") ?? params.get("referral"));
  if (!code) return;

  fetch("/api/referrals/click", {
    method: "POST",
    credentials: "include",
    keepalive: true,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      code,
      landingUrl: window.location.href,
      referrer: document.referrer || null,
      sourcePath: `${location.pathname}${location.search}${location.hash ?? ""}`,
    }),
  })
    .then((response) => {
      if (response.ok) {
        storeReferralCode(code);
      }
    })
    .catch(() => {
      // Referral analytics must never block the app.
    });
};

export const recordReferralPurchase = (payload: {
  balance?: number | null;
  paymentId?: string | null;
  plan?: string | null;
  productId: CheckoutProductId;
}) => {
  if (typeof window === "undefined") return;

  const code = getStoredReferralCode();

  fetch("/api/referrals/purchase", {
    method: "POST",
    credentials: "include",
    keepalive: true,
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      ...payload,
      code: code || null,
    }),
  }).catch(() => {
    // Ignore analytics transport failures.
  });
};
