type WorkspaceSegmentEditorBrandOverlayProps = {
  brandLogoPreviewUrl: string | null;
  brandSummary: string;
  brandText: string;
  hasBranding: boolean;
  variant?: "card" | "thumb" | "ghost";
};

export function WorkspaceSegmentEditorBrandOverlay({
  brandLogoPreviewUrl,
  brandSummary,
  brandText,
  hasBranding,
  variant = "card",
}: WorkspaceSegmentEditorBrandOverlayProps) {
  if (!hasBranding) {
    return null;
  }

  const normalizedBrandText = brandText.trim();
  const brandTitle = brandSummary;
  const brandOverlayClassName = `studio-segment-editor__brand-overlay studio-segment-editor__brand-overlay--${variant}${
    brandLogoPreviewUrl ? " has-logo" : ""
  }${normalizedBrandText ? " has-text" : ""}`;

  return (
    <span className={brandOverlayClassName} title={brandTitle} aria-hidden="true">
      {brandLogoPreviewUrl ? <img src={brandLogoPreviewUrl} alt="" /> : null}
      {normalizedBrandText ? <span className="studio-segment-editor__brand-value">{normalizedBrandText}</span> : null}
    </span>
  );
}
