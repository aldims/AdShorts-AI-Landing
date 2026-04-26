import { describe, expect, it } from "vitest";

import { localizePathForLocale, pathnameHasLocalePrefix, resolveLocaleFromPathname, stripLocalePrefix } from "./i18n";

describe("i18n path helpers", () => {
  it("resolves locale from URL prefix", () => {
    expect(resolveLocaleFromPathname("/en/app/studio")).toBe("en");
    expect(resolveLocaleFromPathname("/pricing")).toBe("ru");
    expect(resolveLocaleFromPathname("/de/pricing")).toBe("ru");
  });

  it("strips supported locale prefixes", () => {
    expect(stripLocalePrefix("/en")).toBe("/");
    expect(stripLocalePrefix("/en/pricing")).toBe("/pricing");
    expect(stripLocalePrefix("/pricing")).toBe("/pricing");
  });

  it("detects whether the locale is explicit in the URL", () => {
    expect(pathnameHasLocalePrefix("/en/app/studio")).toBe(true);
    expect(pathnameHasLocalePrefix("/pricing")).toBe(false);
    expect(pathnameHasLocalePrefix("/engineering")).toBe(false);
  });

  it("builds localized internal paths and preserves query/hash", () => {
    expect(localizePathForLocale("en", "/examples?filter=ads#top")).toBe("/en/examples?filter=ads#top");
    expect(localizePathForLocale("ru", "/en/examples?filter=ads")).toBe("/examples?filter=ads");
    expect(localizePathForLocale("en", "https://adshortsai.com/shorts-guides/")).toBe(
      "https://adshortsai.com/shorts-guides/",
    );
  });
});
