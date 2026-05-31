import {
  isWorkspaceSegmentImageFile,
  STUDIO_ALLOWED_SEGMENT_CUSTOM_IMAGE_EXTENSIONS,
} from "./workspace-segment-editor";
import type {
  StudioBrandLogoFile,
  StudioCustomMusicFile,
  StudioCustomVideoFile,
  WorkspaceSegmentEditorDraftSession,
} from "./workspace-types";

export const STUDIO_CUSTOM_MUSIC_MAX_BYTES = 18 * 1024 * 1024;
const STUDIO_ALLOWED_CUSTOM_MUSIC_EXTENSIONS = [".m4a", ".mp3", ".wav"] as const;
export const STUDIO_CUSTOM_IMAGE_MAX_BYTES = 48 * 1024 * 1024;
const STUDIO_CUSTOM_VIDEO_MAX_BYTES = 256 * 1024 * 1024;
const STUDIO_ALLOWED_CUSTOM_VIDEO_EXTENSIONS = [".m4v", ".mov", ".mp4", ".webm"] as const;
const STUDIO_ALLOWED_SEGMENT_CUSTOM_VISUAL_EXTENSIONS = [
  ...STUDIO_ALLOWED_CUSTOM_VIDEO_EXTENSIONS,
  ...STUDIO_ALLOWED_SEGMENT_CUSTOM_IMAGE_EXTENSIONS,
] as const;

export const createStudioObjectUrl = (file: Blob) => {
  if (typeof URL === "undefined") {
    throw new Error("Object URL is not available in this environment.");
  }

  return URL.createObjectURL(file);
};

export const revokeStudioObjectUrl = (value: string | null | undefined) => {
  if (typeof URL === "undefined") {
    return;
  }

  const normalized = String(value ?? "").trim();
  if (normalized.startsWith("blob:")) {
    URL.revokeObjectURL(normalized);
  }
};

export const isSupportedStudioMusicFile = (fileName: string) => {
  const normalized = fileName.trim().toLowerCase();
  return STUDIO_ALLOWED_CUSTOM_MUSIC_EXTENSIONS.some((extension) => normalized.endsWith(extension));
};

export const isSupportedStudioVideoFile = (fileName: string) => {
  const normalized = fileName.trim().toLowerCase();
  return STUDIO_ALLOWED_SEGMENT_CUSTOM_VISUAL_EXTENSIONS.some((extension) => normalized.endsWith(extension));
};

export const isSupportedWorkspaceSegmentVisualFile = (fileName: string) => {
  const normalized = fileName.trim().toLowerCase();
  return STUDIO_ALLOWED_SEGMENT_CUSTOM_VISUAL_EXTENSIONS.some((extension) => normalized.endsWith(extension));
};

export const getStudioCustomVisualMaxBytes = (fileName: string) =>
  isWorkspaceSegmentImageFile(fileName) ? STUDIO_CUSTOM_IMAGE_MAX_BYTES : STUDIO_CUSTOM_VIDEO_MAX_BYTES;

export const getStudioCustomVisualTooLargeMessage = (fileName: string) =>
  `Файл слишком большой. Максимум ${Math.floor(getStudioCustomVisualMaxBytes(fileName) / (1024 * 1024))} МБ.`;

export const getWorkspaceSegmentCustomVisualMimeType = (file: File) => {
  if (file.type) {
    return file.type;
  }

  return isWorkspaceSegmentImageFile(file.name) ? "image/jpeg" : "video/mp4";
};

export const getReferencedStudioObjectUrls = (options: {
  brandLogoFile?: StudioBrandLogoFile | null;
  brandLogoFiles?: Array<StudioBrandLogoFile | null | undefined>;
  customMusicFile?: StudioCustomMusicFile | null;
  customVideoFile?: StudioCustomVideoFile | null;
  segmentEditorAppliedSession?: WorkspaceSegmentEditorDraftSession | null;
  segmentEditorDraft?: WorkspaceSegmentEditorDraftSession | null;
}) => {
  const referencedUrls = new Set<string>();

  const register = (value: string | null | undefined) => {
    const normalized = String(value ?? "").trim();
    if (normalized.startsWith("blob:")) {
      referencedUrls.add(normalized);
    }
  };

  register(options.brandLogoFile?.objectUrl);
  options.brandLogoFiles?.forEach((brandLogoFile) => {
    register(brandLogoFile?.objectUrl);
  });
  register(options.customMusicFile?.objectUrl);
  register(options.customVideoFile?.objectUrl);

  [options.segmentEditorDraft, options.segmentEditorAppliedSession].forEach((session) => {
    session?.segments.forEach((segment) => {
      register(segment.customVideo?.objectUrl);
      register(segment.aiPhotoAsset?.objectUrl);
      register(segment.aiVideoAsset?.objectUrl);
      register(segment.imageEditAsset?.objectUrl);
      register(segment.photoAnimationSourceAsset?.objectUrl);
      register(segment.sceneSoundAsset?.objectUrl);
    });
  });

  return referencedUrls;
};
