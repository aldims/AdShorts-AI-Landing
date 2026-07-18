import { describe, expect, it } from "vitest";

import { formatWorkspaceVideoPlayerTime } from "./workspace-time-formatters";

describe("formatWorkspaceVideoPlayerTime", () => {
  it("does not inflate a nominal four-second video because of its fractional container duration", () => {
    expect(formatWorkspaceVideoPlayerTime(4.041667, "duration")).toBe("00:04");
  });

  it("rounds longer fractional durations to the nearest displayed second", () => {
    expect(formatWorkspaceVideoPlayerTime(4.6, "duration")).toBe("00:05");
  });

  it("keeps elapsed playback time on the current whole second", () => {
    expect(formatWorkspaceVideoPlayerTime(4.9)).toBe("00:04");
  });
});
