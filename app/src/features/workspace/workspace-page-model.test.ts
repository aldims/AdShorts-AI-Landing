import { describe, expect, it } from "vitest";

import {
  getWorkspaceStudioIdeaSuggestionRotation,
  getWorkspaceStudioIdeaSuggestions,
  getWorkspaceSegmentEditorSessionUrl,
  getPublishBootstrapForPlatform,
  getPublishChannelsForPlatform,
  isWorkspaceSegmentCustomVisualUploadBusy,
  isWorkspaceSegmentEditorProjectUnavailableError,
  isWorkspaceSegmentSceneSoundRunBusy,
  isStudioGenerationUserFacing,
  resolveWorkspaceRetainedScenesDraftState,
  resolveWorkspaceScenesModeSwitchTarget,
  shouldShowStudioGenerationError,
  shouldShowWorkspaceStudioIdeaEmptyState,
  shouldUseWorkspaceStudioExpandedPromptLayout,
  shouldShowWorkspaceStartFreshScenesAction,
  shouldShowWorkspaceSegmentEditorFullPreviewBusyIndicator,
  type WorkspacePublishBootstrapPayload,
} from "./workspace-page-model";

describe("segment editor session loading", () => {
  it("uses the cached endpoint unless a fresh session was explicitly requested", () => {
    expect(getWorkspaceSegmentEditorSessionUrl(4213)).toBe(
      "/api/workspace/projects/4213/segment-editor",
    );
    expect(getWorkspaceSegmentEditorSessionUrl(4213, { bypassCache: true })).toBe(
      "/api/workspace/projects/4213/segment-editor/reload",
    );
    expect(getWorkspaceSegmentEditorSessionUrl(4213, { forceRefresh: true })).toBe(
      "/api/workspace/projects/4213/segment-editor/reload",
    );
  });
});

describe("studio creation mode switching", () => {
  it("restores a detached scenes draft after leaving the editor", () => {
    const detachedDraft = { projectId: 4178, segments: [{ index: 0 }, { index: 1 }] };

    expect(
      resolveWorkspaceRetainedScenesDraftState(null, 0, {
        activeSegmentIndex: 1,
        draft: detachedDraft,
      }),
    ).toEqual({
      activeSegmentIndex: 1,
      draft: detachedDraft,
    });
  });

  it("prefers the active scenes draft over an older detached snapshot", () => {
    const activeDraft = { projectId: 4178, segments: [{ index: 0 }] };
    const detachedDraft = { projectId: 4178, segments: [{ index: 0 }, { index: 1 }] };

    expect(
      resolveWorkspaceRetainedScenesDraftState(activeDraft, 0, {
        activeSegmentIndex: 1,
        draft: detachedDraft,
      }),
    ).toEqual({
      activeSegmentIndex: 0,
      draft: activeDraft,
    });
  });

  it("opens the displayed video project before creating a scratch draft", () => {
    expect(
      resolveWorkspaceScenesModeSwitchTarget({
        hasDisplayedGeneratedProject: true,
        isSegmentEditorActive: false,
      }),
    ).toBe("project");
  });

  it("restores a retained scenes draft before the displayed video project", () => {
    expect(
      resolveWorkspaceScenesModeSwitchTarget({
        hasDisplayedGeneratedProject: true,
        hasRetainedScenesDraft: true,
        isSegmentEditorActive: false,
      }),
    ).toBe("current");
  });

  it("creates a fresh scenes project when Idea mode has no editable project", () => {
    expect(
      resolveWorkspaceScenesModeSwitchTarget({
        hasDisplayedGeneratedProject: false,
        isSegmentEditorActive: false,
      }),
    ).toBe("scratch");
  });

  it("shows the start-fresh action for content or unsaved editor changes", () => {
    expect(
      shouldShowWorkspaceStartFreshScenesAction({
        hasContent: true,
        hasResettableChanges: false,
        isSegmentEditorActive: true,
      }),
    ).toBe(true);
    expect(
      shouldShowWorkspaceStartFreshScenesAction({
        hasContent: false,
        hasResettableChanges: true,
        isSegmentEditorActive: true,
      }),
    ).toBe(true);
    expect(
      shouldShowWorkspaceStartFreshScenesAction({
        hasContent: true,
        hasResettableChanges: true,
        isSegmentEditorActive: false,
      }),
    ).toBe(false);
  });
});

