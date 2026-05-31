import type { CSSProperties, MouseEvent as ReactMouseEvent } from "react";
import type { Locale } from "../../lib/i18n";
import {
  type WorkspaceSegmentEditorFullPreviewStatus,
  type WorkspaceSegmentTimelineAudioPreviewTrack,
  workspaceText,
} from "./workspace-page-model";
import { videoElementUsesWorkspaceSourceUrl } from "./workspace-media-probe-helpers";
import { WorkspaceSegmentPreviewCardMedia } from "./workspace-preview-components";
import {
  getWorkspaceSegmentMediaIdentityKey,
  getWorkspaceSegmentResolvedMediaSurface,
  getWorkspaceSegmentVisualDurationMeasurementUrl,
} from "./workspace-segment-draft-media-helpers";
import { normalizeWorkspaceSegmentDurationMode } from "./workspace-segment-editor";
import { formatWorkspaceSegmentEditorTime } from "./workspace-time-formatters";
import type {
  WorkspaceSegmentEditorDraftSegment,
  WorkspaceSegmentTimelineHistoryKind,
} from "./workspace-types";

export type WorkspaceSegmentTimelineAudioPlaybackStatus = "loading" | "playing" | null;

export type WorkspaceSegmentTimelineAudioButtonOptions = {
  audioKey: string;
  className?: string;
  disabledReason?: string;
  durationSeconds?: number | null;
  endTime?: number | null;
  label: string;
  mediaKind?: "audio" | "video";
  startTime?: number | null;
  tracks?: WorkspaceSegmentTimelineAudioPreviewTrack[];
  url: string | null;
};

export type WorkspaceSegmentTimelineAudioPreviewHandler = (
  event: ReactMouseEvent<HTMLButtonElement>,
  options: {
    durationSeconds?: number | null;
    endTime?: number | null;
    key: string;
    mediaKind?: "audio" | "video";
    startTime?: number | null;
    tracks?: WorkspaceSegmentTimelineAudioPreviewTrack[];
    url: string | null;
  },
) => void | Promise<void>;

export type WorkspaceSegmentTimelineHistoryButtonsOptions = {
  canBack: boolean;
  canDelete?: boolean;
  canForward: boolean;
  deleteLabel?: string;
  kind: WorkspaceSegmentTimelineHistoryKind;
  label: string;
  onDelete?: () => void;
  segmentIndex?: number | null;
  withPlay?: boolean;
};

export type WorkspaceSegmentTimelineHistoryMoveHandler = (
  kind: WorkspaceSegmentTimelineHistoryKind,
  segmentIndex?: number | null,
) => void;

export type WorkspaceSegmentEditorFullPreviewPlayheadOptions = {
  bubbleTranslate: string;
  ratio: number;
  shouldShow: boolean;
  showBubble?: boolean;
  status: WorkspaceSegmentEditorFullPreviewStatus;
  timeLabel: string;
};

export type WorkspaceSegmentTimelineBoundaryTimecodeOptions = {
  boundaryTime: number;
  className?: string;
  segment: WorkspaceSegmentEditorDraftSegment;
  segmentDisplayNumber: number;
};

export type WorkspaceSegmentTimelineSceneBackdropOptions = {
  onMeasuredVisualDuration: (segmentIndex: number, sourceUrl: string, durationSeconds: number) => void;
  segment: WorkspaceSegmentEditorDraftSegment;
};

