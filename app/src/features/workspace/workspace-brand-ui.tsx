import type { MouseEvent as ReactMouseEvent } from "react";
import type { Locale } from "../../lib/i18n";
import { workspaceText } from "./workspace-page-model";

type WorkspaceSegmentEditorBrandOverlayProps = {
  brandLogoPreviewUrl: string | null;
  brandSummary: string;
  brandText: string;
  editable?: boolean;
  hasBranding: boolean;
  hasSystemWatermark: boolean;
  locale: Locale;
  onEdit: (event: ReactMouseEvent<HTMLButtonElement>) => void;
  variant?: "card" | "thumb" | "ghost";
};

export function WorkspaceSegmentEditorBrandOverlay({
  brandLogoPreviewUrl,
  brandSummary,
  brandText,
  editable = false,
  hasBranding,
  hasSystemWatermark,
  locale,
  onEdit,
  variant = "card",
}: WorkspaceSegmentEditorBrandOverlayProps) {
  if (!hasBranding && !hasSystemWatermark) {
    return null;
  }

  const normalizedBrandText = brandText.trim();
  const systemWatermarkText = workspaceText(locale, "Сделано в adshortsai.com", "Made with adshortsai.com");
  const editBrandLabel = workspaceText(locale, "Изменить бренд", "Edit brand");
  const brandTitle = [
    hasBranding ? brandSummary : "",
    hasSystemWatermark ? systemWatermarkText : "",
  ].filter(Boolean).join(" · ");
  const isEditable = variant === "card" && editable;
  const brandOverlayBaseClassName = `studio-segment-editor__brand-overlay studio-segment-editor__brand-overlay--${variant}${
    brandLogoPreviewUrl ? " has-logo" : ""
  }${normalizedBrandText || hasSystemWatermark ? " has-text" : ""}${
    hasSystemWatermark ? " has-system-watermark" : ""
  }`;
  const brandOverlayClassName = `${brandOverlayBaseClassName}${
    isEditable ? " studio-segment-editor__brand-overlay--editable" : ""
  }`;
  const brandDisplayContent = (
    <>
      {brandLogoPreviewUrl ? <img src={brandLogoPreviewUrl} alt="" /> : null}
      {normalizedBrandText ? <span className="studio-segment-editor__brand-value">{normalizedBrandText}</span> : null}
      {hasSystemWatermark ? (
        <span className="studio-segment-editor__brand-value">{systemWatermarkText}</span>
      ) : null}
    </>
  );

  if (isEditable) {
    return (
      <>
        <span
          className={`${brandOverlayBaseClassName} studio-segment-editor__brand-overlay--backdrop`}
          title={brandTitle}
          aria-hidden="true"
        >
          {brandDisplayContent}
        </span>
        <button
          className={`${brandOverlayClassName} studio-segment-editor__brand-overlay--edit-hitbox`}
          type="button"
          aria-label={editBrandLabel}
          title={brandTitle ? `${editBrandLabel}: ${brandTitle}` : editBrandLabel}
          onPointerDown={(event) => {
            event.stopPropagation();
          }}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            onEdit(event);
          }}
        >
          {brandDisplayContent}
          <span className="studio-segment-editor__brand-edit-label">{editBrandLabel}</span>
        </button>
      </>
    );
  }

  return (
    <span className={brandOverlayClassName} title={brandTitle} aria-hidden="true">
      {brandDisplayContent}
    </span>
  );
}

type WorkspaceSegmentEditorBrandAddButtonProps = {
  hasBranding: boolean;
  locale: Locale;
  onClick: (event: ReactMouseEvent<HTMLButtonElement>) => void;
};

export function WorkspaceSegmentEditorBrandAddButton({
  hasBranding,
  locale,
  onClick,
}: WorkspaceSegmentEditorBrandAddButtonProps) {
  const brandActionLabel = hasBranding
    ? workspaceText(locale, "Изменить бренд", "Edit brand")
    : workspaceText(locale, "Добавить бренд", "Add brand");

  return (
    <button
      className="studio-segment-editor__brand-add"
      type="button"
      aria-label={brandActionLabel}
      title={brandActionLabel}
      onPointerDown={(event) => {
        event.stopPropagation();
      }}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onClick(event);
      }}
    >
      {brandActionLabel}
    </button>
  );
}
