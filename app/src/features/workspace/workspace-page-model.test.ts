import { describe, expect, it } from "vitest";

import {
  getPublishBootstrapForPlatform,
  getPublishChannelsForPlatform,
  isWorkspaceSegmentCustomVisualUploadBusy,
  isWorkspaceSegmentSceneSoundRunBusy,
  isStudioGenerationUserFacing,
  shouldShowWorkspaceSegmentEditorFullPreviewBusyIndicator,
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

describe("segment scene sound generation availability", () => {
  it("keeps scene sound available when only another visual generation is active", () => {
    expect(
      isWorkspaceSegmentSceneSoundRunBusy(1, {
        hasActiveSceneSoundRun: false,
        sceneSoundRunState: {},
      }),
    ).toBe(false);
  });

  it("blocks duplicate scene sound generation for the same segment", () => {
    expect(
      isWorkspaceSegmentSceneSoundRunBusy(1, {
        hasActiveSceneSoundRun: false,
        sceneSoundRunState: { 1: 3 },
      }),
    ).toBe(true);
    expect(
      isWorkspaceSegmentSceneSoundRunBusy(1, {
        hasActiveSceneSoundRun: true,
        sceneSoundRunState: {},
      }),
    ).toBe(true);
  });
});

describe("segment custom visual upload availability", () => {
  it("scopes upload busy state to the matching segment", () => {
    const uploadRunState = { 1: 4 };

    expect(isWorkspaceSegmentCustomVisualUploadBusy(uploadRunState, 1)).toBe(true);
    expect(isWorkspaceSegmentCustomVisualUploadBusy(uploadRunState, 2)).toBe(false);
    expect(isWorkspaceSegmentCustomVisualUploadBusy(uploadRunState, null)).toBe(false);
  });
});

describe("segment editor full preview busy indicator", () => {
  it("shows busy only while preview itself is loading", () => {
    expect(shouldShowWorkspaceSegmentEditorFullPreviewBusyIndicator("loading")).toBe(true);
    expect(
      shouldShowWorkspaceSegmentEditorFullPreviewBusyIndicator("loading", {
        blockedByActiveGeneration: true,
      }),
    ).toBe(false);
    expect(shouldShowWorkspaceSegmentEditorFullPreviewBusyIndicator("idle")).toBe(false);
    expect(shouldShowWorkspaceSegmentEditorFullPreviewBusyIndicator("playing")).toBe(false);
    expect(shouldShowWorkspaceSegmentEditorFullPreviewBusyIndicator("paused")).toBe(false);
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