export const renderWorkspaceSegmentTimelineAudioButton = (
  locale: Locale,
  playbackStatus: WorkspaceSegmentTimelineAudioPlaybackStatus,
  options: WorkspaceSegmentTimelineAudioButtonOptions,
  onPreview: WorkspaceSegmentTimelineAudioPreviewHandler,
) => {
  const isLoading = playbackStatus === "loading";
  const isPlaying = playbackStatus === "playing";
  const disabledReason = options.disabledReason ?? workspaceText(locale, "Превью недоступно", "Preview unavailable");
  const hasPreviewAudio = Boolean(options.url || options.tracks?.some((track) => track.url.trim()));
  const ariaLabel = !hasPreviewAudio
    ? disabledReason
    : isPlaying || isLoading
      ? workspaceText(locale, `Остановить: ${options.label}`, `Stop: ${options.label}`)
      : workspaceText(locale, `Прослушать: ${options.label}`, `Listen: ${options.label}`);

  return (
    <button
      className={`studio-segment-editor__timeline-play${isPlaying ? " is-playing" : ""}${
        isLoading ? " is-loading" : ""
      }${options.className ? ` ${options.className}` : ""}`}
      type="button"
      disabled={!hasPreviewAudio}
      aria-label={ariaLabel}
      title={ariaLabel}
      onClick={(event) =>
        void onPreview(event, {
          endTime: options.endTime,
          key: options.audioKey,
          mediaKind: options.mediaKind,
          durationSeconds: options.durationSeconds,
          startTime: options.startTime,
          tracks: options.tracks,
          url: options.url,
        })
      }
    >
      {isLoading ? (
        <span className="studio-segment-editor__timeline-play-spinner" aria-hidden="true"></span>
      ) : isPlaying ? (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <rect x="4.35" y="4.35" width="7.3" height="7.3" rx="1.55" fill="currentColor" />
        </svg>
      ) : (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M5.15 3.55v8.9L12.1 8 5.15 3.55Z" fill="currentColor" />
        </svg>
      )}
    </button>
  );
};

export const renderWorkspaceSegmentTimelineHistoryButtons = (
  locale: Locale,
  isActionDisabled: boolean,
  options: WorkspaceSegmentTimelineHistoryButtonsOptions,
  handlers: {
    onBack: WorkspaceSegmentTimelineHistoryMoveHandler;
    onForward: WorkspaceSegmentTimelineHistoryMoveHandler;
  },
) => {
  if (!options.canBack && !options.canForward && !options.canDelete) {
    return null;
  }

  const backLabel = workspaceText(locale, `Откатить: ${options.label}`, `Revert: ${options.label}`);
  const forwardLabel = workspaceText(locale, `Вернуть: ${options.label}`, `Restore: ${options.label}`);
  const deleteLabel = options.deleteLabel ?? workspaceText(locale, `Удалить: ${options.label}`, `Delete: ${options.label}`);

  return (
    <span
      className={`studio-segment-editor__timeline-history${
        options.canBack || options.canForward ? " is-history-active" : ""
      }${options.withPlay ? " studio-segment-editor__timeline-history--before-play" : ""}`}
      onClick={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
    >
      {options.canDelete && options.onDelete ? (
        <button
          className="studio-segment-editor__timeline-history-button studio-segment-editor__timeline-history-button--delete"
          type="button"
          disabled={isActionDisabled}
          aria-label={deleteLabel}
          title={deleteLabel}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            options.onDelete?.();
          }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M5 7h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <path d="M9 7V5.8A1.8 1.8 0 0 1 10.8 4h2.4A1.8 1.8 0 0 1 15 5.8V7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <path d="m9 11 .4 6M15 11l-.4 6M7.5 7l.8 12h7.4l.8-12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      ) : null}
      <button
        className="studio-segment-editor__timeline-history-button"
        type="button"
        disabled={isActionDisabled || !options.canBack}
        aria-label={backLabel}
        title={backLabel}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          handlers.onBack(options.kind, options.segmentIndex);
        }}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M10 7 5 12l5 5" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M5.5 12H19" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" />
        </svg>
      </button>
      <button
        className="studio-segment-editor__timeline-history-button"
        type="button"
        disabled={isActionDisabled || !options.canForward}
        aria-label={forwardLabel}
        title={forwardLabel}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          handlers.onForward(options.kind, options.segmentIndex);
        }}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="m14 7 5 5-5 5" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M5 12h13.5" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" />
        </svg>
      </button>
    </span>
  );
};

