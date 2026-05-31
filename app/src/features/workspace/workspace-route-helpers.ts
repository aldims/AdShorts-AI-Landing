import type { StudioEntryIntentSection } from "../../lib/studio-entry-intent";

export type StudioView = "create" | "projects" | "media";
export type StudioRouteMode = "idea" | "scenes";

export type StudioRouteState = {
  mode: StudioRouteMode;
  projectId: number | null;
  section: StudioEntryIntentSection;
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

  return {
    mode: mode === "scenes" ? "scenes" : "idea",
    projectId: parseStudioRouteInteger(searchParams.get("projectId")),
    section: section === "projects" || section === "media" || section === "edit" ? section : "create",
    segmentIndex: parseStudioRouteInteger(searchParams.get("segment"), { allowZero: true }),
  };
};

export const getStudioRouteSection = (search: string): StudioEntryIntentSection => {
  return getStudioRouteState(search).section;
};

export const getStudioViewFromRouteSection = (section: StudioEntryIntentSection): StudioView => {
  if (section === "projects") {
    return "projects";
  }

  if (section === "media") {
    return "media";
  }

  return "create";
};

export const shouldDeferSegmentEditorRouteRestore = (pendingSection: StudioEntryIntentSection | null) =>
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

export const buildStudioRouteUrl = (
  search: string,
  section: StudioEntryIntentSection,
  options?: { mode?: StudioRouteMode | null; projectId?: number | null; segmentIndex?: number | null },
) => {
  const searchParams = new URLSearchParams(search);

  if (section === "projects" || section === "media" || section === "edit") {
    searchParams.set("section", section);
  } else {
    searchParams.delete("section");
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
