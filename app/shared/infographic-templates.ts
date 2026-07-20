export const INFOGRAPHIC_TEMPLATE_IDS = [
  "focus",
  "compare",
  "steps",
  "cards",
  "editorial",
] as const;

export type InfographicTemplateId = (typeof INFOGRAPHIC_TEMPLATE_IDS)[number];

export const isInfographicTemplateId = (value: unknown): value is InfographicTemplateId =>
  INFOGRAPHIC_TEMPLATE_IDS.includes(value as InfographicTemplateId);
