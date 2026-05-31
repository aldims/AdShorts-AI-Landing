import type {
  CSSProperties,
  PointerEvent as ReactPointerEvent,
} from "react";
import type { Locale } from "../../lib/i18n";
import { workspaceText } from "./workspace-page-model";
import {
  WORKSPACE_TALKING_TARGET_RESIZE_HANDLES,
  type WorkspaceTalkingCharacterTarget,
} from "./workspace-talking-character-helpers";

type WorkspaceSegmentTalkingTargetOverlayProps = {
  draftTarget: WorkspaceTalkingCharacterTarget | null;
  locale: Locale;
  onPointerCancel: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerMove: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onPointerUp: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onReset: () => void;
  segmentIndex: number;
  target: WorkspaceTalkingCharacterTarget | null;
};

const getWorkspaceTalkingTargetStyle = (target: WorkspaceTalkingCharacterTarget | null | undefined) =>
  target
    ? ({
        height: `${target.height * 100}%`,
        left: `${target.x * 100}%`,
        top: `${target.y * 100}%`,
        width: `${target.width * 100}%`,
      } satisfies CSSProperties)
    : undefined;

export function WorkspaceSegmentTalkingTargetOverlay({
  draftTarget,
  locale,
  onPointerCancel,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onReset,
  segmentIndex,
  target,
}: WorkspaceSegmentTalkingTargetOverlayProps) {
  const displayTarget = draftTarget ?? target;
  const isDrawingTarget = Boolean(draftTarget);
  const targetStyle = getWorkspaceTalkingTargetStyle(displayTarget);

  return (
    <div
      className={`studio-segment-talking-target-overlay${displayTarget ? " has-target" : ""}${isDrawingTarget ? " is-drawing" : ""}`}
      data-talking-target-segment-index={segmentIndex}
      role="application"
      aria-label={workspaceText(locale, "Выбор говорящего персонажа на сцене", "Speaking character selection on scene")}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
      }}
      onPointerCancel={onPointerCancel}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      {targetStyle ? (
        <span
          className={`studio-segment-talking-target-overlay__box${isDrawingTarget ? " is-drawing" : ""}`}
          style={targetStyle}
          data-talking-target-action={isDrawingTarget ? undefined : "move"}
        >
          {isDrawingTarget ? null : (
            <>
              <span className="studio-segment-talking-target-overlay__box-grid" aria-hidden="true" />
              <span className="studio-segment-talking-target-overlay__box-center" aria-hidden="true" />
              {WORKSPACE_TALKING_TARGET_RESIZE_HANDLES.map((handle) => (
                <span
                  key={handle}
                  className={`studio-segment-talking-target-overlay__handle studio-segment-talking-target-overlay__handle--${handle}`}
                  data-talking-target-action={`resize:${handle}`}
                  aria-hidden="true"
                />
              ))}
              <button
                className="studio-segment-talking-target-overlay__reset"
                type="button"
                aria-label={workspaceText(locale, "Сбросить выбор говорящего", "Reset speaker selection")}
                title={workspaceText(locale, "Сбросить выбор говорящего", "Reset speaker selection")}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  onReset();
                }}
                onPointerDown={(event) => {
                  event.stopPropagation();
                }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path
                    d="M20 11a8 8 0 1 1-2.34-5.66L20 8"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M20 4v4h-4"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </>
          )}
        </span>
      ) : null}
      <span className="studio-segment-talking-target-overlay__label">
        {displayTarget
          ? workspaceText(locale, "Говорящий", "Speaker")
          : workspaceText(locale, "Выберите говорящего", "Select speaker")}
      </span>
    </div>
  );
}
