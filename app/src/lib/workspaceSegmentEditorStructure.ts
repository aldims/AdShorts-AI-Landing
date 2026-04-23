export const hasWorkspaceSegmentEditorStructureChanged = (
  currentSegmentIndexes: number[],
  baselineSegmentIndexes: number[],
) => {
  if (currentSegmentIndexes.length !== baselineSegmentIndexes.length) {
    return true;
  }

  return currentSegmentIndexes.some((segmentIndex, index) => segmentIndex !== baselineSegmentIndexes[index]);
};
