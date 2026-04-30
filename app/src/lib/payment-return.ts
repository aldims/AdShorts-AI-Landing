export type CheckoutProductId = "start" | "pro" | "ultra" | "package_10" | "package_50" | "package_100";

export type WorkspaceProfileSnapshot = {
  balance: number;
  plan: string;
};

export const PENDING_CHECKOUT_STORAGE_KEY = "adshorts.pending-checkout-plan";
export const PRE_CHECKOUT_PROFILE_STORAGE_KEY = "adshorts.pre-checkout-profile";

const normalizeCheckoutProductId = (value: unknown): CheckoutProductId | null => {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (
    normalized === "start" ||
    normalized === "pro" ||
    normalized === "ultra" ||
    normalized === "package_10" ||
    normalized === "package_50" ||
    normalized === "package_100"
  ) {
    return normalized;
  }

  return null;
};

export const isPackageCheckoutProductId = (value: CheckoutProductId) => value.startsWith("package_");

export const getCheckoutProductLabel = (value: CheckoutProductId) => {
  if (value === "package_10") return "Pack 100";
  if (value === "package_50") return "Pack 500";
  if (value === "package_100") return "Pack 1000";
  return value.toUpperCase();
};

export const writePreCheckoutProfile = (
  productId: CheckoutProductId,
  profile: WorkspaceProfileSnapshot | null | undefined,
) => {
  if (typeof window === "undefined") return;

  try {
    window.sessionStorage.setItem(
      PRE_CHECKOUT_PROFILE_STORAGE_KEY,
      JSON.stringify({
        balance: Number.isFinite(Number(profile?.balance)) ? Math.max(0, Number(profile?.balance)) : null,
        plan: String(profile?.plan ?? "").trim().toUpperCase() || null,
        productId,
      }),
    );
  } catch {
    // Ignore storage write errors.
  }
};

export const readPreCheckoutProfile = (productId: CheckoutProductId): WorkspaceProfileSnapshot | null => {
  if (typeof window === "undefined") return null;

  try {
    const payload = JSON.parse(window.sessionStorage.getItem(PRE_CHECKOUT_PROFILE_STORAGE_KEY) ?? "null") as {
      balance?: unknown;
      plan?: unknown;
      productId?: unknown;
    } | null;
    if (!payload || normalizeCheckoutProductId(payload.productId) !== productId) return null;

    const balance = Number(payload.balance);
    return {
      balance: Number.isFinite(balance) ? Math.max(0, balance) : 0,
      plan: String(payload.plan ?? "").trim().toUpperCase(),
    };
  } catch {
    return null;
  }
};

export const clearPreCheckoutProfile = () => {
  if (typeof window === "undefined") return;

  try {
    window.sessionStorage.removeItem(PRE_CHECKOUT_PROFILE_STORAGE_KEY);
  } catch {
    // Ignore storage removal errors.
  }
};

export const buildPaymentReturnUrl = ({
  paymentId,
  pricingPath,
  productId,
}: {
  paymentId?: string | null;
  pricingPath: string;
  productId: CheckoutProductId;
}) => {
  if (typeof window === "undefined") return pricingPath;

  const returnUrl = new URL(pricingPath, window.location.origin);
  returnUrl.searchParams.set("payment_status", "return");
  returnUrl.searchParams.set("payment_product", productId);

  const normalizedPaymentId = String(paymentId ?? "").trim();
  if (normalizedPaymentId) {
    returnUrl.searchParams.set("payment_id", normalizedPaymentId);
  }

  returnUrl.hash = "payment-result";
  return returnUrl.toString();
};

export const readPaymentReturnProductId = (search: string): CheckoutProductId | null => {
  const params = new URLSearchParams(search);
  if (params.get("payment_status") !== "return") return null;
  return normalizeCheckoutProductId(params.get("payment_product"));
};
