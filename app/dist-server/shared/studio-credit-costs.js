export const STUDIO_STANDARD_VIDEO_GENERATION_CREDIT_COST = 10;
export const STUDIO_AI_PHOTO_VIDEO_GENERATION_CREDIT_COST = 10;
export const STUDIO_AI_VIDEO_GENERATION_CREDIT_COST = 80;
export const STUDIO_PREMIUM_VIDEO_GENERATION_CREDIT_COST = STUDIO_AI_PHOTO_VIDEO_GENERATION_CREDIT_COST;
export const STUDIO_EDIT_VIDEO_GENERATION_CREDIT_COST = 5;
export const STUDIO_PREMIUM_VOICE_CREDIT_COST = 0;
export const STUDIO_VIDEO_GENERATION_CREDIT_COST = STUDIO_STANDARD_VIDEO_GENERATION_CREDIT_COST;
export const STUDIO_SEGMENT_AI_VIDEO_STANDARD_CREDIT_COST = 7;
export const STUDIO_SEGMENT_AI_VIDEO_PREMIUM_CREDIT_COST = 15;
export const STUDIO_SEGMENT_AI_VIDEO_CREDIT_COST = STUDIO_SEGMENT_AI_VIDEO_STANDARD_CREDIT_COST;
export const STUDIO_SEGMENT_PHOTO_ANIMATION_STANDARD_5S_CREDIT_COST = 5;
export const STUDIO_SEGMENT_PHOTO_ANIMATION_STANDARD_8S_CREDIT_COST = 8;
export const STUDIO_SEGMENT_PHOTO_ANIMATION_PREMIUM_5S_CREDIT_COST = 10;
export const STUDIO_SEGMENT_PHOTO_ANIMATION_PREMIUM_10S_CREDIT_COST = 20;
export const STUDIO_SEGMENT_PHOTO_ANIMATION_STANDARD_CREDIT_COST = STUDIO_SEGMENT_PHOTO_ANIMATION_STANDARD_5S_CREDIT_COST;
export const STUDIO_SEGMENT_PHOTO_ANIMATION_PREMIUM_CREDIT_COST = STUDIO_SEGMENT_PHOTO_ANIMATION_PREMIUM_5S_CREDIT_COST;
export const STUDIO_SEGMENT_PHOTO_ANIMATION_CREDIT_COST = STUDIO_SEGMENT_PHOTO_ANIMATION_STANDARD_CREDIT_COST;
export const STUDIO_SEGMENT_TALKING_PHOTO_CREDIT_COST = 10;
export const STUDIO_SEGMENT_TALKING_PHOTO_CREDITS_PER_SECOND = 2;
export const STUDIO_SEGMENT_TALKING_PHOTO_WORDS_PER_SECOND = 2.2;
export const STUDIO_SEGMENT_IMAGE_EDIT_CREDIT_COST = 5;
export const STUDIO_SEGMENT_AI_PHOTO_STANDARD_CREDIT_COST = 2;
export const STUDIO_SEGMENT_AI_PHOTO_PREMIUM_CREDIT_COST = 2;
export const STUDIO_SEGMENT_AI_PHOTO_CREDIT_COST = STUDIO_SEGMENT_AI_PHOTO_STANDARD_CREDIT_COST;
export const STUDIO_WORKSPACE_CHARACTER_REFERENCE_CREDIT_COST = 10;
export const STUDIO_SEGMENT_IMAGE_UPSCALE_CREDIT_COST = 1;
export const STUDIO_SEGMENT_INFOGRAPHIC_CREDIT_COST = 2;
export const STUDIO_SEGMENT_SCENE_SOUND_CREDIT_COST_PER_5_SECONDS = 2;
export const STUDIO_SEGMENT_SCENE_SOUND_CREDIT_COST = STUDIO_SEGMENT_SCENE_SOUND_CREDIT_COST_PER_5_SECONDS;
export const STUDIO_SEGMENT_VOICEOVER_CREDIT_COST = 1;
export const STUDIO_SEGMENT_PREMIUM_VOICEOVER_CREDIT_COST = STUDIO_SEGMENT_VOICEOVER_CREDIT_COST;
export const STUDIO_VOICEOVER_CHARACTERS_PER_CREDIT = 100;
export const STUDIO_SEGMENT_VOICEOVER_MAX_TEXT_CHARS = 200;
export const getStudioSegmentSceneSoundCreditCost = (durationSeconds) => {
    const normalizedDuration = Number.isFinite(durationSeconds) ? Math.max(0, Number(durationSeconds)) : 0;
    const fiveSecondBlocks = Math.max(1, Math.ceil(normalizedDuration / 5));
    return fiveSecondBlocks * STUDIO_SEGMENT_SCENE_SOUND_CREDIT_COST_PER_5_SECONDS;
};
export const STUDIO_PREMIUM_VOICE_IDS = [
    "Liam",
    "Liam_Timing",
    "Elena",
    "English_ManWithDeepVoice",
    "Russian_BrightHeroine",
];
export const STUDIO_SEGMENT_AI_PHOTO_CREDIT_COST_BY_QUALITY = {
    premium: STUDIO_SEGMENT_AI_PHOTO_PREMIUM_CREDIT_COST,
    standard: STUDIO_SEGMENT_AI_PHOTO_STANDARD_CREDIT_COST,
};
export const STUDIO_SEGMENT_AI_VIDEO_CREDIT_COST_BY_QUALITY = {
    premium: STUDIO_SEGMENT_AI_VIDEO_PREMIUM_CREDIT_COST,
    standard: STUDIO_SEGMENT_AI_VIDEO_STANDARD_CREDIT_COST,
};
export const STUDIO_SEGMENT_PHOTO_ANIMATION_CREDIT_COST_BY_QUALITY = {
    premium: STUDIO_SEGMENT_PHOTO_ANIMATION_PREMIUM_CREDIT_COST,
    standard: STUDIO_SEGMENT_PHOTO_ANIMATION_STANDARD_CREDIT_COST,
};
export const STUDIO_SEGMENT_PHOTO_ANIMATION_DURATION_OPTIONS_BY_QUALITY = {
    premium: [5, 10],
    standard: [5, 8],
};
export const STUDIO_SEGMENT_PHOTO_ANIMATION_CREDIT_COST_BY_QUALITY_AND_DURATION = {
    premium: {
        5: STUDIO_SEGMENT_PHOTO_ANIMATION_PREMIUM_5S_CREDIT_COST,
        10: STUDIO_SEGMENT_PHOTO_ANIMATION_PREMIUM_10S_CREDIT_COST,
    },
    standard: {
        5: STUDIO_SEGMENT_PHOTO_ANIMATION_STANDARD_5S_CREDIT_COST,
        8: STUDIO_SEGMENT_PHOTO_ANIMATION_STANDARD_8S_CREDIT_COST,
    },
};
export const getStudioSegmentPhotoAnimationDurationOptions = (quality) => STUDIO_SEGMENT_PHOTO_ANIMATION_DURATION_OPTIONS_BY_QUALITY[quality] ??
    STUDIO_SEGMENT_PHOTO_ANIMATION_DURATION_OPTIONS_BY_QUALITY.standard;
