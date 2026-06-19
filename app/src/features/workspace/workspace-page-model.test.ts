import { describe, expect, it } from "vitest";

import { isStudioGenerationUserFacing } from "./workspace-page-model";

describe("studio generation visibility", () => {
  it("keeps restored bootstrap polling visible in the Studio preview", () => {
    expect(isStudioGenerationUserFacing(true, "bootstrap")).toBe(true);
  });

  it("does not show generation progress when no generation is running", () => {
    expect(isStudioGenerationUserFacing(false, "studio")).toBe(false);
    expect(isStudioGenerationUserFacing(true, "idle")).toBe(false);
  });
});
