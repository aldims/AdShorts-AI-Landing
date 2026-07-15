// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  persistDismissedFirstVideoOfferKey,
  persistDismissedStudioWelcomeCard,
  persistStudioCreateMode,
  persistStudioCreateSettings,
  readDismissedFirstVideoOfferKey,
  readDismissedStudioWelcomeCard,
  readStoredStudioCreateMode,
  readStoredStudioCreateSettings,
} from "./workspace-browser-storage-helpers";

let originalLocalStorage: PropertyDescriptor | undefined;
let originalSessionStorage: PropertyDescriptor | undefined;

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

describe("studio create mode storage", () => {
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

  it("persists the last mode per normalized account", () => {
    expect(readStoredStudioCreateMode("user@example.test")).toBeNull();

    persistStudioCreateMode(" User@Example.Test ", "segment-editor");

    expect(readStoredStudioCreateMode("user@example.test")).toBe("segment-editor");
    expect(readStoredStudioCreateMode("other@example.test")).toBeNull();

    persistStudioCreateMode("user@example.test", "default");

    expect(readStoredStudioCreateMode("USER@EXAMPLE.TEST")).toBe("default");
  });
});

describe("studio create settings storage", () => {
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

  it("persists the full AI video mode for the current account", () => {
    persistStudioCreateSettings(" User@Example.Test ", {
      aiVideoGenerateAudioEnabled: true,
      videoMode: "ai_video",
    });

    expect(readStoredStudioCreateSettings("user@example.test")?.videoMode).toBe("ai_video");
    expect(readStoredStudioCreateSettings("user@example.test")?.aiVideoGenerateAudioEnabled).toBe(true);
    expect(readStoredStudioCreateSettings("other@example.test")).toBeNull();
  });
});

describe("first video offer dismiss storage", () => {
  beforeEach(() => {
    originalSessionStorage = Object.getOwnPropertyDescriptor(window, "sessionStorage");
    Object.defineProperty(window, "sessionStorage", {
      configurable: true,
      value: createMemoryStorage(),
    });
  });

  afterEach(() => {
    if (originalSessionStorage) {
      Object.defineProperty(window, "sessionStorage", originalSessionStorage);
    }
  });

  it("remembers the dismissed result only for the current account session", () => {
    persistDismissedFirstVideoOfferKey(" User@Example.Test ", "ad:4171");

    expect(readDismissedFirstVideoOfferKey("user@example.test")).toBe("ad:4171");
    expect(readDismissedFirstVideoOfferKey("other@example.test")).toBeNull();

    persistDismissedFirstVideoOfferKey("user@example.test", null);
    expect(readDismissedFirstVideoOfferKey("user@example.test")).toBeNull();
  });
});