export const renderWorkspaceSegmentEditorFullPreviewPlayhead = (
  options: WorkspaceSegmentEditorFullPreviewPlayheadOptions,
) =>
  options.shouldShow ? (
    <span
      className={`studio-segment-editor__timeline-playhead${options.showBubble ? " has-bubble" : ""}${
        options.status === "playing" ? " is-playing" : " is-paused"
      }`}
      style={
        {
          "--studio-segment-editor-full-preview-ratio": options.ratio,
          "--studio-segment-editor-full-preview-bubble-translate": options.bubbleTranslate,
        } as CSSProperties
      }
      aria-hidden="true"
    >
      {options.showBubble ? (
        <span className="studio-segment-editor__timeline-playhead-bubble">
          {options.timeLabel}
        </span>
      ) : null}
    </span>
  ) : null;

export const renderWorkspaceSegmentTimelineBoundaryTimecode = (
  locale: Locale,
  options: WorkspaceSegmentTimelineBoundaryTimecodeOptions,
) => {
  const initialValue = formatWorkspaceSegmentEditorTime(options.boundaryTime);
  const isManualDuration = normalizeWorkspaceSegmentDurationMode(options.segment.durationMode) === "manual";
  const label = workspaceText(
    locale,
    `Конец сцены ${options.segmentDisplayNumber}`,
    `Scene ${options.segmentDisplayNumber} end time`,
  );

  return (
    <span
      className={`studio-segment-editor__timeline-timecode studio-segment-editor__timeline-timecode-boundary${
        isManualDuration ? " is-manual" : ""
      }${
        options.className ? ` ${options.className}` : ""
      }`}
      key={`timeline-boundary:${options.segment.index}:${initialValue}:${isManualDuration ? "manual" : "auto"}`}
      aria-label={label}
      title={label}
    >
      {initialValue}
    </span>
  );
};

export const renderWorkspaceSegmentTimelineSceneBackdrop = ({
  onMeasuredVisualDuration,
  segment,
}: WorkspaceSegmentTimelineSceneBackdropOptions) => {
  const mediaSurface = getWorkspaceSegmentResolvedMediaSurface(segment, "segment-thumb");
  const previewUrl = mediaSurface.displayUrl;

  return (
    <span className="studio-segment-editor__timeline-scene-backdrop" aria-hidden="true">
      {previewUrl ? (
        <WorkspaceSegmentPreviewCardMedia
          allowBrowserPosterCapture={mediaSurface.allowBrowserPosterCapture}
          allowVideoPlayback={false}
          autoplay={false}
          fallbackPosterUrl={mediaSurface.fallbackPosterUrl}
          imageLoading="lazy"
          loop={false}
          mediaKey={`timeline-scene-backdrop:${getWorkspaceSegmentMediaIdentityKey(segment, mediaSurface)}`}
          mountVideoWhenIdle={mediaSurface.mountVideoWhenIdle}
          muted
          onLoadedMetadata={(event) => {
            const element = event.currentTarget;
            const measurementUrl = getWorkspaceSegmentVisualDurationMeasurementUrl(segment);
            onMeasuredVisualDuration(
              segment.index,
              measurementUrl && videoElementUsesWorkspaceSourceUrl(element, measurementUrl)
                ? measurementUrl
                : element.currentSrc || element.src || previewUrl,
              element.duration,
            );
          }}
          posterUrl={mediaSurface.posterUrl}
          preferPosterFrame={mediaSurface.preferPosterFrame}
          preload={mediaSurface.previewKind === "video" ? mediaSurface.preloadPolicy : undefined}
          primePausedFrame={mediaSurface.primePausedFrame}
          previewFallbackUrls={mediaSurface.fallbackUrls}
          previewKind={mediaSurface.previewKind}
          previewUrl={previewUrl}
        />
      ) : (
        <span className="studio-segment-editor__timeline-scene-backdrop-placeholder"></span>
      )}
    </span>
  );
};
