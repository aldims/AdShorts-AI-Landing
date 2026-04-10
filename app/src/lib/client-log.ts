export type ClientLogLevel = "debug" | "info" | "warn" | "error";

type ClientLogPayload = Record<string, unknown>;

const CLIENT_LOG_ENDPOINT = "/api/client-events";

const sanitizeClientLogValue = (value: unknown): unknown => {
  if (value instanceof Error) {
    return {
      message: value.message,
      name: value.name,
      stack: value.stack,
    };
  }

  if (Array.isArray(value)) {
    return value.map((entry) => sanitizeClientLogValue(entry));
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [key, sanitizeClientLogValue(entry)]),
  );
};

export const logClientEvent = (event: string, payload: ClientLogPayload = {}, level: ClientLogLevel = "info") => {
  const body = JSON.stringify({
    event,
    level,
    payload: sanitizeClientLogValue(payload),
    ts: new Date().toISOString(),
  });

  if (typeof window === "undefined") {
    return;
  }

  fetch(CLIENT_LOG_ENDPOINT, {
    method: "POST",
    credentials: "include",
    keepalive: true,
    headers: {
      "Content-Type": "application/json",
    },
    body,
  }).catch(() => {
    // Ignore client logging transport failures.
  });
};
