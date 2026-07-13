// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from "vitest";

import {
  readWorkspaceSegmentEditorStorageCandidates,
  writeWorkspaceSegmentEditorStorageValue,
} from "./workspace-segment-editor-storage";

const createMemoryStorage = (): Storage => {
  const values = new Map<string, string>();
  return {
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => Array.from(values.keys())[index] ?? null,
    get length() {
      return values.size;
    },
    removeItem: (key) => {
      values.delete(key);
    },
    setItem: (key, value) => {
      values.set(key, String(value));
    },
  };
};

describe("workspace segment editor storage fallback", () => {
  let localStorage: Storage;
  let sessionStorage: Storage;

  beforeEach(() => {
    localStorage = createMemoryStorage();
    sessionStorage = createMemoryStorage();
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: localStorage,
    });
    Object.defineProperty(window, "sessionStorage", {
      configurable: true,
      value: sessionStorage,
    });
  });

  it("keeps the session fallback as the only source when local storage is full", () => {
    const storageKey = "adshorts.segment-editor-draft:test:4197";
    localStorage.setItem(storageKey, "stale-scene-video");
    localStorage.setItem = () => {
      throw new DOMException("Quota exceeded", "QuotaExceededError");
    };

    writeWorkspaceSegmentEditorStorageValue(storageKey, "latest-scene-video");

    expect(localStorage.getItem(storageKey)).toBeNull();
    expect(sessionStorage.getItem(storageKey)).toBe("latest-scene-video");
  });

  it("prefers an existing session fallback over a stale local value", () => {
    const storageKey = "adshorts.segment-editor-draft:test:4197";
    localStorage.setItem(storageKey, "stale-scene-video");
    sessionStorage.setItem(storageKey, "latest-scene-video");

    expect(readWorkspaceSegmentEditorStorageCandidates(storageKey)).toEqual([
      { rawValue: "latest-scene-video", storageName: "sessionStorage" },
      { rawValue: "stale-scene-video", storageName: "localStorage" },
    ]);
  });
});
