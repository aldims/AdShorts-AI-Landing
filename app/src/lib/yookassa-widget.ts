const YOOKASSA_WIDGET_SCRIPT_URL = "https://yookassa.ru/checkout-widget/v1/checkout-widget.js";

type YooKassaWidgetOptions = {
  confirmation_token: string;
  customization: {
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

  const checkout = new Widget({
    confirmation_token: confirmationToken,
    return_url: returnUrl,
    customization: {
      modal: true,
    },
    error_callback: (error) => {
      onError(normalizeWidgetError(error));
    },
  });

  await checkout.render();
  return checkout;
};
