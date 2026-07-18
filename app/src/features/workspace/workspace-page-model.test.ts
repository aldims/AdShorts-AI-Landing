import { describe, expect, it } from "vitest";
import { areWorkspaceProfilesEqual } from "./workspace-profile-helpers";

import {
  buildWorkspaceSessionIdentityKey,
  hasWorkspaceSessionIdentityChanged,
  getWorkspaceStudioIdeaSuggestionRotation,
  getWorkspaceStudioIdeaSuggestions,
  getWorkspaceSegmentEditorSessionUrl,
  getPublishBootstrapForPlatform,
  getPublishChannelsForPlatform,
  isWorkspacePublishPlatformAvailable,
  isWorkspaceSegmentCustomVisualUploadBusy,
  isWorkspaceExplicitSegmentEditorRoute,
  isWorkspaceSegmentEditorProjectUnavailableError,
  openWorkspaceProjectEditorAfterSuccessfulLoad,
  isWorkspaceSegmentLibraryLoadMoreSentinelNearViewport,
  isWorkspaceSegmentSceneSoundRunBusy,
  isStudioGenerationUserFacing,
  resolveWorkspaceLatestStoredScenesDraft,
  resolveWorkspaceStudioCreateModeDuringGeneration,
  resolveWorkspaceRetainedScenesDraftState,
  resolveWorkspaceScenesModeSwitchTarget,
  shouldDisableWorkspaceScenesCreateMode,
  shouldNotifyStudioGenerationError,
  shouldRedirectWorkspaceScenesModeDuringGeneration,
  shouldRetryWorkspaceSegmentAiVideoStatusFailure,
  shouldResetWorkspaceSegmentLibraryRenderCount,
  shouldShowWorkspaceStudioIdeaEmptyState,
  shouldShowWorkspaceStudioWelcomeCard,
  shouldUseWorkspaceStudioExpandedPromptLayout,
  shouldShowWorkspaceStartFreshScenesAction,
  shouldShowWorkspaceSegmentEditorFullPreviewBusyIndicator,
  type WorkspacePublishBootstrapPayload,
} from "./workspace-page-model";

describe("workspace session identity", () => {
  it("changes when an account is recreated with the same email", () => {
    const session = {
      email: "user@example.com",
      id: "auth-user",
    };

    expect(buildWorkspaceSessionIdentityKey(session, "old-adsflow-user")).not.toBe(
      buildWorkspaceSessionIdentityKey(session, "new-adsflow-user"),
    );
  });

  it("changes when Better Auth creates a new principal for the same email", () => {
    expect(
      buildWorkspaceSessionIdentityKey({ email: "user@example.com", id: "old-auth-user" }),
    ).not.toBe(
      buildWorkspaceSessionIdentityKey({ email: "user@example.com", id: "new-auth-user" }),
    );
  });

  it("does not treat profiles from recreated AdsFlow users as equal", () => {
    const profile = {
      balance: 10,
      expiresAt: null,
      plan: "FREE",
      startPlanUsed: false,
    };

    expect(
      areWorkspaceProfilesEqual(
        { ...profile, userId: "old-adsflow-user" },
        { ...profile, userId: "new-adsflow-user" },
      ),
    ).toBe(false);
  });

  it("does not reset the editor when the AdsFlow id is hydrated for the same auth principal", () => {
    const principalOnly = buildWorkspaceSessionIdentityKey({ email: "user@example.com", id: "auth-user" });
    const hydrated = buildWorkspaceSessionIdentityKey(
      { email: "user@example.com", id: "auth-user" },
      "adsflow-user",
    );

    expect(hasWorkspaceSessionIdentityChanged(principalOnly, hydrated)).toBe(false);
    expect(hasWorkspaceSessionIdentityChanged(hydrated, principalOnly)).toBe(false);
    expect(
      hasWorkspaceSessionIdentityChanged(
        hydrated,
        buildWorkspaceSessionIdentityKey(
          { email: "user@example.com", id: "auth-user" },
          "recreated-adsflow-user",
        ),
      ),
    ).toBe(true);
  });

  it("keeps both persisted edit and scratch scenes routes attached to the editor", () => {
    expect(
      isWorkspaceExplicitSegmentEditorRoute({
        isStudioPathname: true,
        projectId: 42,
        section: "edit",
      }),
    ).toBe(true);
    expect(
      isWorkspaceExplicitSegmentEditorRoute({
        isStudioPathname: true,
        mode: "scenes",
        projectId: null,
        section: "create",
      }),
    ).toBe(true);
    expect(
      isWorkspaceExplicitSegmentEditorRoute({
        isStudioPathname: true,
        mode: null,
        projectId: null,
        section: "create",
      }),
    ).toBe(false);
  });
});

