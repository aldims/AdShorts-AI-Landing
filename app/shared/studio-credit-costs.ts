export type StudioCreditAction = "video_generation" | "ai_photo" | "ai_video" | "photo_animation";

export const STUDIO_VIDEO_GENERATION_CREDIT_COST = 10;
export const STUDIO_SEGMENT_AI_VIDEO_CREDIT_COST = 7;
export const STUDIO_SEGMENT_PHOTO_ANIMATION_CREDIT_COST = 5;
export const STUDIO_SEGMENT_AI_PHOTO_CREDIT_COST = 2;

export const STUDIO_CREDIT_COST_BY_ACTION: Record<StudioCreditAction, number> = {
  video_generation: STUDIO_VIDEO_GENERATION_CREDIT_COST,
  ai_photo: STUDIO_SEGMENT_AI_PHOTO_CREDIT_COST,
  ai_video: STUDIO_SEGMENT_AI_VIDEO_CREDIT_COST,
  photo_animation: STUDIO_SEGMENT_PHOTO_ANIMATION_CREDIT_COST,
};
