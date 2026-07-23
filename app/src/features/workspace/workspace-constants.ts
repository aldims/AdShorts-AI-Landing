import type { StudioVideoMode } from "./workspace-types";

export const WORKSPACE_STUDIO_VIDEO_MODE_IDS = [
  "ai_photo",
  "ai_video",
  "custom",
  "standard",
] as const satisfies readonly StudioVideoMode[];

export const WORKSPACE_SEGMENT_PHOTO_DURATION_AUDIO_GUARD_EPSILON_SECONDS = 0.001;

/** Extra presentation time after the final spoken word of the project. */
export const WORKSPACE_SEGMENT_FINAL_CLOSING_PADDING_SECONDS = 0.3;
