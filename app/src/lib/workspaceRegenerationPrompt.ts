const normalizeText = (value: unknown) => String(value ?? "").replace(/\s+/g, " ").trim();

export const resolveWorkspaceRegenerationPrompt = (options: {
  draftDescription?: string | null;
  generatedVideoAdId?: number | null;
  generatedVideoPrompt?: string | null;
  projectId?: number | null;
  projectPrompt?: string | null;
  topicInput?: string | null;
}) => {
  const matchesGeneratedVideo =
    Number.isInteger(options.generatedVideoAdId) &&
    Number.isInteger(options.projectId) &&
    Number(options.generatedVideoAdId) === Number(options.projectId);

  if (matchesGeneratedVideo) {
    const generatedPrompt = normalizeText(options.generatedVideoPrompt);
    if (generatedPrompt) {
      return generatedPrompt;
    }
  }

  const projectPrompt = normalizeText(options.projectPrompt);
  if (projectPrompt) {
    return projectPrompt;
  }

  const draftDescription = normalizeText(options.draftDescription);
  if (draftDescription) {
    return draftDescription;
  }

  return normalizeText(options.topicInput);
};
