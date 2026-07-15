import { describe, expect, it, vi } from "vitest";

import { dispatchWorkspaceSegmentPromptVisualToolAction } from "./workspace-segment-visual-helpers";

describe("dispatchWorkspaceSegmentPromptVisualToolAction", () => {
  it("opens the file picker without selecting the upload tab", () => {
    const openFilePicker = vi.fn();
    const selectTab = vi.fn();

    dispatchWorkspaceSegmentPromptVisualToolAction("upload", { openFilePicker, selectTab });

    expect(openFilePicker).toHaveBeenCalledOnce();
    expect(selectTab).not.toHaveBeenCalled();
  });

  it("selects regular visual tabs without opening the file picker", () => {
    const openFilePicker = vi.fn();
    const selectTab = vi.fn();

    dispatchWorkspaceSegmentPromptVisualToolAction("ai_photo", { openFilePicker, selectTab });

    expect(selectTab).toHaveBeenCalledWith("ai_photo");
    expect(openFilePicker).not.toHaveBeenCalled();
  });
});
