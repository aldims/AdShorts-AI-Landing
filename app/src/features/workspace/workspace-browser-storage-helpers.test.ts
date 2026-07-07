// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  persistDismissedStudioWelcomeCard,
  readDismissedStudioWelcomeCard,
} from "./workspace-browser-storage-helpers";

let originalLocalStorage: PropertyDescriptor | undefined;

const createMemoryStorage = (): Storage => {
  const values = new Map<string, string>();

  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key: string) => values.get(key) ?? null,
    key: (index: number) => Array.from(values.keys())[index] ?? null,
    removeItem: (key: string) => {
      values.delete(key);
    },
    setItem: (key: string, value: string) => {
      values.set(key, String(value));
    },
  };
};

describe("studio welcome card dismiss storage", () => {
  beforeEach(() => {
    originalLocalStorage = Object.getOwnPropertyDescriptor(window, "localStorage");
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: createMemoryStorage(),
    });
  });

  afterEach(() => {
    if (originalLocalStorage) {
      Object.defineProperty(window, "localStorage", originalLocalStorage);
    }
  });

  it("persists and removes the guest dismiss flag", () => {
    expect(readDismissedStudioWelcomeCard(null)).toBe(false);

    persistDismissedStudioWelcomeCard(null, true);

    expect(readDismissedStudioWelcomeCard(undefined)).toBe(true);
    expect(readDismissedStudioWelcomeCard("user@example.test")).toBe(false);

    persistDismissedStudioWelcomeCard(undefined, false);

    expect(readDismissedStudioWelcomeCard(null)).toBe(false);
  });

  it("scopes the dismiss flag by normalized email", () => {
    persistDismissedStudioWelcomeCard("User@Example.Test ", true);

    expect(readDismissedStudioWelcomeCard("user@example.test")).toBe(true);
    expect(readDismissedStudioWelcomeCard("other@example.test")).toBe(false);
  });
});
