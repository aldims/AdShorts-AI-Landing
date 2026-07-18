import {
  getWorkspaceSegmentEditorDisplayEndTime,
  getWorkspaceSegmentEditorDisplayStartTime,
  type WorkspaceSegmentTimelineSegment,
} from "./workspaceSegmentEditorTimeline";

export type WorkspaceSegmentEditorTrackKind = "visual" | "music" | "voice" | "sound" | "text";

export type WorkspaceSegmentEditorTrackSegment = WorkspaceSegmentTimelineSegment & {
  index: number;
  sceneSoundAsset?: unknown;
  sceneSoundAssetId?: number | null;
  scene_sound?: { media_asset_id?: number | null } | null;
  scene_sound_asset_id?: number | null;
  voiceType?: string | null;
  voice_type?: string | null;
};

export type WorkspaceSegmentEditorTrackSession = {
  customMusicAssetId?: number | null;
  customMusicFileName?: string | null;
  musicAssetId?: number | null;
  musicName?: string | null;
  musicType?: string | null;
};

export type WorkspaceSegmentEditorTrackSpan = {
  arrayIndex: number | null;
  duration: number;
  endTime: number;
  isActive: boolean;
  isEdited: boolean;
  isEmpty: boolean;
  key: string;
  kind: WorkspaceSegmentEditorTrackKind;
  leftRatio: number;
  segmentIndex: number | null;
  startTime: number;
  widthRatio: number;
};

export type WorkspaceSegmentEditorTrackRow = {
  kind: WorkspaceSegmentEditorTrackKind;
  spans: WorkspaceSegmentEditorTrackSpan[];
};

export type WorkspaceSegmentEditorTracks = {
  rows: WorkspaceSegmentEditorTrackRow[];
  segmentSpans: WorkspaceSegmentEditorTrackSpan[];
  totalDuration: number;
};

type WorkspaceSegmentEditorTracksBuildOptions<T extends WorkspaceSegmentEditorTrackSegment> = {
  activeArrayIndex?: number | null;
  isSoundPresent?: (segment: T) => boolean;
  isSoundEdited?: (segment: T, baselineSegment: T | null) => boolean;
  isTextEmpty?: (segment: T, baselineSegment: T | null, isEdited: boolean) => boolean;
  isTextEdited?: (segment: T, baselineSegment: T | null) => boolean;
  isVisualEdited?: (segment: T, baselineSegment: T | null) => boolean;
  isVoiceEdited?: (segment: T, baselineSegment: T | null) => boolean;
  suppressActiveState?: boolean;
  suppressEditedState?: boolean;
};

const normalizeTrackString = (value: unknown) => String(value ?? "").replace(/\s+/g, " ").trim();

const normalizePositiveTrackNumber = (value: unknown) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? Math.trunc(numeric) : null;
};

const buildMusicIdentity = (session?: WorkspaceSegmentEditorTrackSession | null) => {
  const musicType = normalizeTrackString(session?.musicType) || "ai";
  if (musicType !== "custom") {
    return [
      musicType,
      normalizePositiveTrackNumber(session?.musicAssetId) ?? "",
      normalizeTrackString(session?.musicName),
    ].join(":");
  }

  return [
    musicType,
    normalizePositiveTrackNumber(session?.musicAssetId) ?? "",
    normalizeTrackString(session?.musicName),
    normalizePositiveTrackNumber(session?.customMusicAssetId) ?? "",
    normalizeTrackString(session?.customMusicFileName),
  ].join(":");
};

const getSegmentSoundPresence = (segment?: WorkspaceSegmentEditorTrackSegment | null) =>
  Boolean(
    segment?.sceneSoundAsset ||
      normalizePositiveTrackNumber(segment?.sceneSoundAssetId) ||
      normalizePositiveTrackNumber(segment?.scene_sound?.media_asset_id) ||
      normalizePositiveTrackNumber(segment?.scene_sound_asset_id),
  );

const getTrackSpanRatios = (startTime: number, duration: number, totalDuration: number) => {
  if (totalDuration <= 0) {
    return {
      leftRatio: 0,
      widthRatio: 1,
    };
  }

  const safeStartTime = Math.max(0, startTime);
  const safeDuration = Math.max(0, duration);

  return {
    leftRatio: Math.min(1, safeStartTime / totalDuration),
    widthRatio: Math.min(1, safeDuration / totalDuration),
  };
};

const getEqualSegmentSpanRatios = (arrayIndex: number, segmentCount: number) => {
  const safeSegmentCount = Math.max(1, segmentCount);
  const widthRatio = 1 / safeSegmentCount;

  return {
    leftRatio: Math.min(1, Math.max(0, arrayIndex * widthRatio)),
    widthRatio,
  };
};

const createTrackSpan = (options: {
  arrayIndex: number | null;
  duration: number;
  isActive?: boolean;
  isEdited?: boolean;
  isEmpty?: boolean;
  key: string;
  kind: WorkspaceSegmentEditorTrackKind;
  leftRatio?: number;
  segmentIndex: number | null;
  startTime: number;
  totalDuration: number;
  widthRatio?: number;
}): WorkspaceSegmentEditorTrackSpan => {
  const duration = Math.max(0, options.duration);
  const endTime = options.startTime + duration;
  const ratios =
    typeof options.leftRatio === "number" && typeof options.widthRatio === "number"
      ? {
          leftRatio: Math.min(1, Math.max(0, options.leftRatio)),
          widthRatio: Math.min(1, Math.max(0, options.widthRatio)),
        }
      : getTrackSpanRatios(options.startTime, duration, options.totalDuration);

  return {
    arrayIndex: options.arrayIndex,
    duration,
    endTime,
    isActive: Boolean(options.isActive),
    isEdited: Boolean(options.isEdited),
    isEmpty: Boolean(options.isEmpty),
    key: options.key,
    kind: options.kind,
    leftRatio: ratios.leftRatio,
    segmentIndex: options.segmentIndex,
    startTime: options.startTime,
    widthRatio: ratios.widthRatio,
  };
};

