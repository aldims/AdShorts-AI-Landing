// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";

import { YANDEX_METRIKA_COUNTER_ID, syncMetrikaUserId } from "./metrika";

describe("syncMetrikaUserId", () => {
  beforeEach(() => {
    delete window.ym;
  });

  it("sets the AdsFlow user id as the Yandex Metrica UserID", () => {
    const ym = vi.fn();
    window.ym = ym;

    expect(syncMetrikaUserId(8371194632034885000)).toBe(true);
    expect(ym).toHaveBeenNthCalledWith(1, YANDEX_METRIKA_COUNTER_ID, "setUserID", "8371194632034885000");
    expect(ym).toHaveBeenNthCalledWith(2, YANDEX_METRIKA_COUNTER_ID, "userParams", {
      UserID: "8371194632034885000",
      adsflow_user_id: "8371194632034885000",
    });
  });

  it("skips empty ids and missing counters", () => {
    expect(syncMetrikaUserId("")).toBe(false);
    expect(syncMetrikaUserId("8371194632034885000")).toBe(false);
  });
});
