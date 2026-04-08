import { describe, expect, it } from "vitest";

import {
  buildWorkspacePersistedMediaLibraryItems,
  getWorkspaceMediaLibrarySegmentPreviewUrl,
} from "./media-library.js";
import type { WorkspaceProject } from "./projects.js";
import type { WorkspaceSegmentEditorSegment, WorkspaceSegmentEditorSession } from "./segment-editor.js";

const createPhotoSegment = (): WorkspaceSegmentEditorSegment => ({
  currentExternalPlaybackUrl: "https://cdn.example.com/segments/0-animation.mp4",
  currentExternalPreviewUrl: "https://cdn.example.com/segments/0-animation-preview.mp4",
  currentPlaybackUrl: "/api/workspace/project-segment-video?projectId=42&segmentIndex=0&source=current&delivery=playback&v=current",
  currentPreviewUrl: "/api/workspace/project-segment-video?projectId=42&segmentIndex=0&source=current&delivery=preview&v=current",
  currentSourceKind: "ai_generated",
  duration: 4,
  endTime: 4,
  index: 0,
  mediaType: "photo",
  originalExternalPlaybackUrl: "https://cdn.example.com/segments/0-original.jpg",
  originalExternalPreviewUrl: "https://cdn.example.com/segments/0-original-preview.jpg",
  originalPlaybackUrl: "/api/workspace/project-segment-video?projectId=42&segmentIndex=0&source=original&delivery=playback&v=original",
  originalPreviewUrl: "/api/workspace/project-segment-video?projectId=42&segmentIndex=0&source=original&delivery=preview&v=original",
  originalSourceKind: "upload",
  speechDuration: null,
  speechEndTime: null,
  speechStartTime: null,
  speechWords: [],
  startTime: 0,
  text: "Segment",
});

const project: WorkspaceProject & { adId: number } = {
  adId: 42,
  createdAt: "2026-04-09T00:00:00.000Z",
  description: "",
  generatedAt: "2026-04-09T00:00:00.000Z",
  hashtags: [],
  id: "project:42",
  jobId: null,
  posterUrl: null,
  prompt: "Prompt",
  source: "project",
  status: "ready",
  title: "Test project",
  updatedAt: "2026-04-09T00:00:00.000Z",
  videoFallbackUrl: null,
  videoUrl: null,
  youtubePublication: null,
};

const session = (segment: WorkspaceSegmentEditorSegment): WorkspaceSegmentEditorSession => ({
  description: "",
  musicType: "",
  projectId: 42,
  segments: [segment],
  subtitleColor: "",
  subtitleStyle: "",
  subtitleType: "",
  title: "Session",
  voiceType: "",
});

describe("media library photo sources", () => {
  it("uses the external image url for ai_photo previews", () => {
    const segment = createPhotoSegment();

    expect(getWorkspaceMediaLibrarySegmentPreviewUrl(segment, "ai_photo")).toBe(
      "https://cdn.example.com/segments/0-original-preview.jpg",
    );
  });

  it("stores photo items with image preview urls and animation items with video preview urls", () => {
    const items = buildWorkspacePersistedMediaLibraryItems(project, session(createPhotoSegment()));

    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({
      kind: "ai_photo",
      previewKind: "image",
      previewUrl: "https://cdn.example.com/segments/0-original-preview.jpg",
    });
    expect(items[1]).toMatchObject({
      kind: "photo_animation",
      previewKind: "video",
      previewPosterUrl: "https://cdn.example.com/segments/0-original-preview.jpg",
      previewUrl: "/api/workspace/project-segment-video?projectId=42&segmentIndex=0&source=current&delivery=preview&v=current",
    });
  });

  it("skips ai_photo items when a photo only has non-renderable external sources", () => {
    const segment = createPhotoSegment();
    segment.originalExternalPreviewUrl = null;
    segment.originalExternalPlaybackUrl = null;

    const items = buildWorkspacePersistedMediaLibraryItems(project, session(segment));

    expect(items).toHaveLength(1);
    expect(items[0]?.kind).toBe("photo_animation");
  });

  it("does not create a photo animation item when current and original proxy media are the same", () => {
    const segment = createPhotoSegment();
    segment.originalExternalPreviewUrl = null;
    segment.originalExternalPlaybackUrl = null;
    segment.currentExternalPreviewUrl = null;
    segment.currentExternalPlaybackUrl = null;
    segment.originalPreviewUrl = "/api/workspace/project-segment-video?projectId=42&segmentIndex=0&source=original&delivery=preview&v=same";
    segment.currentPreviewUrl = "/api/workspace/project-segment-video?projectId=42&segmentIndex=0&source=current&delivery=preview&v=same";
    segment.originalPlaybackUrl = "/api/workspace/project-segment-video?projectId=42&segmentIndex=0&source=original&delivery=playback&v=same";
    segment.currentPlaybackUrl = "/api/workspace/project-segment-video?projectId=42&segmentIndex=0&source=current&delivery=playback&v=same";

    const items = buildWorkspacePersistedMediaLibraryItems(project, session(segment));

    expect(items).toHaveLength(0);
  });
});