export const buildWorkspaceSegmentEditorTracks = <T extends WorkspaceSegmentEditorTrackSegment>(
  segments: T[],
  baselineSegments: T[] = [],
  draftSession?: WorkspaceSegmentEditorTrackSession | null,
  baselineSession?: WorkspaceSegmentEditorTrackSession | null,
  options: WorkspaceSegmentEditorTracksBuildOptions<T> = {},
): WorkspaceSegmentEditorTracks => {
  const baselineSegmentsByIndex = new Map(baselineSegments.map((segment) => [segment.index, segment] as const));
  const shouldSuppressActiveState = Boolean(options.suppressActiveState);
  const shouldSuppressEditedState = Boolean(options.suppressEditedState);
  const segmentCount = Math.max(1, segments.length);
  const segmentTimes = segments.map((segment) => {
    const startTime = getWorkspaceSegmentEditorDisplayStartTime(segment);
    const endTime = Math.max(startTime, getWorkspaceSegmentEditorDisplayEndTime(segment));
    return {
      duration: Math.max(0, endTime - startTime),
      endTime,
      segment,
      startTime,
    };
  });
  const totalDuration = Math.max(0, ...segmentTimes.map((item) => item.endTime));

  const segmentSpans = segmentTimes.map((item, arrayIndex) => {
    const baselineSegment = baselineSegmentsByIndex.get(item.segment.index) ?? null;
    const ratios = getEqualSegmentSpanRatios(arrayIndex, segmentCount);

    return createTrackSpan({
      arrayIndex,
      duration: item.duration,
      isActive: !shouldSuppressActiveState && options.activeArrayIndex === arrayIndex,
      isEdited: !shouldSuppressEditedState && (options.isVisualEdited?.(item.segment, baselineSegment) ?? false),
      key: `visual:${item.segment.index}`,
      kind: "visual",
      leftRatio: ratios.leftRatio,
      segmentIndex: item.segment.index,
      startTime: item.startTime,
      totalDuration,
      widthRatio: ratios.widthRatio,
    });
  });

  const createSegmentRow = (
    kind: Exclude<WorkspaceSegmentEditorTrackKind, "music" | "visual">,
    getEdited: ((segment: T, baselineSegment: T | null) => boolean) | undefined,
    getEmpty: (segment: T, baselineSegment: T | null, isEdited: boolean) => boolean,
  ): WorkspaceSegmentEditorTrackRow => ({
    kind,
    spans: segmentTimes.map((item, arrayIndex) => {
      const baselineSegment = baselineSegmentsByIndex.get(item.segment.index) ?? null;
      const isEdited = !shouldSuppressEditedState && (getEdited?.(item.segment, baselineSegment) ?? false);
      const ratios = getEqualSegmentSpanRatios(arrayIndex, segmentCount);

      return createTrackSpan({
        arrayIndex,
        duration: item.duration,
        isActive: !shouldSuppressActiveState && options.activeArrayIndex === arrayIndex,
        isEdited,
        isEmpty: getEmpty(item.segment, baselineSegment, isEdited),
        key: `${kind}:${item.segment.index}`,
        kind,
        leftRatio: ratios.leftRatio,
        segmentIndex: item.segment.index,
        startTime: item.startTime,
        totalDuration,
        widthRatio: ratios.widthRatio,
      });
    }),
  });

  const musicEdited = !shouldSuppressEditedState && buildMusicIdentity(draftSession) !== buildMusicIdentity(baselineSession);
  const isMusicEmpty = normalizeTrackString(draftSession?.musicType) === "none";
  const musicRow: WorkspaceSegmentEditorTrackRow = {
    kind: "music",
    spans: [
      createTrackSpan({
        arrayIndex: null,
        duration: totalDuration,
        isEdited: musicEdited,
        isEmpty: isMusicEmpty,
        key: "music:global",
        kind: "music",
        segmentIndex: null,
        startTime: 0,
        totalDuration,
      }),
    ],
  };

  return {
    rows: [
      {
        kind: "visual",
        spans: segmentSpans,
      },
      musicRow,
      createSegmentRow("voice", options.isVoiceEdited, () => false),
      createSegmentRow("sound", options.isSoundEdited, (segment, baselineSegment, isEdited) =>
        !isEdited &&
        !(options.isSoundPresent?.(segment) ?? getSegmentSoundPresence(segment)) &&
        !(baselineSegment && (options.isSoundPresent?.(baselineSegment) ?? getSegmentSoundPresence(baselineSegment))),
      ),
      createSegmentRow(
        "text",
        options.isTextEdited,
        options.isTextEmpty ?? ((segment) => !normalizeTrackString(segment.text)),
      ),
    ],
    segmentSpans,
    totalDuration,
  };
};