describe("segment editor session loading", () => {
  it("retries a not-found status while a client-assigned AI video job is becoming visible", () => {
    const createdAt = 10_000;

    expect(
      shouldRetryWorkspaceSegmentAiVideoStatusFailure({
        createdAt,
        now: createdAt + 89_999,
        statusCode: 404,
      }),
    ).toBe(true);
    expect(
      shouldRetryWorkspaceSegmentAiVideoStatusFailure({
        createdAt,
        now: createdAt + 90_000,
        statusCode: 404,
      }),
    ).toBe(false);
    expect(
      shouldRetryWorkspaceSegmentAiVideoStatusFailure({
        createdAt,
        now: createdAt + 120_000,
        statusCode: 503,
      }),
    ).toBe(true);
  });

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

describe("segment editor media library pagination", () => {
  it("does not let the closed modal reset the visible inline scene library", () => {
    expect(
      shouldResetWorkspaceSegmentLibraryRenderCount({
        hasModalSegment: true,
        isInlineLibraryVisible: true,
        isModalOpen: false,
      }),
    ).toBe(false);
    expect(
      shouldResetWorkspaceSegmentLibraryRenderCount({
        hasModalSegment: true,
        isInlineLibraryVisible: false,
        isModalOpen: false,
      }),
    ).toBe(true);
  });

  it("loads the next card batch while the sentinel is inside the compact panel preload margin", () => {
    expect(
      isWorkspaceSegmentLibraryLoadMoreSentinelNearViewport({
        rootBottom: 635,
        rootTop: 302,
        sentinelBottom: 702,
        sentinelTop: 701,
      }),
    ).toBe(true);
    expect(
      isWorkspaceSegmentLibraryLoadMoreSentinelNearViewport({
        rootBottom: 635,
        rootTop: 302,
        sentinelBottom: 902,
        sentinelTop: 901,
      }),
    ).toBe(false);
  });
});

describe("studio creation mode switching", () => {
  it("forces idea mode while Shorts creation is visible", () => {
    expect(resolveWorkspaceStudioCreateModeDuringGeneration("segment-editor", true)).toBe("default");
    expect(resolveWorkspaceStudioCreateModeDuringGeneration("default", true)).toBe("default");
    expect(resolveWorkspaceStudioCreateModeDuringGeneration("segment-editor", false)).toBe("segment-editor");
  });

  it("redirects direct scenes routes during generation without blocking other Studio sections", () => {
    const baseOptions = {
      createMode: "default" as const,
      isGenerationVisible: true,
      isScenesRoute: true,
      isStudioCreateView: true,
      isStudioPathname: true,
    };

    expect(shouldRedirectWorkspaceScenesModeDuringGeneration(baseOptions)).toBe(true);
    expect(
      shouldRedirectWorkspaceScenesModeDuringGeneration({
        ...baseOptions,
        isScenesRoute: false,
        isStudioCreateView: false,
      }),
    ).toBe(false);
    expect(
      shouldRedirectWorkspaceScenesModeDuringGeneration({
        ...baseOptions,
        isGenerationVisible: false,
      }),
    ).toBe(false);
  });

  it("blocks scenes mode while Shorts creation is visible", () => {
    expect(
      shouldDisableWorkspaceScenesCreateMode({
        isEditHidden: false,
        isGenerationVisible: true,
      }),
    ).toBe(true);
    expect(
      shouldDisableWorkspaceScenesCreateMode({
        isEditHidden: false,
        isGenerationVisible: false,
      }),
    ).toBe(false);
  });

  it("keeps scenes mode blocked when editing is disabled globally", () => {
    expect(
      shouldDisableWorkspaceScenesCreateMode({
        isEditHidden: true,
        isGenerationVisible: false,
      }),
    ).toBe(true);
  });

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

  it("restores a stored scenes draft after the Studio page was unmounted", () => {
    const storedDraft = {
      clientUpdatedAt: Date.parse("2026-07-17T12:05:00.000Z"),
      projectId: 4178,
      segments: [{ index: 0 }],
    };

    expect(
      resolveWorkspaceRetainedScenesDraftState(null, 0, null, {
        activeSegmentIndex: 0,
        draft: storedDraft,
      }),
    ).toEqual({
      activeSegmentIndex: 0,
      draft: storedDraft,
    });
  });

  it("prefers the in-memory detached snapshot over its stored fallback", () => {
    const detachedDraft = { projectId: 4178, segments: [{ index: 0 }, { index: 1 }] };
    const storedDraft = { projectId: 4178, segments: [{ index: 0 }] };

    expect(
      resolveWorkspaceRetainedScenesDraftState(
        null,
        0,
        { activeSegmentIndex: 1, draft: detachedDraft },
        { activeSegmentIndex: 0, draft: storedDraft },
      ),
    ).toEqual({
      activeSegmentIndex: 1,
      draft: detachedDraft,
    });
  });

  it("selects the most recently refined stored project or scratch draft", () => {
    const olderProjectDraft = {
      clientUpdatedAt: Date.parse("2026-07-17T12:00:00.000Z"),
      projectId: 4178,
    };
    const newerScratchDraft = {
      clientUpdatedAt: Date.parse("2026-07-17T12:05:00.000Z"),
      projectId: 0,
    };

    expect(resolveWorkspaceLatestStoredScenesDraft([olderProjectDraft, newerScratchDraft])).toBe(
      newerScratchDraft,
    );
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

  it("opens a newer generated video instead of an older retained scenes draft", () => {
    expect(
      resolveWorkspaceScenesModeSwitchTarget({
        hasDisplayedGeneratedProject: true,
        hasRetainedScenesDraft: true,
        isSegmentEditorActive: false,
        latestProjectId: 4202,
        latestProjectUpdatedAt: "2026-07-17T12:05:00.000Z",
        retainedDraftProjectId: 4178,
        retainedDraftUpdatedAt: Date.parse("2026-07-17T12:00:00.000Z"),
      }),
    ).toBe("project");
  });

  it("restores newer scene refinements instead of an older generated video", () => {
    expect(
      resolveWorkspaceScenesModeSwitchTarget({
        hasDisplayedGeneratedProject: true,
        hasRetainedScenesDraft: true,
        isSegmentEditorActive: false,
        latestProjectId: 4202,
        latestProjectUpdatedAt: "2026-07-17T12:00:00.000Z",
        retainedDraftProjectId: 4178,
        retainedDraftUpdatedAt: Date.parse("2026-07-17T12:05:00.000Z"),
      }),
    ).toBe("current");
  });

  it("keeps retained scene settings when they belong to the latest video", () => {
    expect(
      resolveWorkspaceScenesModeSwitchTarget({
        hasDisplayedGeneratedProject: true,
        hasRetainedScenesDraft: true,
        isSegmentEditorActive: false,
        latestProjectId: 4202,
        latestProjectUpdatedAt: "2026-07-17T12:05:00.000Z",
        retainedDraftProjectId: 4202,
        retainedDraftUpdatedAt: null,
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

  it("creates a fresh scenes project from the visible Idea empty state instead of restoring a retained draft", () => {
    expect(
      resolveWorkspaceScenesModeSwitchTarget({
        hasDisplayedGeneratedProject: false,
        hasRetainedScenesDraft: true,
        isIdeaEmptyStateVisible: true,
        isSegmentEditorActive: false,
        retainedDraftProjectId: 4178,
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

  it("notifies about current-run errors after generation stops without replaying bootstrap history", () => {
    expect(shouldNotifyStudioGenerationError("Previous failure", true, "studio")).toBe(false);
    expect(shouldNotifyStudioGenerationError("Previous failure", true, "segment-editor")).toBe(false);
    expect(shouldNotifyStudioGenerationError("Previous failure", true, "bootstrap")).toBe(false);
    expect(shouldNotifyStudioGenerationError("Previous failure", false, "bootstrap")).toBe(false);
    expect(shouldNotifyStudioGenerationError("Previous failure", false, "idle")).toBe(true);
    expect(shouldNotifyStudioGenerationError(null, false, "idle")).toBe(false);
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
  });

  it("remains visible while the content plan is open", () => {
    expect(shouldShowWorkspaceStudioIdeaEmptyState({ ...emptyStudio, isContentPlanVisible: true })).toBe(true);
  });

  it("remains visible while the user types an idea", () => {
    expect(shouldShowWorkspaceStudioIdeaEmptyState({ ...emptyStudio, hasTopicInput: true })).toBe(true);
  });

  it("hides when an idea is controlled by the content-plan source", () => {
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

describe("studio welcome card", () => {
  const newUserStudio = {
    createMode: "default" as const,
    hasCreatedVideo: false,
    isBootstrapPending: false,
    isClosed: false,
    isCreateView: true,
    isDismissed: false,
    isGuest: false,
    isGenerationVisible: false,
    isManuallyOpened: false,
  };

  it("keeps automatic onboarding visible until it is dismissed or a video exists", () => {
    expect(shouldShowWorkspaceStudioWelcomeCard(newUserStudio)).toBe(true);
    expect(shouldShowWorkspaceStudioWelcomeCard({ ...newUserStudio, isDismissed: true })).toBe(false);
    expect(shouldShowWorkspaceStudioWelcomeCard({ ...newUserStudio, hasCreatedVideo: true })).toBe(false);
  });

  it("allows a dismissed guide to be opened manually after a video is created", () => {
    expect(
      shouldShowWorkspaceStudioWelcomeCard({
        ...newUserStudio,
        hasCreatedVideo: true,
        isDismissed: true,
        isManuallyOpened: true,
      }),
    ).toBe(true);
  });

  it("shows onboarding on every guest Studio visit regardless of previous dismissals or videos", () => {
    expect(
      shouldShowWorkspaceStudioWelcomeCard({
        ...newUserStudio,
        hasCreatedVideo: true,
        isDismissed: true,
        isGuest: true,
      }),
    ).toBe(true);
    expect(
      shouldShowWorkspaceStudioWelcomeCard({
        ...newUserStudio,
        hasCreatedVideo: true,
        isClosed: true,
        isDismissed: true,
        isGuest: true,
      }),
    ).toBe(false);
  });

  it("does not cover loading, generation, or another creation mode", () => {
    expect(shouldShowWorkspaceStudioWelcomeCard({ ...newUserStudio, isBootstrapPending: true })).toBe(false);
    expect(shouldShowWorkspaceStudioWelcomeCard({ ...newUserStudio, isGenerationVisible: true })).toBe(false);
    expect(shouldShowWorkspaceStudioWelcomeCard({ ...newUserStudio, createMode: "segment-editor" })).toBe(false);
  });
});

describe("segment editor project availability errors", () => {
  it("detects deleted project responses separately from generic not found errors", () => {
    expect(isWorkspaceSegmentEditorProjectUnavailableError("Проект удалён и недоступен для редактирования.")).toBe(true);
    expect(isWorkspaceSegmentEditorProjectUnavailableError("Project deleted and not available for editing.")).toBe(true);
    expect(isWorkspaceSegmentEditorProjectUnavailableError("Not found")).toBe(false);
  });

  it("does not open an editor when project compatibility loading fails", async () => {
    const openedDrafts: string[] = [];

    const didOpen = await openWorkspaceProjectEditorAfterSuccessfulLoad<string>(
      async () => null,
      (draft) => openedDrafts.push(draft),
    );

    expect(didOpen).toBe(false);
    expect(openedDrafts).toEqual([]);
  });

  it("opens an editor only after a compatible project draft is loaded", async () => {
    const openedDrafts: string[] = [];

    const didOpen = await openWorkspaceProjectEditorAfterSuccessfulLoad(
      async () => "compatible-draft",
      (draft) => openedDrafts.push(draft),
    );

    expect(didOpen).toBe(true);
    expect(openedDrafts).toEqual(["compatible-draft"]);
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

  it("keeps Instagram publishing unavailable while the coming-soon state is active", () => {
    expect(isWorkspacePublishPlatformAvailable("youtube")).toBe(true);
    expect(isWorkspacePublishPlatformAvailable("instagram")).toBe(false);
  });
});
