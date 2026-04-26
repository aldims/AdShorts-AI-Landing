import { isSupportedLocale } from "./locales.js";
const normalizeText = (value) => String(value ?? "").replace(/\s+/g, " ").trim();
export const normalizeExamplePrefillStudioSettings = (value) => {
    if (!value || typeof value !== "object") {
        return null;
    }
    const payload = value;
    const settings = {};
    const language = normalizeText(payload.language);
    const musicType = normalizeText(payload.musicType);
    const subtitleColorId = normalizeText(payload.subtitleColorId);
    const subtitleStyleId = normalizeText(payload.subtitleStyleId);
    const videoMode = normalizeText(payload.videoMode);
    const voiceId = normalizeText(payload.voiceId);
    const brandText = normalizeText(payload.brandText);
    if (isSupportedLocale(language)) {
        settings.language = language;
    }
    if (musicType) {
        settings.musicType = musicType;
    }
    if (subtitleColorId) {
        settings.subtitleColorId = subtitleColorId;
    }
    if (typeof payload.subtitleEnabled === "boolean") {
        settings.subtitleEnabled = payload.subtitleEnabled;
    }
    if (subtitleStyleId) {
        settings.subtitleStyleId = subtitleStyleId;
    }
    if (videoMode) {
        settings.videoMode = videoMode;
    }
    if (typeof payload.voiceEnabled === "boolean") {
        settings.voiceEnabled = payload.voiceEnabled;
    }
    if (voiceId) {
        settings.voiceId = voiceId;
    }
    if (brandText) {
        settings.brandText = brandText;
    }
    return Object.keys(settings).length ? settings : null;
};
export const normalizeExamplePrefillIntent = (value) => {
    if (!value || typeof value !== "object") {
        return null;
    }
    const payload = value;
    const exampleId = normalizeText(payload.exampleId);
    const prompt = normalizeText(payload.prompt);
    if (!exampleId || !prompt) {
        return null;
    }
    return {
        exampleId,
        prompt,
        settings: normalizeExamplePrefillStudioSettings(payload.settings),
    };
};
