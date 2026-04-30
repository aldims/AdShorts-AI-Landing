const YOOKASSA_WIDGET_SCRIPT_URL = "https://yookassa.ru/checkout-widget/v1/checkout-widget.js";
const YOOKASSA_WIDGET_BODY_CLASS = "yookassa-widget-open";

type YooKassaWidgetOptions = {
  confirmation_token: string;
  customization: {
    colors: {
      background: string;
      border: string;
      control_primary: string;
      control_primary_content: string;
      control_secondary: string;
      text: string;
    };
    modal: true;
  };
  error_callback: (error: unknown) => void;
  return_url: string;
};

type YooKassaWidgetInstance = {
  destroy?: () => void;
  render: (containerId?: string) => Promise<void>;
};

type YooKassaWidgetConstructor = new (options: YooKassaWidgetOptions) => YooKassaWidgetInstance;

declare global {
  interface Window {
    YooMoneyCheckoutWidget?: YooKassaWidgetConstructor;
  }
}

let widgetScriptPromise: Promise<void> | null = null;
let widgetBackdropCleanup: (() => void) | null = null;

const yookassaWidgetColors: YooKassaWidgetOptions["customization"]["colors"] = {
  background: "#0D0F17",
  border: "#2A3046",
  control_primary: "#7B82F5",
  control_primary_content: "#FFFFFF",
  control_secondary: "#FFFFFF",
  text: "#F0F2FF",
};

const getYooKassaWidgetDialog = () => {
  const frame = document.querySelector<HTMLIFrameElement>('[role="dialog"] iframe, dialog iframe');
  return frame?.closest<HTMLElement>('[role="dialog"], dialog') ?? null;
};

const isYooKassaWidgetDialogOpen = () => {
  const dialog = getYooKassaWidgetDialog();
  if (!dialog) {
    return false;
  }

  if (typeof HTMLDialogElement !== "undefined" && dialog instanceof HTMLDialogElement && !dialog.open) {
    return false;
  }

  if (dialog.getAttribute("aria-hidden") === "true") {
    return false;
  }

  const style = window.getComputedStyle(dialog);
  return style.display !== "none" && style.visibility !== "hidden" && style.opacity !== "0";
};

const clearYooKassaWidgetBackdrop = () => {
  widgetBackdropCleanup?.();
  widgetBackdropCleanup = null;
  document.body.classList.remove(YOOKASSA_WIDGET_BODY_CLASS);
};

const watchYooKassaWidgetBackdrop = () => {
  widgetBackdropCleanup?.();

  const clearIfClosed = () => {
    if (!isYooKassaWidgetDialogOpen()) {
      clearYooKassaWidgetBackdrop();
    }
  };
  const observer = new MutationObserver(clearIfClosed);
  const intervalId = window.setInterval(clearIfClosed, 500);

  observer.observe(document.body, {
    attributeFilter: ["aria-hidden", "class", "open", "style"],
    attributes: true,
    childList: true,
    subtree: true,
  });

  widgetBackdropCleanup = () => {
    observer.disconnect();
    window.clearInterval(intervalId);
  };
};

const loadYooKassaWidgetScript = () => {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Payment widget is available only in the browser."));
  }

  if (window.YooMoneyCheckoutWidget) {
    return Promise.resolve();
  }

  if (widgetScriptPromise) {
    return widgetScriptPromise;
  }

  widgetScriptPromise = new Promise<void>((resolve, reject) => {
    const rejectLoad = () => {
      widgetScriptPromise = null;
      reject(new Error("Could not load YooKassa widget."));
    };

    const existingScript = document.querySelector<HTMLScriptElement>(`script[src="${YOOKASSA_WIDGET_SCRIPT_URL}"]`);
    if (existingScript) {
      existingScript.addEventListener("load", () => resolve(), { once: true });
      existingScript.addEventListener("error", rejectLoad, { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = YOOKASSA_WIDGET_SCRIPT_URL;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = rejectLoad;
    document.head.appendChild(script);
  });

  return widgetScriptPromise;
};

const normalizeWidgetError = (error: unknown) => {
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }

  const errorPayload = error as { code?: unknown; message?: unknown } | null;
  const message = String(errorPayload?.message ?? errorPayload?.code ?? error ?? "").trim();
  return message || "Payment widget error.";
};

const createYooKassaCheckout = ({
  confirmationToken,
  onError,
  returnUrl,
  Widget,
}: {
  confirmationToken: string;
  onError: (message: string) => void;
  returnUrl: string;
  Widget: YooKassaWidgetConstructor;
}) => {
  let rejectWidgetError: ((error: Error) => void) | null = null;
  const widgetErrorPromise = new Promise<never>((_, reject) => {
    rejectWidgetError = reject;
  });
  const customization: YooKassaWidgetOptions["customization"] = {
    colors: yookassaWidgetColors,
    modal: true,
  };

  const checkout = new Widget({
    confirmation_token: confirmationToken,
    return_url: returnUrl,
    customization,
    error_callback: (error) => {
      const message = normalizeWidgetError(error);
      clearYooKassaWidgetBackdrop();
      onError(message);
      rejectWidgetError?.(new Error(message));
    },
  });

  return { checkout, widgetErrorPromise };
};

const renderYooKassaCheckout = async (
  checkout: YooKassaWidgetInstance,
  widgetErrorPromise: Promise<never>,
) => {
  clearYooKassaWidgetBackdrop();
  document.body.classList.add(YOOKASSA_WIDGET_BODY_CLASS);

  try {
    await Promise.race([checkout.render(), widgetErrorPromise]);
    watchYooKassaWidgetBackdrop();
    return checkout;
  } catch (error) {
    clearYooKassaWidgetBackdrop();
    throw error;
  }
};

export const openYooKassaPaymentWidget = async ({
  confirmationToken,
  onError,
  returnUrl,
}: {
  confirmationToken: string;
  onError: (message: string) => void;
  returnUrl: string;
}) => {
  await loadYooKassaWidgetScript();

  const Widget = window.YooMoneyCheckoutWidget;
  if (!Widget) {
    throw new Error("YooKassa widget is unavailable.");
  }

  const checkout = createYooKassaCheckout({
    confirmationToken,
    onError,
    returnUrl,
    Widget,
  });

  return renderYooKassaCheckout(checkout.checkout, checkout.widgetErrorPromise);
};
