export type CheckoutProductId = "start" | "pro" | "ultra" | "package_10" | "package_50" | "package_100";
export type CheckoutReturnSource = "first_free_video_offer" | "pricing_site";
export type CheckoutReturnVariant = "plans_redirect_v1" | "start_direct_v1";

export type WorkspaceProfileSnapshot = {
  balance: number;
  plan: string;
};

export type CheckoutPaymentProfile = WorkspaceProfileSnapshot & {
  expiresAt?: string | null;
  startPlanUsed?: boolean;
};

export type CheckoutPaymentResult = {
  addedCredits: number | null;
  balance: number;
  plan: string;
  productId: CheckoutProductId;
  status: "pending" | "success";
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

export const evaluateCheckoutPaymentProfile = ({
  previousProfile,
  productId,
  profile,
}: {
  previousProfile: WorkspaceProfileSnapshot | null;
  productId: CheckoutProductId;
  profile: CheckoutPaymentProfile;
}): CheckoutPaymentResult => {
  const balance = Number.isFinite(Number(profile.balance)) ? Math.max(0, Number(profile.balance)) : 0;
  const plan = String(profile.plan ?? "").trim().toUpperCase();
  const addedCredits = previousProfile ? Math.max(0, balance - previousProfile.balance) : null;
  const expectedPlan = isPackageCheckoutProductId(productId) ? null : productId.toUpperCase();
  const planActivated = Boolean(expectedPlan && plan === expectedPlan);
  const balanceIncreased = Boolean(addedCredits !== null && addedCredits > 0);
  const success =
    balanceIncreased || planActivated || Boolean(!previousProfile && expectedPlan && plan && plan !== "FREE");

  return {
    addedCredits,
    balance,
    plan,
    productId,
    status: success ? "success" : "pending",
  };
};

export const pollCheckoutPaymentProfile = async ({
  attempts,
  delayMs,
  fetchProfile,
  onProfile,
  previousProfile,
  productId,
  signal,
  wait = (milliseconds: number) => new Promise<void>((resolve) => window.setTimeout(resolve, milliseconds)),
}: {
  attempts: number;
  delayMs: number;
  fetchProfile: () => Promise<CheckoutPaymentProfile>;
  onProfile?: (profile: CheckoutPaymentProfile) => void;
  previousProfile: WorkspaceProfileSnapshot | null;
  productId: CheckoutProductId;
  signal?: AbortSignal;
  wait?: (milliseconds: number) => Promise<void>;
}) => {
  let lastResult: CheckoutPaymentResult | null = null;

  for (let attempt = 0; attempt < Math.max(1, attempts); attempt += 1) {
    if (signal?.aborted) {
      return null;
    }

    try {
      const profile = await fetchProfile();
      if (signal?.aborted) {
        return null;
      }

      onProfile?.(profile);
      lastResult = evaluateCheckoutPaymentProfile({ previousProfile, productId, profile });
      if (lastResult.status === "success") {
        return lastResult;
      }
    } catch {
      if (signal?.aborted) {
        return null;
      }
    }

    if (attempt < Math.max(1, attempts) - 1) {
      await wait(delayMs);
    }
  }

  return lastResult;
};

export const buildPaymentReturnUrl = ({
  paymentId,
  pricingPath,
  productId,
  source,
  variant,
}: {
  paymentId?: string | null;
  pricingPath: string;
  productId: CheckoutProductId;
  source?: CheckoutReturnSource;
  variant?: CheckoutReturnVariant;
}) => {
  if (typeof window === "undefined") return pricingPath;

  const returnUrl = new URL(pricingPath, window.location.origin);
  returnUrl.searchParams.set("payment_status", "return");
  returnUrl.searchParams.set("payment_product", productId);

  const normalizedPaymentId = String(paymentId ?? "").trim();
  if (normalizedPaymentId) {
    returnUrl.searchParams.set("payment_id", normalizedPaymentId);
  }
  if (source) {
    returnUrl.searchParams.set("payment_source", source);
  }
  if (variant) {
    returnUrl.searchParams.set("payment_variant", variant);
  }

  returnUrl.hash = "payment-result";
  return returnUrl.toString();
};

export const readPaymentReturnProductId = (search: string): CheckoutProductId | null => {
  const params = new URLSearchParams(search);
  if (params.get("payment_status") !== "return") return null;
  return normalizeCheckoutProductId(params.get("payment_product"));
};

export const readPaymentReturnAttribution = (search: string) => {
  const params = new URLSearchParams(search);
  const source = params.get("payment_source");
  const variant = params.get("payment_variant");

  return {
    source: source === "first_free_video_offer" || source === "pricing_site" ? source : null,
    variant: variant === "plans_redirect_v1" || variant === "start_direct_v1" ? variant : null,
  } as const;
};

export const removePaymentReturnParams = (search: string) => {
  const params = new URLSearchParams(search);
  ["payment_status", "payment_product", "payment_id", "payment_source", "payment_variant"].forEach((key) => {
    params.delete(key);
  });
  const nextSearch = params.toString();
  return nextSearch ? `?${nextSearch}` : "";
};
