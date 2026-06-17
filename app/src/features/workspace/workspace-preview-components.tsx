import {
  memo,
  type ChangeEvent,
  type ReactNode,
  type SyntheticEvent as ReactSyntheticEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { canCapturePosterInBrowser } from "./hot-path";
import { useLocale, type Locale } from "../../lib/i18n";
import {
  getWorkspaceSegmentPausedPreviewTime,
  sanitizeWorkspaceSegmentPosterUrl,
  shouldAllowWorkspaceSegmentPreviewVideoPlayback,
} from "../../lib/workspaceSegmentPreview";
import { disposeWorkspaceDetachedVideoElement, ensureVideoElementLoading } from "./workspace-media-probe-helpers";
import {
  captureProjectPosterFrameFromVideoElement,
  captureProjectPosterOnce,
  getProjectPosterCacheValue,
  setProjectPosterCacheValue,
} from "./workspace-project-poster-helpers";
import {
  fallbackStudioSubtitleColorOption,
  fallbackStudioSubtitleStyleOption,
  getUniqueWorkspaceSegmentPreviewUrls,
  isWorkspaceSegmentDraftTextEdited,
} from "./workspace-segment-editor";
import {
  buildWorkspaceSegmentSubtitlePreviewLines,
  getStudioSubtitlePreviewStyle,
  resolveWorkspaceSegmentSubtitleCaretPositionFromTextareaPoint,
  type WorkspaceSegmentSubtitleCaretPoint,
} from "./workspace-subtitle-preview-helpers";
import { formatWorkspaceVideoPlayerTime } from "./workspace-time-formatters";
import type {
  StudioSubtitleColorOption,
  StudioSubtitleStyleOption,
  WorkspaceSegmentEditorDraftSegment,
  WorkspaceSegmentPreviewKind,
} from "./workspace-types";

const workspaceText = (locale: Locale, ru: string, en: string) => (locale === "en" ? en : ru);

type WorkspaceSegmentPreviewCardMediaProps = {
  allowBrowserPosterCapture?: boolean;
  allowVideoPlayback?: boolean;
  autoplay?: boolean;
  fallbackPosterUrl?: string | null;
  imageLoading?: "eager" | "lazy";
  isPlaybackRequested?: boolean;
  loop?: boolean;
  mediaKey: string;
  mountVideoWhenIdle?: boolean;
  muted?: boolean;
  onVideoError?: () => void;
  onVideoEnded?: () => void;
  onLoadedMetadata?: (event: ReactSyntheticEvent<HTMLVideoElement>) => void;
  onVideoTimeUpdate?: (currentTime: number) => void;
  onVideoPause?: () => void;
  onVideoPlay?: () => void;
  posterUrl?: string | null;
  preferPosterFrame?: boolean;
  preload?: "auto" | "metadata" | "none";
  primePausedFrame?: boolean;
  previewFallbackUrls?: Array<string | null | undefined>;
  previewKind: WorkspaceSegmentPreviewKind;
  previewUrl: string;
  videoRef?: (element: HTMLVideoElement | null) => void;
};

type WorkspaceSegmentSubtitleOverlayProps = {
  clipCurrentTime: number;
  compact?: boolean;
  editRequestId?: number;
  isEditable?: boolean;
  isPlaying: boolean;
  onResetText?: () => void;
  onTextChange?: (event: ChangeEvent<HTMLTextAreaElement>) => void;
  segment: WorkspaceSegmentEditorDraftSegment;
  segmentNumber: number;
  subtitleColorId: StudioSubtitleColorOption["id"];
  subtitleColorOptions: StudioSubtitleColorOption[];
  subtitleStyleId: StudioSubtitleStyleOption["id"];
  subtitleStyleOptions: StudioSubtitleStyleOption[];
};

export const WorkspaceSegmentPreviewCardMedia = memo(function WorkspaceSegmentPreviewCardMedia({
  allowBrowserPosterCapture = false,
  allowVideoPlayback = true,
  autoplay = false,
  fallbackPosterUrl,
  imageLoading = "eager",
  isPlaybackRequested = false,
  loop,
  mediaKey,
  mountVideoWhenIdle = false,
  muted = true,
  onVideoError,
  onVideoEnded,
  onLoadedMetadata,
  onVideoTimeUpdate,
  onVideoPause,
  onVideoPlay,
  posterUrl,
  preferPosterFrame = false,
  preload = "metadata",
  primePausedFrame = false,
  previewFallbackUrls = [],
  previewKind,
  previewUrl,
  videoRef,
}: WorkspaceSegmentPreviewCardMediaProps) {
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const [isPreferredPosterReady, setIsPreferredPosterReady] = useState(false);
  const [isPosterFrameLoadFailed, setIsPosterFrameLoadFailed] = useState(false);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);
  const [hasPresentedVideoFrame, setHasPresentedVideoFrame] = useState(false);
  const [isImageLoadFailed, setIsImageLoadFailed] = useState(false);
  const [previewCandidateIndex, setPreviewCandidateIndex] = useState(0);
  const [imageCandidateIndex, setImageCandidateIndex] = useState(0);
  const normalizedPreviewUrl = previewUrl.trim();
  const normalizedPosterUrl = sanitizeWorkspaceSegmentPosterUrl(previewKind, normalizedPreviewUrl, posterUrl);
  const normalizedFallbackPosterUrl = sanitizeWorkspaceSegmentPosterUrl(previewKind, normalizedPreviewUrl, fallbackPosterUrl);
  const normalizedPreviewFallbackUrls = useMemo(
    () => getUniqueWorkspaceSegmentPreviewUrls(previewFallbackUrls),
    [previewFallbackUrls],
  );
  const previewFallbackSignature = normalizedPreviewFallbackUrls.join("|");
  const previewCandidateUrls = useMemo(
    () => getUniqueWorkspaceSegmentPreviewUrls([normalizedPreviewUrl, ...normalizedPreviewFallbackUrls]),
    [normalizedPreviewFallbackUrls, normalizedPreviewUrl],
  );
  const resolvedPreviewUrl = previewCandidateUrls[previewCandidateIndex] ?? normalizedPreviewUrl;
  const segmentPreviewPosterCacheKey = `${resolvedPreviewUrl}::segment-preview-poster:v3-late-frame`;
  const [capturedPosterUrl, setCapturedPosterUrl] = useState<string | null>(() =>
    allowBrowserPosterCapture && canCapturePosterInBrowser(resolvedPreviewUrl)
      ? getProjectPosterCacheValue(segmentPreviewPosterCacheKey)
      : null,
  );
  const resolvedPosterUrl =
    (isPreferredPosterReady ? normalizedPosterUrl : normalizedFallbackPosterUrl || normalizedPosterUrl) ||
    capturedPosterUrl;
  const canUseResolvedPosterFrame = Boolean(resolvedPosterUrl) && !isPosterFrameLoadFailed;
  const shouldAllowVideoPlayback = shouldAllowWorkspaceSegmentPreviewVideoPlayback({
    allowVideoPlayback,
    autoplay,
    isPlaybackRequested,
    previewKind,
  });
  const hasPosterCaptureBlockingSource =
    Boolean(normalizedPosterUrl || normalizedFallbackPosterUrl) && !isPosterFrameLoadFailed;
  const canMountVideoForPosterCapture =
    previewKind === "video" &&
    allowBrowserPosterCapture &&
    (mountVideoWhenIdle || isPosterFrameLoadFailed) &&
    canCapturePosterInBrowser(resolvedPreviewUrl);
  const effectiveMountVideoWhenIdle =
    (allowVideoPlayback && mountVideoWhenIdle) || canMountVideoForPosterCapture;
  const shouldPrimePausedFrame =
    previewKind === "video" &&
    (allowVideoPlayback || canMountVideoForPosterCapture) &&
    !autoplay &&
    !hasPresentedVideoFrame &&
    (primePausedFrame || (preferPosterFrame && !canUseResolvedPosterFrame));
  const shouldKeepVideoUnmountedWhileIdle =
    previewKind === "video" && !shouldAllowVideoPlayback && !effectiveMountVideoWhenIdle;
  const effectivePreload =
    previewKind === "video" && canMountVideoForPosterCapture && preload === "none" ? "metadata" : preload;
  const shouldMaskIdleVideoUntilPoster =
    previewKind === "video" &&
    !shouldAllowVideoPlayback &&
    !isVideoPlaying &&
    !hasPresentedVideoFrame &&
    preferPosterFrame &&
    !canUseResolvedPosterFrame;
  const imageCandidateUrls = useMemo(
    () =>
      getUniqueWorkspaceSegmentPreviewUrls([
        preferPosterFrame && canUseResolvedPosterFrame ? resolvedPosterUrl : null,
        ...previewCandidateUrls,
        preferPosterFrame ? null : canUseResolvedPosterFrame ? resolvedPosterUrl : null,
      ]),
    [canUseResolvedPosterFrame, preferPosterFrame, previewCandidateUrls, resolvedPosterUrl],
  );
  const imageCandidateSignature = imageCandidateUrls.join("|");
  const resolvedImageUrl = imageCandidateUrls[imageCandidateIndex] ?? resolvedPreviewUrl;

  const setVideoElementRef = useCallback(
    (element: HTMLVideoElement | null) => {
      const previousElement = localVideoRef.current;
      if (previousElement && previousElement !== element) {
        window.setTimeout(() => {
          if (localVideoRef.current !== previousElement && !previousElement.isConnected) {
            disposeWorkspaceDetachedVideoElement(previousElement);
          }
        }, 0);
      }

      localVideoRef.current = element;
      videoRef?.(element);
    },
    [videoRef],
  );

  const cacheMountedVideoPosterFrame = useCallback(
    (element: HTMLVideoElement | null) => {
      if (
        !element ||
        previewKind !== "video" ||
        !allowBrowserPosterCapture ||
        hasPosterCaptureBlockingSource ||
        !canCapturePosterInBrowser(resolvedPreviewUrl)
      ) {
        return;
      }

      const isPrimedPreviewFrame =
        !shouldPrimePausedFrame ||
        element.dataset.previewPrimed === "true" ||
        element.currentTime > 0.05;
      if (!isPrimedPreviewFrame) {
        return;
      }

      const cachedPoster = captureProjectPosterFrameFromVideoElement(element);
      if (!cachedPoster) {
        return;
      }

      setProjectPosterCacheValue(segmentPreviewPosterCacheKey, cachedPoster);
      setCapturedPosterUrl((current) => (shouldPrimePausedFrame ? cachedPoster : current ?? cachedPoster));
    },
    [
      hasPosterCaptureBlockingSource,
      allowBrowserPosterCapture,
      previewKind,
      resolvedPreviewUrl,
      segmentPreviewPosterCacheKey,
      shouldPrimePausedFrame,
    ],
  );

  const advancePreviewCandidate = useCallback(() => {
    if (previewCandidateIndex >= previewCandidateUrls.length - 1) {
      return false;
    }

    setPreviewCandidateIndex((current) => Math.min(current + 1, previewCandidateUrls.length - 1));
    return true;
  }, [previewCandidateIndex, previewCandidateUrls.length]);

  const advanceImageCandidate = useCallback(() => {
    if (imageCandidateIndex >= imageCandidateUrls.length - 1) {
      return false;
    }

    setImageCandidateIndex((current) => Math.min(current + 1, imageCandidateUrls.length - 1));
    return true;
  }, [imageCandidateIndex, imageCandidateUrls.length]);

  useEffect(() => {
    const cachedPoster =
      allowBrowserPosterCapture && canCapturePosterInBrowser(resolvedPreviewUrl)
        ? getProjectPosterCacheValue(segmentPreviewPosterCacheKey)
        : null;
    setCapturedPosterUrl(cachedPoster);
  }, [allowBrowserPosterCapture, resolvedPreviewUrl, segmentPreviewPosterCacheKey]);

  useEffect(() => {
    setIsPosterFrameLoadFailed(false);
  }, [normalizedFallbackPosterUrl, normalizedPosterUrl, resolvedPreviewUrl]);

  useEffect(() => {
    setIsVideoPlaying(false);
    setHasPresentedVideoFrame(false);
  }, [mediaKey, resolvedPreviewUrl]);

  useEffect(() => {
    if (previewKind !== "video") {
      return;
    }

    const element = localVideoRef.current;
    if (!element) {
      return;
    }

    element.muted = muted;
    element.defaultMuted = muted;
  }, [mediaKey, muted, previewKind, resolvedPreviewUrl, shouldAllowVideoPlayback]);

  useEffect(() => {
    if (previewKind !== "video" || shouldAllowVideoPlayback) {
      return;
    }

    const element = localVideoRef.current;
    if (!element) {
      return;
    }

    element.pause();
    element.muted = true;
    element.defaultMuted = true;
  }, [mediaKey, previewKind, resolvedPreviewUrl, shouldAllowVideoPlayback]);

  useEffect(() => {
    if (previewKind !== "video" || !isPlaybackRequested || effectivePreload === "none") {
      return;
    }

    const element = localVideoRef.current;
    if (!element) {
      return;
    }

    delete element.dataset.previewPrimed;
    ensureVideoElementLoading(element, HTMLMediaElement.HAVE_CURRENT_DATA);
  }, [effectivePreload, isPlaybackRequested, previewKind, resolvedPreviewUrl]);

  useEffect(() => {
    setPreviewCandidateIndex(0);
  }, [mediaKey, normalizedPreviewUrl, previewFallbackSignature, previewKind]);

  useEffect(() => {
    setImageCandidateIndex(0);
    setIsImageLoadFailed(false);
  }, [imageCandidateSignature, mediaKey, previewKind]);

  useEffect(() => {
    if (!normalizedPosterUrl) {
      setIsPreferredPosterReady(false);
      return;
    }

    if (!normalizedFallbackPosterUrl || normalizedFallbackPosterUrl === normalizedPosterUrl) {
      setIsPreferredPosterReady(true);
      return;
    }

    let cancelled = false;
    const image = new Image();

    image.onload = () => {
      if (!cancelled) {
        setIsPreferredPosterReady(true);
      }
    };

    image.onerror = () => {
      if (!cancelled) {
        setIsPreferredPosterReady(false);
      }
    };

    setIsPreferredPosterReady(false);
    image.src = normalizedPosterUrl;

    return () => {
      cancelled = true;
      image.onload = null;
      image.onerror = null;
    };
  }, [normalizedFallbackPosterUrl, normalizedPosterUrl]);

  useEffect(() => {
    if (
      previewKind !== "video" ||
      hasPosterCaptureBlockingSource ||
      !allowBrowserPosterCapture ||
      autoplay ||
      isPlaybackRequested ||
      isVideoPlaying ||
      !canCapturePosterInBrowser(resolvedPreviewUrl)
    ) {
      return;
    }

    let cancelled = false;
    // Capture a stable preview frame for idle cards and thumbnails so a black
    // first frame does not become the visible preview.
    void captureProjectPosterOnce(resolvedPreviewUrl, {
      cacheKey: segmentPreviewPosterCacheKey,
      useSegmentPreviewTime: true,
    })
      .then((nextPosterUrl) => {
        if (!cancelled) {
          setCapturedPosterUrl(nextPosterUrl);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCapturedPosterUrl(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [
    hasPosterCaptureBlockingSource,
    allowBrowserPosterCapture,
    autoplay,
    isPlaybackRequested,
    isVideoPlaying,
    preload,
    previewKind,
    resolvedPreviewUrl,
    segmentPreviewPosterCacheKey,
  ]);

  useEffect(() => {
    if (
      previewKind !== "video" ||
      autoplay ||
      effectivePreload === "none" ||
      !shouldPrimePausedFrame ||
      isPlaybackRequested ||
      isVideoPlaying
    ) {
      return;
    }

    const element = localVideoRef.current;
    if (!element) {
      return;
    }

    let cancelled = false;

    const primePausedPreviewFrame = () => {
      if (cancelled || localVideoRef.current !== element || !element.paused || element.ended || element.readyState < 2) {
        return;
      }

      const duration = typeof element.duration === "number" && Number.isFinite(element.duration) ? Math.max(0, element.duration) : 0;
      const previewFrameTime = getWorkspaceSegmentPausedPreviewTime(duration);

      try {
        if (Math.abs(element.currentTime - previewFrameTime) > 0.02) {
          element.currentTime = previewFrameTime;
        }
        element.dataset.previewPrimed = "true";
      } catch {
        // Ignore seek errors while the browser is still finalizing the buffered range.
      }
    };

    if (element.readyState >= 2) {
      primePausedPreviewFrame();
      return;
    }

    const handleLoadedData = () => {
      primePausedPreviewFrame();
    };

    element.addEventListener("loadeddata", handleLoadedData, { once: true });
    ensureVideoElementLoading(element, HTMLMediaElement.HAVE_CURRENT_DATA);

    return () => {
      cancelled = true;
      element.removeEventListener("loadeddata", handleLoadedData);
    };
  }, [
    autoplay,
    effectivePreload,
    hasPresentedVideoFrame,
    isPlaybackRequested,
    isVideoPlaying,
    previewKind,
    resolvedPreviewUrl,
    shouldPrimePausedFrame,
  ]);

  if (previewKind === "image") {
    if (isImageLoadFailed) {
      return <div className="studio-segment-preview-card-media__idle-placeholder" aria-hidden="true" />;
    }

    return (
      <img
        key={`${mediaKey}:${resolvedImageUrl}`}
        src={resolvedImageUrl}
        alt=""
        loading={imageLoading}
        decoding="async"
        draggable={false}
        onError={() => {
          if (!advanceImageCandidate()) {
            setIsImageLoadFailed(true);
          }
        }}
      />
    );
  }

  if (shouldKeepVideoUnmountedWhileIdle && preferPosterFrame && canUseResolvedPosterFrame && resolvedPosterUrl) {
    return (
      <img
        key={`${mediaKey}:poster`}
        src={resolvedPosterUrl}
        alt=""
        loading={imageLoading}
        decoding="async"
        draggable={false}
        aria-hidden="true"
        onError={() => {
          setIsPosterFrameLoadFailed(true);
        }}
      />
    );
  }

  if (shouldKeepVideoUnmountedWhileIdle) {
    if (canUseResolvedPosterFrame && resolvedPosterUrl) {
      return (
        <img
          key={`${mediaKey}:poster`}
          src={resolvedPosterUrl}
          alt=""
          loading={imageLoading}
          decoding="async"
          draggable={false}
          aria-hidden="true"
          onError={() => {
            setIsPosterFrameLoadFailed(true);
          }}
        />
      );
    }

    return <div className="studio-segment-preview-card-media__idle-placeholder" aria-hidden="true" />;
  }

  return (
    <>
      <video
        className={shouldMaskIdleVideoUntilPoster ? "studio-segment-preview-card-media__video is-poster-pending" : undefined}
        key={`${mediaKey}:${resolvedPreviewUrl}`}
        ref={setVideoElementRef}
        src={resolvedPreviewUrl}
        autoPlay={autoplay && shouldAllowVideoPlayback}
        loop={loop ?? autoplay}
        muted={muted}
        poster={canUseResolvedPosterFrame ? resolvedPosterUrl ?? undefined : undefined}
        playsInline
        preload={effectivePreload}
        disablePictureInPicture
        disableRemotePlayback
        draggable={false}
        tabIndex={-1}
        aria-hidden="true"
        onContextMenu={(event) => event.preventDefault()}
        onError={() => {
          setIsVideoPlaying(false);
          if (advancePreviewCandidate()) {
            return;
          }
          onVideoError?.();
        }}
        onEnded={() => {
          setIsVideoPlaying(false);
          onVideoEnded?.();
        }}
        onLoadedData={(event) => {
          cacheMountedVideoPosterFrame(event.currentTarget);
        }}
        onLoadedMetadata={(event) => {
          onVideoTimeUpdate?.(event.currentTarget.currentTime);
          onLoadedMetadata?.(event);
        }}
        onPause={(event) => {
          setIsVideoPlaying(false);
          if (hasPresentedVideoFrame) {
            delete event.currentTarget.dataset.previewPrimed;
          }
          onVideoPause?.();
        }}
        onPlay={(event) => {
          if (!shouldAllowVideoPlayback) {
            event.currentTarget.pause();
            setIsVideoPlaying(false);
            return;
          }

          setIsVideoPlaying(true);
          setHasPresentedVideoFrame(true);
          onVideoPlay?.();
        }}
        onSeeked={(event) => {
          cacheMountedVideoPosterFrame(event.currentTarget);
        }}
        onTimeUpdate={(event) => onVideoTimeUpdate?.(event.currentTarget.currentTime)}
      />
      {shouldMaskIdleVideoUntilPoster ? (
        <div
          className="studio-segment-preview-card-media__idle-placeholder studio-segment-preview-card-media__idle-placeholder--overlay"
          aria-hidden="true"
        />
      ) : null}
      {canUseResolvedPosterFrame && resolvedPosterUrl && !isVideoPlaying && !hasPresentedVideoFrame ? (
        <img
          className="studio-segment-preview-card-media__poster"
          src={resolvedPosterUrl}
          alt=""
          loading={imageLoading}
          decoding="async"
          draggable={false}
          aria-hidden="true"
          onError={() => {
            setIsPosterFrameLoadFailed(true);
          }}
        />
      ) : null}
    </>
  );
});

type WorkspaceModalVideoPlayerProps = {
  autoPlay?: boolean;
  errorOverlay?: ReactNode;
  fitMode?: "contain" | "cover";
  onCanPlay?: (event: ReactSyntheticEvent<HTMLVideoElement>) => void;
  onError?: (event: ReactSyntheticEvent<HTMLVideoElement>) => void;
  onLoadedData?: (event: ReactSyntheticEvent<HTMLVideoElement>) => void;
  onLoadedMetadata?: (event: ReactSyntheticEvent<HTMLVideoElement>) => void;
  onPause?: (event: ReactSyntheticEvent<HTMLVideoElement>) => void;
  onPlay?: (event: ReactSyntheticEvent<HTMLVideoElement>) => void;
  poster?: string | null;
  preload?: "auto" | "metadata" | "none";
  preferMutedAutoplay?: boolean;
  src: string;
  topActions?: ReactNode;
  uiRevealMode?: "always" | "hover";
  videoKey: string;
  videoRef?: (element: HTMLVideoElement | null) => void;
  volume?: number;
  onVolumeChange?: (nextVolume: number) => void;
};

const clampWorkspaceModalPlayerVolume = (value: number) => {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.min(1, Math.max(0, value));
};

const playWorkspaceModalVideoElement = async (element: HTMLVideoElement | null, volume: number) => {
  if (!element) {
    return { muted: volume <= 0, played: false };
  }

  const safeVolume = clampWorkspaceModalPlayerVolume(volume);
  element.volume = safeVolume;
  element.muted = safeVolume <= 0;
  element.defaultMuted = safeVolume <= 0;

  try {
    await element.play();
    return { muted: element.muted, played: true };
  } catch {
    element.muted = true;
    element.defaultMuted = true;
  }

  try {
    await element.play();
    return { muted: true, played: true };
  } catch {
    element.pause();
    return { muted: element.muted, played: false };
  }
};

export function WorkspaceModalVideoPlayer({
  autoPlay = false,
  errorOverlay,
  fitMode = "contain",
  onCanPlay,
  onError,
  onLoadedData,
  onLoadedMetadata,
  onPause,
  onPlay,
  poster,
  preload = "metadata",
  preferMutedAutoplay = false,
  src,
  topActions,
  uiRevealMode = "always",
  videoKey,
  videoRef,
  volume = 0.88,
  onVolumeChange,
}: WorkspaceModalVideoPlayerProps) {
  const { locale } = useLocale();
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const lastNonZeroVolumeRef = useRef(Math.max(0.2, clampWorkspaceModalPlayerVolume(volume)));
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(autoPlay);
  const shouldPreferMutedAutoplay = autoPlay && preferMutedAutoplay;
  const [isActuallyMuted, setIsActuallyMuted] = useState(shouldPreferMutedAutoplay || clampWorkspaceModalPlayerVolume(volume) <= 0);
  const safeVolume = clampWorkspaceModalPlayerVolume(volume);
  const progressValue = duration > 0 ? Math.min(1000, Math.max(0, Math.round((currentTime / duration) * 1000))) : 0;
  const shouldRevealUiOnHover = uiRevealMode === "hover" || isPlaying;

  const assignVideoRef = useCallback(
    (element: HTMLVideoElement | null) => {
      localVideoRef.current = element;
      videoRef?.(element);
    },
    [videoRef],
  );

  const updateVolume = useCallback(
    (nextVolume: number) => {
      const safeNextVolume = clampWorkspaceModalPlayerVolume(nextVolume);
      if (safeNextVolume > 0) {
        lastNonZeroVolumeRef.current = safeNextVolume;
      }
      setIsActuallyMuted(safeNextVolume <= 0);
      onVolumeChange?.(safeNextVolume);
    },
    [onVolumeChange],
  );

  const attemptPlayback = useCallback(async () => {
    const element = localVideoRef.current;
    if (!element) {
      return;
    }

    const result = await playWorkspaceModalVideoElement(element, shouldPreferMutedAutoplay ? 0 : safeVolume);
    setIsActuallyMuted(result.muted);
  }, [safeVolume, shouldPreferMutedAutoplay]);

  useEffect(() => {
    setCurrentTime(0);
    setDuration(0);
    setIsPlaying(autoPlay);
    setIsActuallyMuted(shouldPreferMutedAutoplay || safeVolume <= 0);
  }, [autoPlay, shouldPreferMutedAutoplay, videoKey]);

  useEffect(() => {
    const element = localVideoRef.current;
    if (!element) {
      return;
    }

    element.volume = safeVolume;
    if (safeVolume <= 0) {
      element.muted = true;
      element.defaultMuted = true;
      setIsActuallyMuted(true);
      return;
    }

    if (!isActuallyMuted) {
      element.muted = false;
      element.defaultMuted = false;
    }
  }, [isActuallyMuted, safeVolume]);

  const handleTogglePlayback = useCallback(() => {
    const element = localVideoRef.current;
    if (!element) {
      return;
    }

    if (element.paused) {
      void attemptPlayback();
      return;
    }

    element.pause();
  }, [attemptPlayback]);

  const handleToggleMute = useCallback(() => {
    if (safeVolume <= 0 || isActuallyMuted) {
      const nextVolume = Math.max(0.2, lastNonZeroVolumeRef.current);
      updateVolume(nextVolume);
      const element = localVideoRef.current;
      if (element) {
        element.volume = nextVolume;
        element.muted = false;
        element.defaultMuted = false;
      }
      return;
    }

    updateVolume(0);
  }, [isActuallyMuted, safeVolume, updateVolume]);

  const handleSeek = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const element = localVideoRef.current;
      if (!element || duration <= 0) {
        return;
      }

      const nextValue = Number(event.target.value);
      const nextTime = (Math.min(1000, Math.max(0, nextValue)) / 1000) * duration;
      try {
        element.currentTime = nextTime;
        setCurrentTime(nextTime);
      } catch {
        // Ignore seek errors while metadata is still being resolved.
      }
    },
    [duration],
  );

  return (
    <div
      className={`studio-video-modal__player is-video${fitMode === "cover" ? " is-cover-media" : ""}${
        shouldRevealUiOnHover ? " is-hover-ui" : ""
      }${isPlaying ? " is-playing" : ""}`}
    >
      <div className="studio-video-modal__player-stage" onClick={handleTogglePlayback}>
        <video
          key={videoKey}
          ref={assignVideoRef}
          src={src}
          autoPlay={autoPlay}
          playsInline
          preload={preload}
          poster={poster ?? undefined}
          muted={isActuallyMuted || shouldPreferMutedAutoplay}
          controls={false}
          onCanPlay={(event) => {
            const element = event.currentTarget;
            const nextDuration =
              typeof element.duration === "number" && Number.isFinite(element.duration) ? Math.max(0, element.duration) : 0;
            setDuration(nextDuration);
            if (autoPlay && element.paused) {
              void attemptPlayback();
            }
            onCanPlay?.(event);
          }}
          onClick={(event) => {
            event.stopPropagation();
            handleTogglePlayback();
          }}
          onLoadedData={(event) => {
            const element = event.currentTarget;
            setCurrentTime(Number.isFinite(element.currentTime) ? Math.max(0, element.currentTime) : 0);
            setDuration(Number.isFinite(element.duration) ? Math.max(0, element.duration) : 0);
            onLoadedData?.(event);
          }}
          onLoadedMetadata={(event) => {
            const element = event.currentTarget;
            setDuration(Number.isFinite(element.duration) ? Math.max(0, element.duration) : 0);
            onLoadedMetadata?.(event);
          }}
          onPause={(event) => {
            setIsPlaying(false);
            onPause?.(event);
          }}
          onPlay={(event) => {
            setIsPlaying(true);
            setIsActuallyMuted(event.currentTarget.muted);
            onPlay?.(event);
          }}
          onTimeUpdate={(event) => {
            setCurrentTime(Number.isFinite(event.currentTarget.currentTime) ? Math.max(0, event.currentTarget.currentTime) : 0);
          }}
          onEnded={(event) => {
            const element = event.currentTarget;
            if (element) {
              try {
                element.currentTime = 0;
              } catch {
                // Ignore seek errors if the browser has already detached media data.
              }
            }
            setCurrentTime(0);
            setIsPlaying(false);
          }}
          onVolumeChange={(event) => {
            setIsActuallyMuted(event.currentTarget.muted || event.currentTarget.volume <= 0);
          }}
          onError={(event) => {
            setIsPlaying(false);
            onError?.(event);
          }}
        />
      </div>
      {topActions ? <div className="studio-video-modal__top-actions">{topActions}</div> : null}
      {errorOverlay}
      <div className="studio-video-modal__player-controls">
        <input
          className="studio-video-modal__progress"
          type="range"
          min={0}
          max={1000}
          step={1}
          value={progressValue}
          aria-label={workspaceText(locale, "Позиция воспроизведения", "Playback position")}
          onChange={handleSeek}
        />
        <div className="studio-video-modal__player-toolbar">
          <button
            className="studio-video-modal__control-btn"
            type="button"
            aria-label={isPlaying ? workspaceText(locale, "Пауза", "Pause") : workspaceText(locale, "Воспроизвести", "Play")}
            onClick={handleTogglePlayback}
          >
            {isPlaying ? (
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <rect x="5" y="4.25" width="3.25" height="11.5" rx="1.2" fill="currentColor" />
                <rect x="11.75" y="4.25" width="3.25" height="11.5" rx="1.2" fill="currentColor" />
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <path d="M7 5.25v9.5l7.5-4.75L7 5.25Z" fill="currentColor" />
              </svg>
            )}
          </button>
          <button
            className="studio-video-modal__control-btn"
            type="button"
            aria-label={
              isActuallyMuted || safeVolume <= 0
                ? workspaceText(locale, "Включить звук", "Unmute")
                : workspaceText(locale, "Выключить звук", "Mute")
            }
            onClick={handleToggleMute}
          >
            {isActuallyMuted || safeVolume <= 0 ? (
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <path d="M4.5 7.5H7.5L11 4.5V15.5L7.5 12.5H4.5V7.5Z" fill="currentColor" />
                <path d="M13.25 7 16.75 13M16.75 7 13.25 13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <path d="M4.5 7.5H7.5L11 4.5V15.5L7.5 12.5H4.5V7.5Z" fill="currentColor" />
                <path d="M13.4 7.2a4 4 0 0 1 0 5.6M15.7 5a7 7 0 0 1 0 10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            )}
          </button>
          <span className="studio-video-modal__time">
            {formatWorkspaceVideoPlayerTime(currentTime)} / {formatWorkspaceVideoPlayerTime(duration, "duration")}
          </span>
        </div>
      </div>
    </div>
  );
}

export function WorkspaceSegmentSubtitleOverlay({
  clipCurrentTime,
  compact = false,
  editRequestId = 0,
  isEditable = false,
  isPlaying,
  onResetText,
  onTextChange,
  segment,
  segmentNumber,
  subtitleColorId,
  subtitleColorOptions,
  subtitleStyleId,
  subtitleStyleOptions,
}: WorkspaceSegmentSubtitleOverlayProps) {
  const { locale } = useLocale();
  const [isEditingText, setIsEditingText] = useState(false);
  const pendingCaretPointRef = useRef<WorkspaceSegmentSubtitleCaretPoint | null>(null);
  const subtitleTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const safeStyleOptions = subtitleStyleOptions.length ? subtitleStyleOptions : [fallbackStudioSubtitleStyleOption];
  const safeColorOptions = subtitleColorOptions.length ? subtitleColorOptions : [fallbackStudioSubtitleColorOption];
  const selectedStyle = safeStyleOptions.find((style) => style.id === subtitleStyleId) ?? safeStyleOptions[0];
  const selectedColor = safeColorOptions.find((color) => color.id === subtitleColorId) ?? safeColorOptions[0];
  const isEdited = isWorkspaceSegmentDraftTextEdited(segment);
  const previewStyle = getStudioSubtitlePreviewStyle(selectedStyle, selectedColor);
  const previewLines = buildWorkspaceSegmentSubtitlePreviewLines({
    clipCurrentTime,
    isPlaying,
    segment,
    style: selectedStyle,
  });
  const isInlineEditorVisible = isEditable && Boolean(onTextChange);
  const shouldShowInlineEditor = isInlineEditorVisible && isEditingText;

  useEffect(() => {
    if (!isInlineEditorVisible) {
      pendingCaretPointRef.current = null;
      setIsEditingText(false);
    }
  }, [isInlineEditorVisible]);

  useEffect(() => {
    pendingCaretPointRef.current = null;
    setIsEditingText(false);
  }, [segment.index]);

  useEffect(() => {
    if (!isInlineEditorVisible || editRequestId <= 0) {
      return;
    }

    pendingCaretPointRef.current = null;
    setIsEditingText(true);
  }, [editRequestId, isInlineEditorVisible]);

  useEffect(() => {
    if (!shouldShowInlineEditor) {
      return;
    }

    const nextFrameId = window.requestAnimationFrame(() => {
      const element = subtitleTextareaRef.current;
      if (!element) {
        return;
      }

      element.focus();
      const textLength = element.value.length;
      const pendingCaretPoint = pendingCaretPointRef.current;
      pendingCaretPointRef.current = null;
      const nextCaretPosition =
        pendingCaretPoint
          ? resolveWorkspaceSegmentSubtitleCaretPositionFromTextareaPoint({
              ...pendingCaretPoint,
              textarea: element,
            })
          : textLength;
      try {
        const boundedCaretPosition = Math.max(0, Math.min(textLength, nextCaretPosition));
        element.setSelectionRange(boundedCaretPosition, boundedCaretPosition);
      } catch {
        // Ignore selection errors on unsupported inputs.
      }
    });

    return () => window.cancelAnimationFrame(nextFrameId);
  }, [shouldShowInlineEditor]);

  if (previewLines.length === 0 && !isInlineEditorVisible) {
    return null;
  }

  return (
    <div
      className={`studio-segment-editor__subtitle${compact ? " is-compact" : ""}${isEdited ? " is-edited" : ""}${
        shouldShowInlineEditor ? " is-editing" : ""
      }`}
      style={previewStyle}
      aria-hidden={isInlineEditorVisible || isEdited ? undefined : true}
    >
      <div className="studio-segment-editor__subtitle-backdrop"></div>
      <div className="studio-segment-editor__subtitle-shell">
        {isEdited ? (
          <div className="studio-segment-editor__subtitle-meta">
            <span className="studio-segment-editor__subtitle-meta-spacer" aria-hidden="true"></span>
            <span className="studio-segment-editor__subtitle-status">{workspaceText(locale, "Текст изменен", "Text changed")}</span>
            {onResetText ? (
              <button
                className="studio-segment-editor__subtitle-reset"
                type="button"
                aria-label={workspaceText(locale, "Сбросить текст сегмента", "Reset segment text")}
                title={workspaceText(locale, "Сбросить текст сегмента", "Reset segment text")}
                onMouseDown={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                }}
                onPointerDown={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                }}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  onResetText();
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path
                    d="M20 11a8 8 0 1 1-2.34-5.66L20 8"
                    stroke="currentColor"
                    strokeWidth="1.9"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M20 4v4h-4"
                    stroke="currentColor"
                    strokeWidth="1.9"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            ) : null}
          </div>
        ) : null}
        {isInlineEditorVisible && !shouldShowInlineEditor ? (
          <div className="studio-segment-editor__subtitle-edit-hint" aria-hidden="true">
            <span className="studio-segment-editor__subtitle-edit-hint-icon">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M12 20h9"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M16.5 3.5a2.12 2.12 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5Z"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
          </div>
        ) : null}
        {shouldShowInlineEditor ? (
          <div
            className="studio-segment-editor__subtitle-caption-edit-shell"
            onClick={(event) => {
              event.stopPropagation();
            }}
            onMouseDown={(event) => {
              event.stopPropagation();
            }}
            onPointerDown={(event) => {
              event.stopPropagation();
            }}
          >
            <div
              className="studio-subtitle-selector__example-caption studio-segment-editor__subtitle-caption-preview is-editing"
              data-logic={selectedStyle.logicMode}
              data-style={selectedStyle.id}
            >
              <textarea
                ref={subtitleTextareaRef}
                className="studio-segment-editor__textarea studio-segment-editor__subtitle-caption-textarea"
                value={segment.text}
                onChange={onTextChange}
                rows={4}
                placeholder={workspaceText(locale, "Введите текст сегмента", "Enter segment text")}
                aria-label={workspaceText(locale, `Текст сегмента ${segmentNumber}`, `Segment ${segmentNumber} text`)}
                onBlur={() => {
                  setIsEditingText(false);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    event.stopPropagation();
                    setIsEditingText(false);
                    event.currentTarget.blur();
                    return;
                  }

                  if (event.key === "Escape") {
                    event.preventDefault();
                    event.stopPropagation();
                    setIsEditingText(false);
                    event.currentTarget.blur();
                  }
                }}
              />
            </div>
          </div>
        ) : previewLines.length > 0 || isInlineEditorVisible ? (
          isInlineEditorVisible ? (
            <button
              className="studio-subtitle-selector__example-caption studio-segment-editor__subtitle-caption-trigger"
              type="button"
              data-logic={selectedStyle.logicMode}
              data-style={selectedStyle.id}
              aria-label={workspaceText(locale, `Редактировать текст сегмента ${segmentNumber}`, `Edit segment ${segmentNumber} text`)}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                pendingCaretPointRef.current =
                  event.detail > 0
                    ? {
                        clientX: event.clientX,
                        clientY: event.clientY,
                      }
                    : null;
                setIsEditingText(true);
              }}
              onPointerDown={(event) => {
                event.stopPropagation();
              }}
            >
              {previewLines.length > 0 ? (
                previewLines.map((line, lineIndex) => (
                  <span
                    key={`${segment.index}-subtitle-line-${lineIndex}`}
                    className="studio-subtitle-selector__example-line"
                  >
                    {line.map((word, wordIndex) => (
                      <span
                        key={`${segment.index}-subtitle-word-${lineIndex}-${wordIndex}`}
                        className={`studio-subtitle-selector__example-word is-${word.state}`}
                      >
                        {word.text}
                      </span>
                    ))}
                  </span>
                ))
              ) : (
                <span className="studio-segment-editor__subtitle-empty">
                  {workspaceText(locale, "Нажмите, чтобы добавить текст", "Click to add text")}
                </span>
              )}
            </button>
          ) : (
            <div
              className="studio-subtitle-selector__example-caption"
              data-logic={selectedStyle.logicMode}
              data-style={selectedStyle.id}
            >
              {previewLines.map((line, lineIndex) => (
                <span
                  key={`${segment.index}-subtitle-line-${lineIndex}`}
                  className="studio-subtitle-selector__example-line"
                >
                  {line.map((word, wordIndex) => (
                    <span
                      key={`${segment.index}-subtitle-word-${lineIndex}-${wordIndex}`}
                      className={`studio-subtitle-selector__example-word is-${word.state}`}
                    >
                      {word.text}
                    </span>
                  ))}
                </span>
              ))}
            </div>
          )
        ) : null}
      </div>
    </div>
  );
}
