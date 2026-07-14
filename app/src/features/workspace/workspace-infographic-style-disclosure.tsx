import { useEffect, useId, useState } from "react";

import {
  getWorkspaceSegmentInfographicCharacterCount,
  truncateWorkspaceSegmentInfographicText,
} from "./workspace-infographic-helpers";

export type WorkspaceInfographicStyleDisclosureProps = {
  label: string;
  maxCharacters: number;
  onChange: (value: string) => void;
  placeholder: string;
  textareaClassName?: string;
  value: string;
};

export const WorkspaceInfographicStyleDisclosure = ({
  label,
  maxCharacters,
  onChange,
  placeholder,
  textareaClassName,
  value,
}: WorkspaceInfographicStyleDisclosureProps) => {
  const textareaId = useId();
  const [isOpen, setIsOpen] = useState(Boolean(value.trim()));

  useEffect(() => {
    if (value.trim()) {
      setIsOpen(true);
    }
  }, [value]);

  return (
    <details
      className="studio-segment-editor__infographic-style-disclosure"
      open={isOpen}
      onToggle={(event) => setIsOpen(event.currentTarget.open)}
    >
      <summary aria-controls={textareaId}>
        <strong>{label}</strong>
        <small>
          {getWorkspaceSegmentInfographicCharacterCount(value)}/{maxCharacters}
        </small>
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <path d="m4 6 4 4 4-4" />
        </svg>
      </summary>
      <div className="studio-segment-editor__infographic-style-body studio-segment-editor__infographic-field">
        <textarea
          id={textareaId}
          aria-label={label}
          className={textareaClassName}
          value={value}
          rows={3}
          placeholder={placeholder}
          onChange={(event) => {
            onChange(truncateWorkspaceSegmentInfographicText(event.target.value, maxCharacters));
          }}
        />
      </div>
    </details>
  );
};
