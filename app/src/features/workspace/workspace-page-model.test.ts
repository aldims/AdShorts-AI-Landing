import { describe, expect, it } from "vitest";

import {
  getPublishBootstrapForPlatform,
  getPublishChannelsForPlatform,
  isStudioGenerationUserFacing,
  type WorkspacePublishBootstrapPayload,
} from "./workspace-page-model";

describe("studio generation visibility", () => {
  it("keeps restored bootstrap polling visible in the Studio preview", () => {
    expect(isStudioGenerationUserFacing(true, "bootstrap")).toBe(true);
  });

  it("does not show generation progress when no generation is running", () => {
    expect(isStudioGenerationUserFacing(false, "studio")).toBe(false);
    expect(isStudioGenerationUserFacing(true, "idle")).toBe(false);
  });
});

describe("publish platform bootstrap scoping", () => {
  const youtubeBootstrap: WorkspacePublishBootstrapPayload = {
    channels: [
      {
        channelId: "UC123",
        channelName: "MeowFlow",
        pk: 64,
      },
    ],
    defaults: {
      description: "",
      hashtags: "",
      publishAt: null,
      title: "Ready to publish",
    },
    platform: "youtube",
    publication: null,
    selectedChannelPk: 64,
    videoProjectId: 100,
  };

  it("does not expose stale YouTube channels while Instagram is selected", () => {
    expect(getPublishBootstrapForPlatform(youtubeBootstrap, "instagram")).toBeNull();
    expect(getPublishChannelsForPlatform(youtubeBootstrap, "instagram")).toEqual([]);
  });

  it("keeps channels available for the matching platform", () => {
    expect(getPublishBootstrapForPlatform(youtubeBootstrap, "youtube")).toBe(youtubeBootstrap);
    expect(getPublishChannelsForPlatform(youtubeBootstrap, "youtube")).toEqual(youtubeBootstrap.channels);
  });
});
