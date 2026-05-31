import { areWorkspaceSegmentEditorSegmentOrdersEqual } from "./workspace-segment-editor-checklist";
import type { WorkspaceSegmentEditorDraftSegment, WorkspaceSegmentEditorDraftSession } from "./workspace-types";

export const moveArrayItemToInsertIndex = <T,>(items: T[], fromIndex: number, insertIndex: number) => {
  if (fromIndex < 0 || fromIndex >= items.length) {
    return items;
  }

  const boundedInsertIndex = Math.max(0, Math.min(insertIndex, items.length));
  const adjustedInsertIndex = boundedInsertIndex > fromIndex ? boundedInsertIndex - 1 : boundedInsertIndex;
  if (adjustedInsertIndex === fromIndex) {
    return items;
  }

  const nextItems = [...items];
  const [movedItem] = nextItems.splice(fromIndex, 1);
  if (typeof movedItem === "undefined") {
    return items;
  }

  nextItems.splice(adjustedInsertIndex, 0, movedItem);
  return nextItems;
};

export const getVisibleInsertIndexForDraggedItem = (
  itemCount: number,
  draggedIndex: number | null,
  insertIndex: number | null,
) => {
  if (draggedIndex === null || insertIndex === null || draggedIndex < 0 || draggedIndex >= itemCount) {
    return null;
  }

  const boundedInsertIndex = Math.max(0, Math.min(insertIndex, itemCount));
  const adjustedInsertIndex = boundedInsertIndex > draggedIndex ? boundedInsertIndex - 1 : boundedInsertIndex;
  return adjustedInsertIndex === draggedIndex ? null : boundedInsertIndex;
};

export type WorkspaceSegmentEditorStructureSnapshot = Pick<WorkspaceSegmentEditorDraftSession, "segments">;

const normalizeWorkspaceSegmentEditorStructureBaselines = (
  baselineOrBaselines?:
    | WorkspaceSegmentEditorStructureSnapshot
    | readonly (WorkspaceSegmentEditorStructureSnapshot | null | undefined)[]
    | null,
) => {
  if (!baselineOrBaselines) {
    return [];
  }

  return (Array.isArray(baselineOrBaselines) ? baselineOrBaselines : [baselineOrBaselines]).filter(
    (baseline): baseline is WorkspaceSegmentEditorStructureSnapshot => Boolean(baseline),
  );
};

export const getWorkspaceSegmentEditorBaselineSegmentIndexes = (
  baselineOrBaselines?:
    | WorkspaceSegmentEditorStructureSnapshot
    | readonly (WorkspaceSegmentEditorStructureSnapshot | null | undefined)[]
    | null,
) =>
  Array.from(
    new Set(
      normalizeWorkspaceSegmentEditorStructureBaselines(baselineOrBaselines).flatMap((baseline) =>
        baseline.segments.map((segment) => segment.index),
      ),
    ),
  );

const hasWorkspaceSegmentEditorNonCanonicalSourceOrder = (draft: WorkspaceSegmentEditorStructureSnapshot) =>
  draft.segments.some((segment, index) => segment.index !== index);

export const shouldRecoverWorkspaceSegmentEditorExplicitStructureChange = (
  draft?: WorkspaceSegmentEditorStructureSnapshot | null,
  baselineOrBaselines?:
    | WorkspaceSegmentEditorStructureSnapshot
    | readonly (WorkspaceSegmentEditorStructureSnapshot | null | undefined)[]
    | null,
) => {
  if (!draft) {
    return false;
  }

  if (hasWorkspaceSegmentEditorNonCanonicalSourceOrder(draft)) {
    return true;
  }

  const baselines = normalizeWorkspaceSegmentEditorStructureBaselines(baselineOrBaselines);
  if (!baselines.length) {
    return false;
  }

  return baselines.some((baseline) => {
    const baselineSegmentIndexes = new Set(baseline.segments.map((segment) => segment.index));
    return draft.segments.some((segment) => !baselineSegmentIndexes.has(segment.index));
  });
};

export const shouldAllowWorkspaceSegmentEditorStructureChange = (
  draft?: WorkspaceSegmentEditorStructureSnapshot | null,
  baselineOrBaselines?:
    | WorkspaceSegmentEditorStructureSnapshot
    | readonly (WorkspaceSegmentEditorStructureSnapshot | null | undefined)[]
    | null,
) => {
  if (!draft) {
    return false;
  }

  return (
    normalizeWorkspaceSegmentEditorStructureBaselines(baselineOrBaselines).some(
      (baseline) => !areWorkspaceSegmentEditorSegmentOrdersEqual(draft, baseline),
    ) || hasWorkspaceSegmentEditorNonCanonicalSourceOrder(draft)
  );
};

export const resolveWorkspaceSegmentEditorStructureChangePermission = (options: {
  baselineOrBaselines?:
    | WorkspaceSegmentEditorStructureSnapshot
    | readonly (WorkspaceSegmentEditorStructureSnapshot | null | undefined)[]
    | null;
  draft?: WorkspaceSegmentEditorStructureSnapshot | null;
  isExplicitStructureChange?: boolean;
}) => {
  const hasStructureChange = shouldAllowWorkspaceSegmentEditorStructureChange(
    options.draft,
    options.baselineOrBaselines,
  );
  const isExplicitStructureChange = Boolean(options.isExplicitStructureChange);

  return {
    allowStructureChange: hasStructureChange && isExplicitStructureChange,
    hasStructureChange,
    shouldBlockImplicitStructureChange: hasStructureChange && !isExplicitStructureChange,
  };
};

type WorkspaceSegmentEditorStructurePayload = {
  segments: Array<{ index: number; [key: string]: unknown }>;
};

export const doesWorkspaceSegmentEditorPayloadMatchSessionStructure = (
  session?: WorkspaceSegmentEditorStructureSnapshot | null,
  payload?: WorkspaceSegmentEditorStructurePayload | null,
) => {
  if (!session || !payload || session.segments.length !== payload.segments.length) {
    return false;
  }

  return session.segments.every((segment, index) => segment.index === payload.segments[index]?.index);
};

export const getWorkspaceSegmentEditorDisplayNumber = (
  segments: WorkspaceSegmentEditorDraftSegment[],
  segmentIndex: number,
) => {
  const arrayIndex = segments.findIndex((segment) => segment.index === segmentIndex);
  return (arrayIndex >= 0 ? arrayIndex : segmentIndex) + 1;
};
