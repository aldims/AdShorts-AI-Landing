import {
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  clampWorkspaceSegmentInfographicTransform,
  getWorkspaceSegmentInfographicAssetUrl,
  getWorkspaceSegmentInfographicOpacity,
  getWorkspaceSegmentInfographicPartOpacity,
  resizeWorkspaceSegmentInfographicFromCorner,
} from "./workspace-infographic-helpers";
import type {
  WorkspaceSegmentInfographic,
  WorkspaceSegmentInfographicTransform,
} from "./workspace-types";

type InfographicDragState = {
  handle: "move" | "ne" | "nw" | "se" | "sw";
  origin: WorkspaceSegmentInfographicTransform;
  pointerId: number;
  startX: number;
  startY: number;
};

export type WorkspaceSegmentInfographicOverlayProps = {
  editable: boolean;
  infographic: WorkspaceSegmentInfographic;
  isPlaying: boolean;
  localTimeSeconds: number;
  onDelete?: () => void;
  onInteractionStart?: () => void;
  onRedo?: () => void;
  onTransformCommit?: (transform: WorkspaceSegmentInfographicTransform) => void;
  onTransformPreview?: (transform: WorkspaceSegmentInfographicTransform) => void;
  onUndo?: () => void;
  segmentDurationSeconds: number;
};

