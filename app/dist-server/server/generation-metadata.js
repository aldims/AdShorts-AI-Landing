const normalizeText = (value) => String(value ?? "").replace(/\s+/g, " ").trim();
const hasCyrillic = (value) => /[А-Яа-яЁё]/.test(value);
const hasLatin = (value) => /[A-Za-z]/.test(value);
const generationPlaceholderTitles = new Set([
    "generation",
    "ready",
    "shorts",
    "shorts video",
    "studio generation",
    "video",
    "video generation",
    "видео",
    "генерация",
    "готово",
    "готовое видео",
    "проект",
    "studio generation",
]);
const generationPlaceholderDescriptions = new Set([
    "description unavailable",
    "project description unavailable.",
    "video description unavailable.",
    "описание недоступно.",
    "описание проекта недоступно.",
    "описание проекта появится после завершения генерации.",
    "описание проекта появится после завершения генерации",
]);
const russianStopWords = new Set([
    "без",
    "более",
    "будет",
    "быть",
    "вам",
    "все",
    "для",
    "его",
    "если",
    "или",
    "как",
    "когда",
    "который",
    "мне",
    "можно",
    "над",
    "наш",
    "него",
    "неё",
    "них",
    "она",
    "они",
    "под",
    "после",
    "при",
    "про",
    "свой",
    "себя",
    "так",
    "тема",
    "это",
    "этот",
    "shorts",
    "шортс",
    "видео",
    "ролик",
    "сделай",
    "создай",
    "напиши",
]);
const englishStopWords = new Set([
    "about",
    "after",
    "before",
    "create",
    "make",
    "shorts",
    "story",
    "that",
    "this",
    "video",
    "with",
]);
export const normalizeGenerationMetadataText = (value) => normalizeText(value);
export const detectGenerationLanguage = (value, fallback = "ru") => {
    const normalized = normalizeText(value);
    if (!normalized) {
        return fallback;
    }
    if (hasCyrillic(normalized)) {
        return "ru";
    }
    if (hasLatin(normalized)) {
        return "en";
    }
    return fallback;
};
const buildPromptTitle = (prompt, fallback) => {
    const normalized = normalizeText(prompt);
    if (!normalized) {
        return fallback;
    }
    if (normalized.length <= 72) {
        return normalized;
    }
    const compact = normalized.slice(0, 69).trim();
    return compact ? `${compact}...` : fallback;
};
const normalizeHashtag = (value) => {
    const normalized = normalizeText(value)
        .replace(/^#+/, "")
        .replace(/[^\p{L}\p{N}_-]+/gu, "")
        .toLowerCase();
    if (!normalized || normalized.length < 2) {
        return null;
    }
    return `#${normalized}`;
};
export const parseGenerationHashtags = (value) => {
    if (Array.isArray(value)) {
        return Array.from(new Set(value
            .map((item) => normalizeHashtag(String(item ?? "")))
            .filter((item) => Boolean(item))));
    }
    const rawValue = normalizeText(value);
    if (!rawValue) {
        return [];
    }
    const explicitTags = rawValue.match(/#[^\s#]+/g);
    if (explicitTags?.length) {
        return Array.from(new Set(explicitTags
            .map((item) => normalizeHashtag(item))
            .filter((item) => Boolean(item))));
    }
    return Array.from(new Set(rawValue
        .split(/[\s,]+/)
        .map((item) => normalizeHashtag(item))
        .filter((item) => Boolean(item))));
};
export const serializeGenerationHashtags = (value) => parseGenerationHashtags(value).join(" ");
const buildHashtagsFromPrompt = (prompt, language) => {
    const normalizedPrompt = normalizeText(prompt).toLowerCase();
    if (!normalizedPrompt) {
        return [];
    }
    const stopWords = language === "en" ? englishStopWords : russianStopWords;
    const tokens = normalizedPrompt.match(/[\p{L}\p{N}]+/gu) ?? [];
    const hashtags = [];
    for (const token of tokens) {
        if (hashtags.length >= 5) {
            break;
        }
        if (token.length < 3 || /^\d+$/.test(token) || stopWords.has(token)) {
            continue;
        }
        const hashtag = normalizeHashtag(token);
        if (!hashtag || hashtags.includes(hashtag)) {
            continue;
        }
        hashtags.push(hashtag);
    }
    return hashtags;
};
const shouldFallbackTitle = (title, promptLanguage) => {
    const normalized = normalizeText(title);
    if (!normalized) {
        return true;
    }
    if (generationPlaceholderTitles.has(normalized.toLowerCase())) {
        return true;
    }
    return promptLanguage === "ru" && hasLatin(normalized) && !hasCyrillic(normalized);
};
const shouldFallbackDescription = (description, promptLanguage) => {
    const normalized = normalizeText(description);
    if (!normalized) {
        return true;
    }
    if (generationPlaceholderDescriptions.has(normalized.toLowerCase())) {
        return true;
    }
    return promptLanguage === "ru" && hasLatin(normalized) && !hasCyrillic(normalized);
};
export const resolveGenerationPresentation = (options) => {
    const prompt = normalizeText(options.prompt);
    const promptLanguage = detectGenerationLanguage(prompt, "ru");
    const fallbackTitle = normalizeText(options.fallbackTitle) || (promptLanguage === "ru" ? "Готовое видео" : "Ready video");
    const rawTitle = normalizeText(options.title);
    const rawDescription = normalizeText(options.description);
    const title = shouldFallbackTitle(rawTitle, promptLanguage) ? buildPromptTitle(prompt, fallbackTitle) : rawTitle;
    const description = shouldFallbackDescription(rawDescription, promptLanguage)
        ? prompt || rawDescription || title || fallbackTitle
        : rawDescription;
    const hashtags = parseGenerationHashtags(options.hashtags);
    return {
        description,
        hashtags: hashtags.length ? hashtags : buildHashtagsFromPrompt(prompt, promptLanguage),
        language: promptLanguage,
        prompt,
        title: title || buildPromptTitle(prompt, fallbackTitle),
    };
};
