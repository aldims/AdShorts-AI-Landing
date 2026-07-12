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
  getWorkspaceSegmentInfographicPartOpacities,
  resizeWorkspaceSegmentInfographicFromCorner,
  WORKSPACE_SEGMENT_INFOGRAPHIC_REVEAL_PART_INDICES,
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
  canRedo?: boolean;
  canUndo?: boolean;
  editable: boolean;
  infographic: WorkspaceSegmentInfographic;
  isPlaying: boolean;
  localTimeSeconds: number;
  onDelete?: () => void;
  onInteractionStart?: () => void;
  onRedo?: () => void;
  onTransformCommit?: (transform: WorkspaceSegmentInfographicTransform) => void;
  onUndo?: () => void;
  segmentDurationSeconds: number;
};

export const WorkspaceSegmentInfographicOverlay = ({
  canRedo = false,
  canUndo = false,
  editable,
  infographic,
  isPlaying,
  localTimeSeconds,
  onDelete,
  onInteractionStart,
  onRedo,
  onTransformCommit,
  onUndo,
  segmentDurationSeconds,
}: WorkspaceSegmentInfographicOverlayProps) => {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<InfographicDragState | null>(null);
  const frameRef = useRef<number | null>(null);
  const pendingTransformRef = useRef<WorkspaceSegmentInfographicTransform | null>(null);
  const [transientTransform, setTransientTransform] = useState(infographic.transform);
  const [isInteracting, setIsInteracting] = useState(false);

  useEffect(() => {
    if (!dragRef.current) {
      setTransientTransform(infographic.transform);
    }
  }, [infographic.mediaAssetId, infographic.transform.centerX, infographic.transform.centerY, infographic.transform.width]);

  useEffect(() => () => {
    if (frameRef.current !== null) {
      window.cancelAnimationFrame(frameRef.current);
    }
  }, []);

  const scheduleTransform = (transform: WorkspaceSegmentInfographicTransform) => {
    pendingTransformRef.current = transform;
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
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    dragRef.current = null;
    setIsInteracting(false);
    const nextTransform = cancelled
      ? drag.origin
      : pendingTransformRef.current ?? transientTransform;
    pendingTransformRef.current = null;
    setTransientTransform(nextTransform);
    if (!cancelled && (
      nextTransform.centerX !== drag.origin.centerX ||
      nextTransform.centerY !== drag.origin.centerY ||
      nextTransform.width !== drag.origin.width
    )) {
      onTransformCommit?.(nextTransform);
    }
  };

  const partOpacities = isPlaying && !isInteracting
    ? getWorkspaceSegmentInfographicPartOpacities(
        localTimeSeconds,
        segmentDurationSeconds,
        infographic.animation.durationSeconds,
      )
    : [1, 1, 1];
  const style = {
    "--workspace-infographic-center-x": `${transientTransform.centerX * 100}%`,
    "--workspace-infographic-center-y": `${transientTransform.centerY * 100}%`,
    "--workspace-infographic-part-0-opacity": partOpacities[0],
    "--workspace-infographic-part-1-opacity": partOpacities[1],
    "--workspace-infographic-part-2-opacity": partOpacities[2],
    "--workspace-infographic-width": `${transientTransform.width * 100}%`,
  } as CSSProperties;

  return (
    <div
      ref={rootRef}
      className={`studio-segment-infographic${editable ? " is-editable" : ""}${isInteracting ? " is-interacting" : ""}`}
      style={style}
      data-testid="segment-infographic-overlay"
      onPointerCancel={(event) => finishInteraction(event, true)}
      onPointerDown={beginInteraction}
      onPointerMove={updateInteraction}
      onPointerUp={(event) => finishInteraction(event)}
    >
      <div
        className="studio-segment-infographic__object"
        data-infographic-handle="move"
        role={editable ? "group" : undefined}
        aria-label={editable ? `Инфографика: ${infographic.text}. Перетащите для изменения положения.` : undefined}
        tabIndex={editable ? 0 : -1}
        onKeyDown={(event) => {
          if (editable && (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
            event.preventDefault();
            event.stopPropagation();
            if (event.shiftKey) {
              onRedo?.();
            } else {
              onUndo?.();
            }
            return;
          }
          if (!editable || !["ArrowDown", "ArrowLeft", "ArrowRight", "ArrowUp"].includes(event.key)) {
            if (editable && (event.key === "Backspace" || event.key === "Delete")) {
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
        {WORKSPACE_SEGMENT_INFOGRAPHIC_REVEAL_PART_INDICES.map((partIndex) => (
          <img
            aria-hidden={partIndex === 0 ? undefined : true}
            className={`studio-segment-infographic__image is-part-${partIndex}`}
            src={getWorkspaceSegmentInfographicAssetUrl(infographic.mediaAssetId)}
            alt={partIndex === 0 ? infographic.text : ""}
            draggable={false}
            key={partIndex}
          />
        ))}
        {editable ? (
          <>
            {(["nw", "ne", "sw", "se"] as const).map((handle) => (
              <span
                className={`studio-segment-infographic__handle is-${handle}`}
                data-infographic-handle={handle}
                key={handle}
                aria-hidden="true"
              />
            ))}
            <span className="studio-segment-infographic__toolbar">
              <button
                type="button"
                aria-label="Отменить изменение инфографики"
                title="Отменить"
                disabled={!canUndo}
                onPointerDown={(event) => { event.preventDefault(); event.stopPropagation(); }}
                onClick={(event) => { event.preventDefault(); event.stopPropagation(); onUndo?.(); }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M9 7H4V2M4.9 7.7A8 8 0 1 1 4 12" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                </svg>
              </button>
              <button
                type="button"
                aria-label="Вернуть изменение инфографики"
                title="Вернуть"
                disabled={!canRedo}
                onPointerDown={(event) => { event.preventDefault(); event.stopPropagation(); }}
                onClick={(event) => { event.preventDefault(); event.stopPropagation(); onRedo?.(); }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M15 7h5V2M19.1 7.7A8 8 0 1 0 20 12" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" />
                </svg>
              </button>
              <button
                className="studio-segment-infographic__delete"
                type="button"
                aria-label="Удалить инфографику"
                title="Удалить инфографику"
                onPointerDown={(event) => { event.preventDefault(); event.stopPropagation(); }}
                onClick={(event) => { event.preventDefault(); event.stopPropagation(); onDelete?.(); }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
                </svg>
              </button>
            </span>
          </>
        ) : null}
      </div>
    </div>
  );
};