describe("studio generation visibility", () => {
  it("keeps restored bootstrap polling visible in the Studio preview", () => {
    expect(isStudioGenerationUserFacing(true, "bootstrap")).toBe(true);
  });

  it("does not show generation progress when no generation is running", () => {
    expect(isStudioGenerationUserFacing(false, "studio")).toBe(false);
    expect(isStudioGenerationUserFacing(true, "idle")).toBe(false);
  });

  it("does not show stale errors while a generation is visible", () => {
    expect(shouldShowStudioGenerationError("Previous failure", true, "studio")).toBe(false);
    expect(shouldShowStudioGenerationError("Previous failure", true, "segment-editor")).toBe(false);
    expect(shouldShowStudioGenerationError("Previous failure", true, "bootstrap")).toBe(false);
    expect(shouldShowStudioGenerationError("Previous failure", false, "idle")).toBe(true);
  });
});

describe("studio prompt layout", () => {
  it("keeps the composer height stable for long multiline input", () => {
    expect(
      shouldUseWorkspaceStudioExpandedPromptLayout({
        hasComposerSourceIdea: false,
        topicInput: `${"Подробная идея для будущего Shorts. ".repeat(4)}\nВторая строка сценария.`,
      }),
    ).toBe(false);
  });

  it("expands only when content-plan source metadata is visible", () => {
    expect(
      shouldUseWorkspaceStudioExpandedPromptLayout({
        hasComposerSourceIdea: true,
        topicInput: "Короткая идея",
      }),
    ).toBe(true);
  });
});

describe("studio idea empty state", () => {
  const emptyStudio = {
    createMode: "default" as const,
    hasComposerSourceIdea: false,
    hasTopicInput: false,
    isContentPlanVisible: false,
    isCreateView: true,
    isPreviewStageVisible: false,
    isWelcomeVisible: false,
  };

  it("replaces the blank studio after the welcome guide is closed", () => {
    expect(shouldShowWorkspaceStudioIdeaEmptyState(emptyStudio)).toBe(true);
  });

  it("stays hidden while another primary studio state is visible", () => {
    expect(shouldShowWorkspaceStudioIdeaEmptyState({ ...emptyStudio, isWelcomeVisible: true })).toBe(false);
    expect(shouldShowWorkspaceStudioIdeaEmptyState({ ...emptyStudio, isPreviewStageVisible: true })).toBe(false);
    expect(shouldShowWorkspaceStudioIdeaEmptyState({ ...emptyStudio, isContentPlanVisible: true })).toBe(false);
  });

  it("disappears as soon as the user starts an idea", () => {
    expect(shouldShowWorkspaceStudioIdeaEmptyState({ ...emptyStudio, hasTopicInput: true })).toBe(false);
    expect(shouldShowWorkspaceStudioIdeaEmptyState({ ...emptyStudio, hasComposerSourceIdea: true })).toBe(false);
  });

  it("rotates through diverse suggestion packs and wraps safely", () => {
    const firstPack = getWorkspaceStudioIdeaSuggestions("ru", 0);
    const secondPack = getWorkspaceStudioIdeaSuggestions("ru", 1);

    expect(firstPack).toHaveLength(3);
    expect(secondPack).toHaveLength(3);
    expect(secondPack).not.toEqual(firstPack);
    expect(getWorkspaceStudioIdeaSuggestions("ru", 5)).toEqual(firstPack);
    expect(getWorkspaceStudioIdeaSuggestions("ru", -1)).toEqual(getWorkspaceStudioIdeaSuggestions("ru", 4));
    expect(getWorkspaceStudioIdeaSuggestions("ru", Number.NaN)).toEqual(firstPack);
  });

  it("changes the initial suggestion pack once per day", () => {
    expect(getWorkspaceStudioIdeaSuggestionRotation(0)).toBe(0);
    expect(getWorkspaceStudioIdeaSuggestionRotation(86_399_999)).toBe(0);
    expect(getWorkspaceStudioIdeaSuggestionRotation(86_400_000)).toBe(1);
  });

  it("keeps all prompts unique across a complete rotation", () => {
    const prompts = Array.from({ length: 5 }, (_, rotation) =>
      getWorkspaceStudioIdeaSuggestions("ru", rotation).map((suggestion) => suggestion.prompt),
    ).flat();

    expect(new Set(prompts).size).toBe(prompts.length);
  });
});

describe("segment editor project availability errors", () => {
  it("detects deleted project responses separately from generic not found errors", () => {
    expect(isWorkspaceSegmentEditorProjectUnavailableError("Проект удалён и недоступен для редактирования.")).toBe(true);
    expect(isWorkspaceSegmentEditorProjectUnavailableError("Project deleted and not available for editing.")).toBe(true);
    expect(isWorkspaceSegmentEditorProjectUnavailableError("Not found")).toBe(false);
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