export const WorkspaceSegmentInfographicOverlay = ({
  editable,
  infographic,
  isPlaying,
  localTimeSeconds,
  onDelete,
  onInteractionStart,
  onRedo,
  onTransformCommit,
  onTransformPreview,
  onUndo,
  segmentDurationSeconds,
}: WorkspaceSegmentInfographicOverlayProps) => {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<InfographicDragState | null>(null);
  const frameRef = useRef<number | null>(null);
  const pendingTransformRef = useRef<WorkspaceSegmentInfographicTransform | null>(null);
  const [transientTransform, setTransientTransform] = useState(infographic.transform);
  const [isInteracting, setIsInteracting] = useState(false);
  const [isSelected, setIsSelected] = useState(editable);

  useEffect(() => {
    if (!dragRef.current) {
      setTransientTransform(infographic.transform);
    }
  }, [infographic.mediaAssetId, infographic.transform.centerX, infographic.transform.centerY, infographic.transform.width]);

  useEffect(() => {
    setIsSelected(true);
  }, [infographic.mediaAssetId]);

  useEffect(() => () => {
    if (frameRef.current !== null) {
      window.cancelAnimationFrame(frameRef.current);
    }
  }, []);

  const scheduleTransform = (transform: WorkspaceSegmentInfographicTransform) => {
    pendingTransformRef.current = transform;
    onTransformPreview?.(transform);
    if (frameRef.current !== null) {
      return;
    }
    frameRef.current = window.requestAnimationFrame(() => {
      frameRef.current = null;
      if (pendingTransformRef.current) {
        setTransientTransform(pendingTransformRef.current);
      }
    });
  };

  const beginInteraction = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!editable || event.button !== 0) {
      return;
    }
    setIsSelected(true);
    const target = event.target as HTMLElement;
    const rawHandle = target.closest<HTMLElement>("[data-infographic-handle]")?.dataset.infographicHandle;
    const handle = rawHandle === "ne" || rawHandle === "nw" || rawHandle === "se" || rawHandle === "sw"
      ? rawHandle
      : "move";
    event.preventDefault();
    event.stopPropagation();
    onInteractionStart?.();
    dragRef.current = {
      handle,
      origin: { ...transientTransform },
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
    };
    setIsInteracting(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const updateInteraction = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    const root = rootRef.current;
    if (!drag || !root || drag.pointerId !== event.pointerId) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    const rect = root.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
      return;
    }
    const deltaX = (event.clientX - drag.startX) / rect.width;
    const deltaY = (event.clientY - drag.startY) / rect.height;
    const next = drag.handle === "move"
      ? {
          ...drag.origin,
          centerX: drag.origin.centerX + deltaX,
          centerY: drag.origin.centerY + deltaY,
        }
      : resizeWorkspaceSegmentInfographicFromCorner({
          deltaX,
          deltaY,
          handle: drag.handle,
          intrinsicHeight: infographic.intrinsicHeight,
          intrinsicWidth: infographic.intrinsicWidth,
          origin: drag.origin,
        });
    scheduleTransform(
      clampWorkspaceSegmentInfographicTransform(next, infographic.intrinsicWidth, infographic.intrinsicHeight),
    );
  };

  const finishInteraction = (event: ReactPointerEvent<HTMLDivElement>, cancelled = false) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    const nextTransform = cancelled
      ? drag.origin
      : pendingTransformRef.current ?? transientTransform;
    if (cancelled) {
      onTransformPreview?.(drag.origin);
    }
    // Clear the active drag before releasing capture. Browsers dispatch
    // lostpointercapture after releasePointerCapture(), and that event must not
    // finish (and commit) the same interaction a second time.
    dragRef.current = null;
    pendingTransformRef.current = null;
    setIsInteracting(false);
    setTransientTransform(nextTransform);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (!cancelled && (
      nextTransform.centerX !== drag.origin.centerX ||
      nextTransform.centerY !== drag.origin.centerY ||
      nextTransform.width !== drag.origin.width
    )) {
      onTransformCommit?.(nextTransform);
    }
  };

  const opacity = isPlaying && !isInteracting
    ? getWorkspaceSegmentInfographicOpacity(
        localTimeSeconds,
        segmentDurationSeconds,
        infographic.animation.durationSeconds,
      )
    : 1;
  const style = {
    "--workspace-infographic-center-x": `${transientTransform.centerX * 100}%`,
    "--workspace-infographic-center-y": `${transientTransform.centerY * 100}%`,
    "--workspace-infographic-opacity": opacity,
    "--workspace-infographic-width": `${transientTransform.width * 100}%`,
  } as CSSProperties;
  const objectStyle = infographic.parts.length > 0
    ? { aspectRatio: `${infographic.intrinsicWidth} / ${infographic.intrinsicHeight}` }
    : undefined;
  const isEditing = editable && isSelected;

  return (
    <div
      ref={rootRef}
      className={`studio-segment-infographic${isEditing ? " is-editable" : editable ? " is-selectable" : ""}${isInteracting ? " is-interacting" : ""}`}
      style={style}
      data-testid="segment-infographic-overlay"
      onPointerCancel={(event) => finishInteraction(event, true)}
      onPointerDown={beginInteraction}
      onLostPointerCapture={(event) => finishInteraction(event)}
      onPointerMove={updateInteraction}
      onPointerUp={(event) => finishInteraction(event)}
    >
      <div
        className="studio-segment-infographic__object"
        style={objectStyle}
        data-infographic-handle="move"
        role={editable ? "group" : undefined}
        aria-label={editable
          ? isEditing
            ? `Инфографика: ${infographic.text}. Перетащите для изменения положения.`
            : `Инфографика: ${infographic.text}. Нажмите, чтобы редактировать.`
          : undefined}
        tabIndex={editable ? 0 : -1}
        onKeyDown={(event) => {
          if (editable && !isEditing && (event.key === "Enter" || event.key === " ")) {
            event.preventDefault();
            event.stopPropagation();
            setIsSelected(true);
            onInteractionStart?.();
            return;
          }
          if (isEditing && (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
            event.preventDefault();
            event.stopPropagation();
            if (event.shiftKey) {
              onRedo?.();
            } else {
              onUndo?.();
            }
            return;
          }
          if (!isEditing || !["ArrowDown", "ArrowLeft", "ArrowRight", "ArrowUp"].includes(event.key)) {
            if (isEditing && (event.key === "Backspace" || event.key === "Delete")) {
              event.preventDefault();
              event.stopPropagation();
              onDelete?.();
            }
            return;
          }
          event.preventDefault();
          event.stopPropagation();
          onInteractionStart?.();
          const step = event.shiftKey ? 0.025 : 0.006;
          const nextTransform = clampWorkspaceSegmentInfographicTransform(
            {
              ...transientTransform,
              centerX: transientTransform.centerX + (event.key === "ArrowLeft" ? -step : event.key === "ArrowRight" ? step : 0),
              centerY: transientTransform.centerY + (event.key === "ArrowUp" ? -step : event.key === "ArrowDown" ? step : 0),
            },
            infographic.intrinsicWidth,
            infographic.intrinsicHeight,
          );
          setTransientTransform(nextTransform);
          onTransformCommit?.(nextTransform);
        }}
      >
        {infographic.parts.length > 0 ? infographic.parts.map((part, partIndex) => {
          const partOpacity = isPlaying && !isInteracting
            ? getWorkspaceSegmentInfographicPartOpacity(
                part,
                localTimeSeconds,
                segmentDurationSeconds,
                infographic.animation.durationSeconds,
                infographic.parts,
              )
            : 1;
          const partStyle = {
            "--workspace-infographic-part-opacity": partOpacity,
            height: `${part.frame.height * 100}%`,
            left: `${part.frame.x * 100}%`,
            top: `${part.frame.y * 100}%`,
            width: `${part.frame.width * 100}%`,
          } as CSSProperties;
          return (
            <img
              className="studio-segment-infographic__image is-part"
              src={getWorkspaceSegmentInfographicAssetUrl(part.mediaAssetId)}
              alt={part.text}
              draggable={false}
              key={`${part.mediaAssetId}:${partIndex}`}
              style={partStyle}
            />
          );
        }) : (
          <img
            className="studio-segment-infographic__image"
            src={getWorkspaceSegmentInfographicAssetUrl(infographic.mediaAssetId)}
            alt={infographic.text}
            draggable={false}
          />
        )}
        {isEditing ? (
          <>
            {(["nw", "ne", "sw", "se"] as const).map((handle) => (
              <span
                className={`studio-segment-infographic__handle is-${handle}`}
                data-infographic-handle={handle}
                key={handle}
                aria-hidden="true"
              />
            ))}
            <button
              className="studio-segment-infographic__close"
              type="button"
              aria-label="Закрыть редактирование инфографики"
              title="Закрыть"
              onPointerDown={(event) => {
                event.preventDefault();
                event.stopPropagation();
              }}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                setIsSelected(false);
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
              </svg>
            </button>
          </>
        ) : null}
      </div>
    </div>
  );
};
