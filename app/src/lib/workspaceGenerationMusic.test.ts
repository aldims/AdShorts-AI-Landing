import { describe, expect, it } from "vitest";

import { resolveWorkspaceGenerationMusicRequest } from "./workspaceGenerationMusic.js";

describe("resolveWorkspaceGenerationMusicRequest", () => {
  it("reuses the persisted project custom music asset when no new file is selected", () => {
    const resolved = resolveWorkspaceGenerationMusicRequest({
      requestedMusicType: "custom",
      segmentEditorSession: {
        customMusicAssetId: 441,
        customMusicFileName: "project-track.mp3",
      },
      selectedCustomMusic: null,
      selectedMusicType: "ai",
    });

    expect(resolved.effectiveMusicType).toBe("custom");
    expect(resolved.customMusicAssetId).toBe(441);
    expect(resolved.customMusicFileName).toBe("project-track.mp3");
    expect(resolved.hasAnyCustomMusicSource).toBe(true);
  });

  it("prefers a newly selected custom music asset over the persisted project asset", () => {
    const resolved = resolveWorkspaceGenerationMusicRequest({
      requestedMusicType: "custom",
      segmentEditorSession: {
        customMusicAssetId: 441,
        customMusicFileName: "project-track.mp3",
      },
      selectedCustomMusic: {
        assetId: 552,
        fileName: "new-track.mp3",
      },
      selectedMusicType: "custom",
    });

    expect(resolved.customMusicAssetId).toBe(552);
    expect(resolved.customMusicFileName).toBe("new-track.mp3");
    expect(resolved.hasAnyCustomMusicSource).toBe(true);
  });

  it("flags missing custom music when custom mode has no persisted asset and no selected file", () => {
    const resolved = resolveWorkspaceGenerationMusicRequest({
      requestedMusicType: "custom",
      selectedCustomMusic: null,
      selectedMusicType: "custom",
    });

    expect(resolved.effectiveMusicType).toBe("custom");
    expect(resolved.customMusicAssetId).toBe(null);
    expect(resolved.hasAnyCustomMusicSource).toBe(false);
  });
});