export const normalizeStudioSegmentPhotoAnimationDurationSeconds = (quality, durationSeconds) => {
    const options = getStudioSegmentPhotoAnimationDurationOptions(quality);
    const numeric = Number(durationSeconds);
    if (!Number.isFinite(numeric) || numeric <= 0) {
        return options[0] ?? 5;
    }
    const rounded = Math.round(numeric);
    if (options.includes(rounded)) {
        return rounded;
    }
    const [shortDuration, longDuration] = options;
    if (!shortDuration || !longDuration) {
        return shortDuration ?? 5;
    }
    return numeric > (shortDuration + longDuration) / 2 ? longDuration : shortDuration;
};
export const getStudioSegmentPhotoAnimationCreditCost = (quality, durationSeconds) => {
    const normalizedDurationSeconds = normalizeStudioSegmentPhotoAnimationDurationSeconds(quality, durationSeconds);
    return (STUDIO_SEGMENT_PHOTO_ANIMATION_CREDIT_COST_BY_QUALITY_AND_DURATION[quality]?.[normalizedDurationSeconds] ??
        STUDIO_SEGMENT_PHOTO_ANIMATION_CREDIT_COST_BY_QUALITY[quality] ??
        STUDIO_SEGMENT_PHOTO_ANIMATION_CREDIT_COST);
};
export const getStudioSegmentVoiceoverCreditCost = (voiceId) => {
    const normalizedVoiceId = String(voiceId ?? "").trim();
    if (!normalizedVoiceId || normalizedVoiceId.toLowerCase() === "none") {
        return 0;
    }
    return STUDIO_SEGMENT_VOICEOVER_CREDIT_COST;
};
export const normalizeStudioVoiceoverBillingText = (text) => String(text ?? "").trim().replace(/\s+/gu, " ");
export const getStudioVoiceoverCharacterCount = (text) => Array.from(normalizeStudioVoiceoverBillingText(text)).length;
export const getStudioVoiceoverCreditCostForText = (text) => {
    const characterCount = getStudioVoiceoverCharacterCount(text);
    return characterCount > 0 ? Math.ceil(characterCount / STUDIO_VOICEOVER_CHARACTERS_PER_CREDIT) : 0;
};
export const buildStudioVoiceoverProviderText = (segmentTexts) => segmentTexts
    .map(normalizeStudioVoiceoverBillingText)
    .filter(Boolean)
    .map((text) => (/[.!?…]$/u.test(text) ? text : `${text}.`))
    .join(" ");
