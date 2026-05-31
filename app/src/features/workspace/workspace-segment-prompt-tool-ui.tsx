import type { ReactNode } from "react";

export const renderSegmentEditorPromptToolIcon = (
  kind:
    | "ai_photo"
    | "ai_video"
    | "library"
    | "upload"
    | "photo_animation"
    | "talking_photo"
    | "image_edit"
    | "image_upscale"
    | "scene_sound"
    | "voiceover"
    | "brand",
) => {
  const iconClassName = `studio-segment-editor__prompt-tool-icon studio-segment-editor__prompt-tool-icon--${kind.replace("_", "-")}`;
  const aiBadge =
    kind === "ai_photo" ||
    kind === "ai_video" ||
    kind === "photo_animation" ||
    kind === "talking_photo" ||
    kind === "image_edit" ||
    kind === "image_upscale" ||
    kind === "scene_sound" ? (
      <span className="studio-segment-editor__prompt-tool-icon__badge">AI</span>
    ) : null;
  const iconId = `segment-editor-tool-${kind.replace("_", "-")}`;
  const glassGradientId = `${iconId}-glass`;
  const shineGradientId = `${iconId}-shine`;
  const cyanGradientId = `${iconId}-cyan`;
  const violetGradientId = `${iconId}-violet`;
  const glowFilterId = `${iconId}-glow`;
  const generatedIconSrc =
    kind === "ai_photo"
      ? "/icons/segment-ai-photo-glyph-icon-generated.png"
      : kind === "ai_video"
        ? "/icons/segment-ai-video-glyph-icon-generated.png"
        : kind === "library"
          ? "/icons/segment-library-glyph-icon-generated.png"
          : kind === "upload"
            ? "/icons/segment-upload-glyph-icon-generated.png"
            : kind === "photo_animation"
              ? "/icons/segment-photo-animation-icon-generated.png"
            : kind === "talking_photo"
              ? "/icons/segment-talking-photo-icon-generated.png"
              : kind === "image_edit"
                ? "/icons/segment-image-edit-icon-generated.png"
                : kind === "image_upscale"
                  ? "/icons/segment-image-upscale-icon-generated.png"
                  : kind === "scene_sound"
                    ? "/icons/segment-scene-sound-icon-generated.png"
                  : kind === "voiceover"
                    ? "/icons/segment-voiceover-icon-generated.png"
                  : kind === "brand"
                    ? "/icons/segment-brand-icon-generated.png"
                    : null;
  const renderIconSvg = (children: ReactNode) => (
    <span className={iconClassName} aria-hidden="true">
      {aiBadge}
      <svg className="studio-segment-editor__prompt-tool-icon__svg" viewBox="0 0 64 64" fill="none">
        <defs>
          <linearGradient id={glassGradientId} x1="16" y1="8" x2="52" y2="56" gradientUnits="userSpaceOnUse">
            <stop stopColor="#f8fbff" stopOpacity="0.92" />
            <stop offset="0.42" stopColor="#8fb6d9" stopOpacity="0.56" />
            <stop offset="1" stopColor="#172436" stopOpacity="0.84" />
          </linearGradient>
          <linearGradient id={shineGradientId} x1="18" y1="13" x2="42" y2="47" gradientUnits="userSpaceOnUse">
            <stop stopColor="#ffffff" stopOpacity="0.76" />
            <stop offset="0.45" stopColor="#c7ddff" stopOpacity="0.24" />
            <stop offset="1" stopColor="#6bd3ff" stopOpacity="0.08" />
          </linearGradient>
          <linearGradient id={cyanGradientId} x1="14" y1="17" x2="48" y2="51" gradientUnits="userSpaceOnUse">
            <stop stopColor="#eff9ff" />
            <stop offset="0.48" stopColor="#8fd8ff" />
            <stop offset="1" stopColor="#4f7dff" />
          </linearGradient>
          <linearGradient id={violetGradientId} x1="18" y1="12" x2="50" y2="52" gradientUnits="userSpaceOnUse">
            <stop stopColor="#f7e8ff" />
            <stop offset="0.46" stopColor="#a787ff" />
            <stop offset="1" stopColor="#4aa8ff" />
          </linearGradient>
          <filter id={glowFilterId} x="-26%" y="-26%" width="152%" height="152%" colorInterpolationFilters="sRGB">
            <feGaussianBlur stdDeviation="2.4" result="blur" />
            <feColorMatrix
              in="blur"
              type="matrix"
              values="0 0 0 0 0.45 0 0 0 0 0.76 0 0 0 0 1 0 0 0 0.62 0"
              result="glow"
            />
            <feMerge>
              <feMergeNode in="glow" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {children}
      </svg>
    </span>
  );

  if (generatedIconSrc) {
    return (
      <span className={`${iconClassName} studio-segment-editor__prompt-tool-icon--asset`} aria-hidden="true">
        <img
          className="studio-segment-editor__prompt-tool-icon-asset"
          src={generatedIconSrc}
          alt=""
          draggable={false}
        />
      </span>
    );
  }

  if (kind === "ai_photo") {
    return renderIconSvg(
      <>
        <rect x="15" y="17" width="38" height="32" rx="8.5" fill={`url(#${glassGradientId})`} opacity="0.28" />
        <rect x="15" y="17" width="38" height="32" rx="8.5" stroke={`url(#${shineGradientId})`} strokeWidth="3" filter={`url(#${glowFilterId})`} />
        <path d="M19.5 42.5 29 32.2l6.4 7.1 4.1-4.5 8.7 7.7" fill={`url(#${violetGradientId})`} opacity="0.92" />
        <circle cx="43.5" cy="25.5" r="4.2" fill={`url(#${cyanGradientId})`} opacity="0.95" />
        <path d="M22 21.5h25" stroke="white" strokeOpacity="0.34" strokeWidth="1.6" />
        <path d="m51.5 12.5 1.8 4 4.2 1.6-4.2 1.6-1.8 4-1.8-4-4.2-1.6 4.2-1.6 1.8-4Z" fill="white" opacity="0.95" />
      </>,
    );
  }

  if (kind === "ai_video" || kind === "photo_animation") {
    return renderIconSvg(
      <>
        <rect x="19" y="16" width="34" height="29" rx="7.5" fill={`url(#${glassGradientId})`} opacity="0.28" />
        <rect x="16" y="21" width="34" height="29" rx="8" fill="#07111f" fillOpacity="0.78" stroke={`url(#${shineGradientId})`} strokeWidth="2.6" filter={`url(#${glowFilterId})`} />
        <path d="M18 24.5h31" stroke="white" strokeOpacity="0.42" strokeWidth="2" />
        <path d="M23 24.5 29.5 18M32 24.5 38.5 18M41 24.5 47.5 18" stroke={`url(#${violetGradientId})`} strokeWidth="3" strokeLinecap="round" />
        <path d="m30 30.5 11 6.7-11 6.7V30.5Z" fill={`url(#${cyanGradientId})`} filter={`url(#${glowFilterId})`} />
        {kind === "photo_animation" ? (
          <>
            <path d="M17.5 14.5c6.8-5 17-3.8 22.3 2.8" stroke={`url(#${cyanGradientId})`} strokeWidth="2.4" strokeLinecap="round" />
            <path d="M41.5 11.5v7.2h-7.2" stroke={`url(#${cyanGradientId})`} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          </>
        ) : null}
      </>,
    );
  }

  if (kind === "library") {
    return renderIconSvg(
      <>
        <path d="M14 22.5v-3.7c0-3.5 2.4-5.8 5.9-5.8h9.4l4.4 4.6h10.4c3.5 0 5.9 2.3 5.9 5.8v2.1" fill="#0b1523" fillOpacity="0.9" stroke={`url(#${shineGradientId})`} strokeWidth="2.4" />
        <rect x="12" y="22" width="40" height="28" rx="8" fill={`url(#${glassGradientId})`} fillOpacity="0.32" stroke={`url(#${shineGradientId})`} strokeWidth="2.8" filter={`url(#${glowFilterId})`} />
        <rect x="19" y="29" width="10" height="10" rx="3" fill={`url(#${violetGradientId})`} opacity="0.92" />
        <rect x="34" y="29" width="11" height="10" rx="3" fill={`url(#${cyanGradientId})`} opacity="0.9" />
        <path d="M20 43h25" stroke="white" strokeOpacity="0.46" strokeWidth="2.2" strokeLinecap="round" />
      </>,
    );
  }

  if (kind === "upload" || kind === "image_edit") {
    return renderIconSvg(
      <>
        <rect x="14" y="16" width="36" height="30" rx="8" fill={`url(#${glassGradientId})`} opacity="0.26" />
        <rect x="14" y="16" width="36" height="30" rx="8" stroke={`url(#${shineGradientId})`} strokeWidth="2.8" filter={`url(#${glowFilterId})`} />
        <path d="M18.5 40.5 27 31.3l5.3 5.8 3.6-3.8 8.8 7.2" fill={`url(#${violetGradientId})`} opacity="0.86" />
        <circle cx="41.5" cy="24.2" r="3.6" fill={`url(#${cyanGradientId})`} />
        {kind === "upload" ? (
          <>
            <path d="M47 12v16M40.5 18.5 47 12l6.5 6.5" stroke={`url(#${cyanGradientId})`} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M38.5 51h17" stroke="white" strokeOpacity="0.46" strokeWidth="2.4" strokeLinecap="round" />
          </>
        ) : (
          <>
            <path d="m40 49 10.8-10.8c1.6-1.6 4.1-1.6 5.7 0s1.6 4.1 0 5.7L45.7 54.7 39 56l1-7Z" fill={`url(#${cyanGradientId})`} filter={`url(#${glowFilterId})`} />
            <path d="M49.2 39.8 54.8 45.4" stroke="white" strokeOpacity="0.6" strokeWidth="1.7" strokeLinecap="round" />
          </>
        )}
      </>,
    );
  }

  if (kind === "scene_sound") {
    return renderIconSvg(
      <>
        <rect x="14" y="16" width="36" height="32" rx="10" fill={`url(#${glassGradientId})`} opacity="0.32" />
        <rect x="14" y="16" width="36" height="32" rx="10" stroke={`url(#${shineGradientId})`} strokeWidth="2.8" />
        <path
          d="M21 34h4l5 6V24l-5 6h-4v4Z"
          fill={`url(#${cyanGradientId})`}
          filter={`url(#${glowFilterId})`}
        />
        <path
          d="M37 27.5c1.5 1.2 2.4 2.8 2.4 4.5s-.9 3.3-2.4 4.5M42 23.5c2.6 2.2 4 5.2 4 8.5s-1.4 6.3-4 8.5"
          stroke={`url(#${violetGradientId})`}
          strokeLinecap="round"
          strokeWidth="3.2"
        />
      </>,
    );
  }

  if (kind === "voiceover") {
    return renderIconSvg(
      <>
        <rect x="15" y="14" width="34" height="36" rx="11" fill={`url(#${glassGradientId})`} opacity="0.32" />
        <rect x="15" y="14" width="34" height="36" rx="11" stroke={`url(#${shineGradientId})`} strokeWidth="2.8" filter={`url(#${glowFilterId})`} />
        <rect x="26" y="18" width="12" height="22" rx="6" fill={`url(#${cyanGradientId})`} filter={`url(#${glowFilterId})`} />
        <path d="M21.5 31.5a10.5 10.5 0 0 0 21 0M32 42v6M26.5 48h11" stroke={`url(#${violetGradientId})`} strokeWidth="3.1" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M41 20.5c2.8 2.2 4.4 5.5 4.4 9.1M23 20.5c-2.8 2.2-4.4 5.5-4.4 9.1" stroke="white" strokeOpacity="0.48" strokeWidth="2.2" strokeLinecap="round" />
        <path d="m48.5 11.5 1.8 4 4.2 1.6-4.2 1.6-1.8 4-1.8-4-4.2-1.6 4.2-1.6 1.8-4Z" fill="white" opacity="0.92" />
      </>,
    );
  }

  return renderIconSvg(
    <>
      <rect x="15" y="15" width="34" height="34" rx="9" fill={`url(#${glassGradientId})`} opacity="0.3" />
      <rect x="15" y="15" width="34" height="34" rx="9" stroke={`url(#${shineGradientId})`} strokeWidth="2.8" filter={`url(#${glowFilterId})`} />
      <path d="M25 28v-8h8M25 20l12 12M39 36v8h-8M39 44 27 32" stroke={`url(#${cyanGradientId})`} strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" filter={`url(#${glowFilterId})`} />
      <path d="m48.5 11.5 1.8 4 4.2 1.6-4.2 1.6-1.8 4-1.8-4-4.2-1.6 4.2-1.6 1.8-4Z" fill="white" opacity="0.92" />
    </>,
  );
};
export const renderSegmentEditorPromptToolButtonContent = (
  kind:
    | "ai_photo"
    | "ai_video"
    | "library"
    | "upload"
    | "photo_animation"
    | "talking_photo"
    | "image_edit"
    | "image_upscale"
    | "scene_sound"
    | "voiceover"
    | "brand",
  label: string,
  description?: string,
  meta?: ReactNode,
) => (
  <span className="studio-segment-editor__prompt-tool-button-content">
    {renderSegmentEditorPromptToolIcon(kind)}
    <span className="studio-segment-editor__prompt-tool-label">
      <strong>{label}</strong>
      {description ? <small>{description}</small> : null}
    </span>
    {meta ? <span className="studio-segment-editor__prompt-tool-meta">{meta}</span> : null}
  </span>
);
