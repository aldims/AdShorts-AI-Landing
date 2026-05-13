import { createHmac, createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import {
  createTelegramLoginNonce,
  parseTelegramLoginNonce,
  serializeTelegramLoginNonce,
  verifyTelegramLogin,
  type TelegramLoginData,
} from "./telegram.js";

const botToken = "123456:telegram-test-token";

const signTelegramLoginData = (data: Omit<TelegramLoginData, "hash">) => {
  const checkString = Object.entries(data)
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${String(value)}`)
    .join("\n");
  const secretKey = createHash("sha256").update(botToken).digest();
  return createHmac("sha256", secretKey).update(checkString).digest("hex");
};

describe("Telegram login verification", () => {
  it("verifies signed login data without optional fields", () => {
    const unsignedData: Omit<TelegramLoginData, "hash"> = {
      auth_date: 1_000,
      first_name: "Alex",
      id: 123456789,
      last_name: undefined,
      photo_url: undefined,
      username: undefined,
    };

    expect(
      verifyTelegramLogin(
        {
          ...unsignedData,
          hash: signTelegramLoginData(unsignedData),
        },
        { botToken, nowSeconds: 1_100 },
      ),
    ).toBe(true);
  });

  it("rejects stale or tampered login data", () => {
    const unsignedData: Omit<TelegramLoginData, "hash"> = {
      auth_date: 1_000,
      first_name: "Alex",
      id: 123456789,
      username: "alex",
    };
    const hash = signTelegramLoginData(unsignedData);

    expect(verifyTelegramLogin({ ...unsignedData, first_name: "Max", hash }, { botToken, nowSeconds: 1_100 })).toBe(
      false,
    );
    expect(verifyTelegramLogin({ ...unsignedData, hash }, { botToken, nowSeconds: 90_000 })).toBe(false);
  });

  it("round-trips signed OIDC nonce cookies", () => {
    const nonce = createTelegramLoginNonce();
    const serialized = serializeTelegramLoginNonce(nonce);

    expect(parseTelegramLoginNonce(serialized)).toBe(nonce);
    expect(parseTelegramLoginNonce(`${nonce}.tampered`)).toBeNull();
  });
});
