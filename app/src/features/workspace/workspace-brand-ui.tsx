import type { MouseEvent as ReactMouseEvent } from "react";
import type { Locale } from "../../lib/i18n";
import { workspaceText } from "./workspace-page-model";

type WorkspaceSegmentEditorBrandOverlayProps = {
  brandLogoPreviewUrl: string | null;
  brandSummary: string;
  brandText: string;
  editable?: boolean;
  hasBranding: boolean;
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
  locale,
  onEdit,
  variant = "card",
}: WorkspaceSegmentEditorBrandOverlayProps) {
  if (!hasBranding) {
    return null;
  }

  const normalizedBrandText = brandText.trim();
  const editBrandLabel = workspaceText(locale, "Бренд ✏️", "Brand ✏️");
  const brandTitle = brandSummary;
  const isEditable = variant === "card" && editable;
  const brandOverlayBaseClassName = `studio-segment-editor__brand-overlay studio-segment-editor__brand-overlay--${variant}${
    brandLogoPreviewUrl ? " has-logo" : ""
  }${normalizedBrandText ? " has-text" : ""}`;
  const brandOverlayClassName = `${brandOverlayBaseClassName}${
    isEditable ? " studio-segment-editor__brand-overlay--editable" : ""
  }`;
  const brandDisplayContent = (
    <>
      {brandLogoPreviewUrl ? <img src={brandLogoPreviewUrl} alt="" /> : null}
      {normalizedBrandText ? <span className="studio-segment-editor__brand-value">{normalizedBrandText}</span> : null}
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
  locale: Locale;
  onClick: (event: ReactMouseEvent<HTMLButtonElement>) => void;
};

export function WorkspaceSegmentEditorBrandAddButton({
  locale,
  onClick,
}: WorkspaceSegmentEditorBrandAddButtonProps) {
  const brandButtonLabel = workspaceText(locale, "Добавить бренд", "Add brand");

  return (
    <button
      className="studio-segment-editor__brand-add"
      type="button"
      aria-label={brandButtonLabel}
      title={brandButtonLabel}
      onPointerDown={(event) => {
        event.stopPropagation();
      }}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onClick(event);
      }}
    >
      <span className="studio-segment-editor__brand-add-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24">
          <path d="M5.5 6.5h8.7l4.3 4.3v6.7H5.5z" />
          <path d="M14.2 6.5v4.3h4.3M9.5 14h5M12 11.5v5" />
        </svg>
      </span>
      <span className="studio-segment-editor__brand-add-copy">
        <strong>{workspaceText(locale, "Бренд", "Brand")}</strong>
        <small>{workspaceText(locale, "Лого или текст", "Logo or text")}</small>
      </span>
      <svg className="studio-segment-editor__brand-add-arrow" viewBox="0 0 20 20" aria-hidden="true">
        <path d="m7.5 5 5 5-5 5" />
      </svg>
    </button>
  );
}