export const buildStudioBatchVoiceoverBillingRuns = (groups) => {
    const targets = (groups ?? [])
        .flatMap((group) => {
        const language = String(group.language ?? "").trim().toLowerCase();
        const voiceType = String(group.voiceType ?? "").trim();
        if (!voiceType || voiceType.toLowerCase() === "none") {
            return [];
        }
        const fingerprint = `${language}:${voiceType.toLowerCase()}`;
        return (group.segments ?? []).flatMap((segment, position) => {
            const text = normalizeStudioVoiceoverBillingText(segment.text);
            if (!text) {
                return [];
            }
            const rawSegmentIndex = Number(segment.segmentIndex);
            const segmentIndex = Number.isInteger(rawSegmentIndex) && rawSegmentIndex >= 0
                ? rawSegmentIndex
                : position;
            return [{ fingerprint, language, segmentIndex, text, voiceType }];
        });
    })
        .sort((left, right) => left.segmentIndex - right.segmentIndex);
    const runs = [];
    const seenSegmentIndexes = new Set();
    for (const target of targets) {
        if (seenSegmentIndexes.has(target.segmentIndex)) {
            continue;
        }
        seenSegmentIndexes.add(target.segmentIndex);
        const previousRun = runs[runs.length - 1];
        if (previousRun?.fingerprint === target.fingerprint) {
            previousRun.segmentIndexes.push(target.segmentIndex);
            previousRun.texts.push(target.text);
            continue;
        }
        runs.push({
            fingerprint: target.fingerprint,
            language: target.language,
            segmentIndexes: [target.segmentIndex],
            texts: [target.text],
            voiceType: target.voiceType,
        });
    }
    return runs.map((run) => {
        const text = buildStudioVoiceoverProviderText(run.texts);
        return {
            characterCount: getStudioVoiceoverCharacterCount(text),
            creditCost: getStudioVoiceoverCreditCostForText(text),
            language: run.language,
            segmentIndexes: run.segmentIndexes,
            text,
            voiceType: run.voiceType,
        };
    });
};
export const getStudioBatchVoiceoverCreditCost = (groups) => buildStudioBatchVoiceoverBillingRuns(groups).reduce((total, run) => total + run.creditCost, 0);
export const getStudioSegmentTalkingPhotoCreditCostForDuration = (durationSeconds) => {
    const duration = Number(durationSeconds);
    if (!Number.isFinite(duration) || duration <= 0) {
        return STUDIO_SEGMENT_TALKING_PHOTO_CREDIT_COST;
    }
    return Math.max(STUDIO_SEGMENT_TALKING_PHOTO_CREDIT_COST, Math.ceil(duration * STUDIO_SEGMENT_TALKING_PHOTO_CREDITS_PER_SECOND));
};
export const estimateStudioSegmentTalkingPhotoScriptDurationSeconds = (script) => {
    const normalizedScript = String(script ?? "").trim();
    if (!normalizedScript) {
        return 0;
    }
    const words = normalizedScript.match(/[0-9A-Za-zА-Яа-яЁё]+/g) ?? [];
    if (words.length > 0) {
        return words.length / STUDIO_SEGMENT_TALKING_PHOTO_WORDS_PER_SECOND;
    }
    return normalizedScript.replace(/\s+/g, "").length / 14;
};
export const getStudioSegmentTalkingPhotoCreditCost = (script) => {
    const normalizedScript = String(script ?? "").trim();
    if (!normalizedScript) {
        return 0;
    }
    return getStudioSegmentTalkingPhotoCreditCostForDuration(estimateStudioSegmentTalkingPhotoScriptDurationSeconds(normalizedScript));
};
export const STUDIO_CREDIT_COST_BY_ACTION = {
    video_generation: STUDIO_STANDARD_VIDEO_GENERATION_CREDIT_COST,
    ai_photo: STUDIO_SEGMENT_AI_PHOTO_CREDIT_COST,
    ai_video: STUDIO_SEGMENT_AI_VIDEO_CREDIT_COST,
    photo_animation: STUDIO_SEGMENT_PHOTO_ANIMATION_CREDIT_COST,
    talking_photo: STUDIO_SEGMENT_TALKING_PHOTO_CREDIT_COST,
    image_edit: STUDIO_SEGMENT_IMAGE_EDIT_CREDIT_COST,
    image_upscale: STUDIO_SEGMENT_IMAGE_UPSCALE_CREDIT_COST,
    infographic: STUDIO_SEGMENT_INFOGRAPHIC_CREDIT_COST,
    scene_sound: STUDIO_SEGMENT_SCENE_SOUND_CREDIT_COST,
    segment_voiceover: STUDIO_SEGMENT_VOICEOVER_CREDIT_COST,
};
