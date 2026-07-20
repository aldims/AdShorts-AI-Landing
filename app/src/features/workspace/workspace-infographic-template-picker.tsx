import { useId } from "react";

import type { InfographicTemplateId } from "../../../shared/infographic-templates";

export type WorkspaceInfographicTemplateId = InfographicTemplateId;

export type WorkspaceInfographicTemplate = {
  descriptionEn: string;
  descriptionRu: string;
  id: WorkspaceInfographicTemplateId;
  imageSrc: string;
  stylePrompt: string;
  titleEn: string;
  titleRu: string;
};

export const WORKSPACE_INFOGRAPHIC_TEMPLATES: readonly WorkspaceInfographicTemplate[] = [
  {
    id: "focus",
    titleRu: "Акцент",
    titleEn: "Focus",
    descriptionRu: "Одна сильная мысль",
    descriptionEn: "One strong message",
    imageSrc: "/infographic-templates/focus.png",
    stylePrompt: "Focus template: one oversized key figure or headline, a compact supporting caption and one clean accent shape. Use only the supplied text. Sample 2–3 high-contrast colors from the source scene, preserve readability and keep the background transparent.",
  },
  {
    id: "compare",
    titleRu: "Сравнение",
    titleEn: "Compare",
    descriptionRu: "Два факта рядом",
    descriptionEn: "Two facts side by side",
    imageSrc: "/infographic-templates/compare.png",
    stylePrompt: "Comparison template: split the supplied text into two balanced columns or before/after blocks with a clear divider. Use only the supplied text. Sample 2–3 high-contrast colors from the source scene, preserve readability and keep the background transparent.",
  },
  {
    id: "steps",
    titleRu: "Шаги",
    titleEn: "Steps",
    descriptionRu: "Процесс по порядку",
    descriptionEn: "A sequence in order",
    imageSrc: "/infographic-templates/steps.png",
    stylePrompt: "Steps template: arrange the supplied text as a concise numbered sequence connected by a clean line; keep each step visually distinct. Use only the supplied text. Sample 2–3 high-contrast colors from the source scene and keep the background transparent.",
  },
  {
    id: "cards",
    titleRu: "Карточки",
    titleEn: "Cards",
    descriptionRu: "Несколько тезисов",
    descriptionEn: "Several key points",
    imageSrc: "/infographic-templates/cards.png",
    stylePrompt: "Cards template: split the supplied text into compact modular cards with a strong information hierarchy and restrained icons or markers. Use only the supplied text. Sample 2–3 high-contrast colors from the source scene and keep the background transparent.",
  },
  {
    id: "editorial",
    titleRu: "Редакционный",
    titleEn: "Editorial",
    descriptionRu: "Заголовок и детали",
    descriptionEn: "Headline and details",
    imageSrc: "/infographic-templates/editorial.png",
    stylePrompt: "Editorial template: create an elegant magazine-style headline, a small kicker and restrained rules or brackets from the supplied text. Use only the supplied text. Sample 2–3 high-contrast colors from the source scene, preserve readability and keep the background transparent.",
  },
] as const;

export const getWorkspaceInfographicTemplateByStylePrompt = (value: string | null | undefined) => {
  const normalizedValue = String(value ?? "").trim();
  return WORKSPACE_INFOGRAPHIC_TEMPLATES.find((template) => template.stylePrompt === normalizedValue) ?? null;
};

export const isWorkspaceInfographicTemplateStylePrompt = (value: string | null | undefined) =>
  Boolean(getWorkspaceInfographicTemplateByStylePrompt(value));

export type WorkspaceInfographicTemplatePickerProps = {
  disabled?: boolean;
  locale: string;
  onChange: (stylePrompt: string) => void;
  value: string;
};

export const WorkspaceInfographicTemplatePicker = ({
  disabled = false,
  locale,
  onChange,
  value,
}: WorkspaceInfographicTemplatePickerProps) => {
  const headingId = useId();
  const isEnglish = locale === "en";
  const selectedTemplate = getWorkspaceInfographicTemplateByStylePrompt(value);

  return (
    <section className="studio-infographic-templates" aria-labelledby={headingId}>
      <div className="studio-infographic-templates__head">
        <strong id={headingId}>{isEnglish ? "Template" : "Шаблон"}</strong>
        <small>
          <span aria-hidden="true" />
          {isEnglish ? "Matches scene colors" : "Подстроится под цвета сцены"}
        </small>
      </div>
      <div
        className="studio-infographic-templates__list"
        role="group"
        aria-label={isEnglish ? "Infographic template" : "Шаблон инфографики"}
      >
        {WORKSPACE_INFOGRAPHIC_TEMPLATES.map((template) => {
          const isSelected = selectedTemplate?.id === template.id;
          const title = isEnglish ? template.titleEn : template.titleRu;
          const description = isEnglish ? template.descriptionEn : template.descriptionRu;

          return (
            <button
              className={`studio-infographic-template${isSelected ? " is-selected" : ""}`}
              type="button"
              aria-pressed={isSelected}
              aria-label={`${title}. ${description}`}
              disabled={disabled}
              key={template.id}
              onClick={() => onChange(template.stylePrompt)}
            >
              <span
                className="studio-infographic-template__preview"
                data-template={template.id}
                aria-hidden="true"
              >
                <img
                  alt=""
                  decoding="async"
                  draggable={false}
                  loading="lazy"
                  src={template.imageSrc}
                />
              </span>
              <span className="studio-infographic-template__copy">
                <strong>{title}</strong>
                <small>{description}</small>
              </span>
              <span className="studio-infographic-template__check" aria-hidden="true">
                <svg viewBox="0 0 16 16">
                  <path d="m4 8.2 2.5 2.5L12 5.4" />
                </svg>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
};
