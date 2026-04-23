import { describe, expect, it } from "vitest";

import { sanitizeWorkspaceSegmentEditorCustomMusicState } from "./workspaceSegmentEditorMusic";

describe("sanitizeWorkspaceSegmentEditorCustomMusicState", () => {
  it("keeps a valid persisted custom music asset", () => {
    expect(
      sanitizeWorkspaceSegmentEditorCustomMusicState({
        customMusicAssetId: 441,
        customMusicFileName: "project-track.mp3",
        musicType: "custom",
      }),
    ).toEqual({
      customMusicAssetId: 441,
      customMusicFileName: "project-track.mp3",
      musicType: "custom",
    });
  });

  it("downgrades orphaned custom music to ai when no asset survived restore", () => {
    expect(
      sanitizeWorkspaceSegmentEditorCustomMusicState({
        customMusicAssetId: null,
        customMusicFileName: "local-track.mp3",
        musicType: "custom",
      }),
    ).toEqual({
      customMusicAssetId: null,
      customMusicFileName: null,
      musicType: "ai",
    });
  });

  it("preserves live custom music selection when ephemeral uploads are allowed", () => {
    expect(
      sanitizeWorkspaceSegmentEditorCustomMusicState(
        {
          customMusicAssetId: null,
          customMusicFileName: "local-track.mp3",
          musicType: "custom",
        },
        {
          allowEphemeralCustomMusic: true,
        },
      ),
    ).toEqual({
      customMusicAssetId: null,
      customMusicFileName: "local-track.mp3",
      musicType: "custom",
    });
  });

  it("preserves non-custom music settings", () => {
    expect(
      sanitizeWorkspaceSegmentEditorCustomMusicState({
        customMusicAssetId: null,
        customMusicFileName: null,
        musicType: "stock",
      }),
    ).toEqual({
      customMusicAssetId: null,
      customMusicFileName: null,
      musicType: "stock",
    });
  });
});
