import type { StudioEntryIntentSection } from "../../lib/studio-entry-intent";

export type StudioView = "create" | "project" | "projects" | "media";
export type StudioRouteMode = "idea" | "scenes";
export type StudioRouteSection = StudioEntryIntentSection | "project";

export type StudioRouteState = {
  mode: StudioRouteMode;
  projectId: number | null;
  projectKey: string | null;
  section: StudioRouteSection;
  segmentIndex: number | null;
};

const parseStudioRouteInteger = (value: string | null, options?: { allowZero?: boolean }) => {
  if (!value) {
    return null;
  }

  const parsedValue = Number(value);
  if (!Number.isInteger(parsedValue)) {
    return null;
  }

  if (options?.allowZero) {
    return parsedValue >= 0 ? parsedValue : null;
  }

  return parsedValue > 0 ? parsedValue : null;
};

export const getStudioRouteState = (search: string): StudioRouteState => {
  const searchParams = new URLSearchParams(search);
  const section = searchParams.get("section");
  const mode = searchParams.get("mode");
  const projectKey = String(searchParams.get("project") ?? "").trim();

  return {
    mode: mode === "scenes" ? "scenes" : "idea",
    projectId: parseStudioRouteInteger(searchParams.get("projectId")),
    projectKey: projectKey ? projectKey.slice(0, 240) : null,
    section:
      section === "project" || section === "projects" || section === "media" || section === "edit"
        ? section
        : "create",
    segmentIndex: parseStudioRouteInteger(searchParams.get("segment"), { allowZero: true }),
  };
};

export const getStudioRouteSection = (search: string): StudioRouteSection => {
  return getStudioRouteState(search).section;
};

export const getStudioViewFromRouteSection = (section: StudioRouteSection): StudioView => {
  if (section === "project") {
    return "project";
  }

  if (section === "projects") {
    return "projects";
  }

  if (section === "media") {
    return "media";
  }

  return "create";
};

export const getStudioGenerationProjectRouteKey = (
  generation: { adId?: number | null; id?: string | null } | null | undefined,
) => {
  const adId = Number(generation?.adId);
  if (Number.isInteger(adId) && adId > 0) {
    return String(adId);
  }

  const generationId = String(generation?.id ?? "").trim();
  return generationId ? generationId.slice(0, 240) : null;
};

export const shouldDeferSegmentEditorRouteRestore = (pendingSection: StudioRouteSection | null) =>
  pendingSection !== null && pendingSection !== "edit";

export const resolveWorkspaceSegmentEditorPendingRouteSync = (
  pendingRouteSyncKey: string | null,
  restoreKey: string,
) => {
  if (!pendingRouteSyncKey) {
    return {
      didReachPendingRoute: false,
      nextPendingRouteSyncKey: null,
      shouldDeferRestore: false,
    };
  }

  if (pendingRouteSyncKey !== restoreKey) {
    return {
      didReachPendingRoute: false,
      nextPendingRouteSyncKey: pendingRouteSyncKey,
      shouldDeferRestore: true,
    };
  }

  return {
    didReachPendingRoute: true,
    nextPendingRouteSyncKey: null,
    shouldDeferRestore: false,
  };
};

export const shouldRequestWorkspaceSegmentEditorFreshRouteSession = (
  restoreKey: string | null | undefined,
  inFlightRouteKey: string | null,
  attemptedRouteKey: string | null,
) => {
  const normalizedRestoreKey = String(restoreKey ?? "").trim();
  if (!normalizedRestoreKey) {
    return false;
  }

  return inFlightRouteKey !== normalizedRestoreKey && attemptedRouteKey !== normalizedRestoreKey;
};

export const resolveWorkspaceSegmentEditorFreshRouteAttemptedKeyAfterLoad = (
  restoreKey: string,
  attemptedRouteKey: string | null,
  didLoad: boolean,
) => {
  if (didLoad || attemptedRouteKey !== restoreKey) {
    return attemptedRouteKey;
  }

  // An aborted route refresh must remain retryable. This is especially
  // important when React verifies effect cleanup by aborting the first load:
  // the stored draft is already visible, but its server timing is still stale.
  return null;
};

export const shouldRequestWorkspaceSegmentEditorOpenRouteRefresh = (
  didReachPendingRoute: boolean,
  isSegmentEditorLoading: boolean,
  hasSegmentEditorError: boolean,
) => !didReachPendingRoute && !isSegmentEditorLoading && !hasSegmentEditorError;

export const shouldRefreshWorkspaceSegmentEditorInitialEditRoute = (
  hasProcessedInitialEditRoute: boolean,
  restoreKeyMatches: boolean,
  hasStoredDraft: boolean,
  shouldPreferFreshSession: boolean,
) =>
  !hasProcessedInitialEditRoute &&
  !restoreKeyMatches &&
  (!hasStoredDraft || shouldPreferFreshSession);

export const hasWorkspaceSegmentEditorPersistedLocalChanges = (
  clientUpdatedAt: number | null | undefined,
) => Number.isFinite(Number(clientUpdatedAt)) && Number(clientUpdatedAt) > 0;

export const shouldPreserveWorkspaceSegmentEditorExplicitReset = (
  hasExplicitReset: boolean,
  changeCount: number | null,
  hasOnlyStaleDurationDrift: boolean,
) => hasExplicitReset && (changeCount === 0 || hasOnlyStaleDurationDrift);

export type WorkspaceSegmentEditorScratchDraftOpenSource = "current" | "stored" | "fresh";

export const resolveWorkspaceSegmentEditorScratchDraftOpenSource = (
  options: {
    forceFreshDraft?: boolean;
    hasCurrentScratchDraft?: boolean;
    hasStoredScratchDraft?: boolean;
  },
): WorkspaceSegmentEditorScratchDraftOpenSource => {
  if (options.forceFreshDraft) {
    return "fresh";
  }

  if (options.hasCurrentScratchDraft) {
    return "current";
  }

  if (options.hasStoredScratchDraft) {
    return "stored";
  }

  return "fresh";
};

export type WorkspaceSegmentEditorScenesEntryIntent = "mode-switch" | "standalone" | "create-new";

export const resolveWorkspaceSegmentEditorScenesEntryDraft = <TDraft>(options: {
  currentDraft?: TDraft | null;
  detachedDraft?: TDraft | null;
  intent: WorkspaceSegmentEditorScenesEntryIntent;
}): TDraft | null => {
  if (options.intent !== "mode-switch") {
    return null;
  }

  return options.currentDraft ?? options.detachedDraft ?? null;
};

export const shouldResetWorkspaceSegmentEditorConsumedSourceProject = (
  projectId: number | null | undefined,
  isConsumedSourceProject: boolean,
  alreadyResetProjectIds: ReadonlySet<number>,
) => {
  const normalizedProjectId = Number(projectId);
  if (!isConsumedSourceProject || !Number.isInteger(normalizedProjectId) || normalizedProjectId <= 0) {
    return false;
  }

  return !alreadyResetProjectIds.has(normalizedProjectId);
};

export const shouldSkipWorkspaceSegmentEditorActiveDraftReopen = (
  projectId: number | null | undefined,
  requestedSegmentIndex: number | null | undefined,
  currentRouteProjectId: number | null | undefined,
  currentRouteSegmentIndex: number | null | undefined,
  routeRestoreKey: string | null,
  handledRouteRestoreKey: string | null,
  isDraftOpenInState: boolean,
  isSegmentEditorMode: boolean,
) => {
  const normalizedProjectId = Number(projectId);
  const normalizedSegmentIndex = Number(requestedSegmentIndex ?? 0);
  if (
    !isDraftOpenInState ||
    !isSegmentEditorMode ||
    !Number.isInteger(normalizedProjectId) ||
    normalizedProjectId <= 0 ||
    !Number.isInteger(normalizedSegmentIndex) ||
    normalizedSegmentIndex < 0
  ) {
    return false;
  }

  const restoreKey = `${normalizedProjectId}:${normalizedSegmentIndex}`;
  const normalizedRouteProjectId = Number(currentRouteProjectId);
  const normalizedRouteSegmentIndex = Number(currentRouteSegmentIndex ?? 0);
  const isRequestedDraftCurrentRoute =
    Number.isInteger(normalizedRouteProjectId) &&
    normalizedRouteProjectId === normalizedProjectId &&
    Number.isInteger(normalizedRouteSegmentIndex) &&
    normalizedRouteSegmentIndex === normalizedSegmentIndex;

  return isRequestedDraftCurrentRoute || (routeRestoreKey === restoreKey && handledRouteRestoreKey === restoreKey);
};

export const buildStudioRouteUrl = (
  search: string,
  section: StudioRouteSection,
  options?: {
    mode?: StudioRouteMode | null;
    projectId?: number | null;
    projectKey?: string | null;
    segmentIndex?: number | null;
  },
) => {
  const searchParams = new URLSearchParams(search);

  if (section === "project" || section === "projects" || section === "media" || section === "edit") {
    searchParams.set("section", section);
  } else {
    searchParams.delete("section");
  }

  const normalizedProjectKey = String(options?.projectKey ?? "").trim();
  if (section === "project" && normalizedProjectKey) {
    searchParams.set("project", normalizedProjectKey.slice(0, 240));
  } else {
    searchParams.delete("project");
  }

  if (section === "edit" && typeof options?.projectId === "number" && Number.isInteger(options.projectId) && options.projectId > 0) {
    searchParams.set("projectId", String(options.projectId));
  } else {
    searchParams.delete("projectId");
  }

  if (
    section === "edit" &&
    typeof options?.segmentIndex === "number" &&
    Number.isInteger(options.segmentIndex) &&
    options.segmentIndex >= 0
  ) {
    searchParams.set("segment", String(options.segmentIndex));
  } else {
    searchParams.delete("segment");
  }

  if (section === "create" && options?.mode === "scenes") {
    searchParams.set("mode", "scenes");
  } else {
    searchParams.delete("mode");
  }

  const nextSearch = searchParams.toString();
  return nextSearch ? `/app/studio?${nextSearch}` : "/app/studio";
};
