import { existsSync, readFileSync, statSync } from "node:fs";
import { extname, join } from "node:path";
import { env } from "./env.js";
export class StudioVoicePreviewNotFoundError extends Error {
    constructor(message = "Voice preview sample is not available.") {
        super(message);
        this.name = "StudioVoicePreviewNotFoundError";
    }
}
export const STUDIO_VOICE_PREVIEW_SAMPLES = {
    Liam: {
        fileName: "alexander-premium.wav",
        language: "ru",
    },
    English_ManWithDeepVoice: {
        fileName: "gleb-premium.wav",
        language: "ru",
    },
    Russian_BrightHeroine: {
        fileName: "tim-premium.wav",
        language: "ru",
    },
    Bys_24000: {
        fileName: "boris.wav",
        language: "ru",
    },
    Nec_24000: {
        fileName: "natalya.wav",
        language: "ru",
    },
    Tur_24000: {
        fileName: "taras.wav",
        language: "ru",
    },
    May_24000: {
        fileName: "marfa.wav",
        language: "ru",
    },
    Ost_24000: {
        fileName: "alexandra.wav",
        language: "ru",
    },
    Pon_24000: {
        fileName: "sergey.wav",
        language: "ru",
    },
    "male-qn-jingying": {
        fileName: "aleksey.wav",
        language: "ru",
    },
    Aiden: {
        fileName: "aiden.wav",
        language: "en",
    },
    Ryan: {
        fileName: "ryan.wav",
        language: "en",
    },
    Serena: {
        fileName: "serena.wav",
        language: "en",
    },
    Vivian: {
        fileName: "vivian.wav",
        language: "en",
    },
    Uncle_Fu: {
        fileName: "uncle-fu.wav",
        language: "en",
    },
    Dylan: {
        fileName: "dylan.wav",
        language: "en",
    },
    Eric: {
        fileName: "eric.wav",
        language: "en",
    },
    Ono_Anna: {
        fileName: "ono-anna.wav",
        language: "en",
    },
    Sohee: {
        fileName: "sohee.wav",
        language: "en",
    },
};
const staticPreviewDirs = [
    join(env.rootDir, "public", "voice-previews"),
    join(env.rootDir, "dist", "voice-previews"),
];
const voiceAliases = new Map([
    ["male", "Aiden"],
    ["female", "Serena"],
    ["aiden", "Aiden"],
    ["ryan", "Ryan"],
    ["serena", "Serena"],
    ["vivian", "Vivian"],
    ["uncle_fu", "Uncle_Fu"],
    ["uncle fu", "Uncle_Fu"],
    ["dylan", "Dylan"],
    ["eric", "Eric"],
    ["ono_anna", "Ono_Anna"],
    ["ono anna", "Ono_Anna"],
    ["sohee", "Sohee"],
    ["liam", "Liam"],
    ["alexander", "Liam"],
    ["alexandr", "Liam"],
    ["aleksandr", "Liam"],
    ["александр", "Liam"],
    ["english_manwithdeepvoice", "English_ManWithDeepVoice"],
    ["english_man_with_deep_voice", "English_ManWithDeepVoice"],
    ["gleb", "English_ManWithDeepVoice"],
    ["глеб", "English_ManWithDeepVoice"],
    ["russian_brightheroine", "Russian_BrightHeroine"],
    ["russian_bright_heroine", "Russian_BrightHeroine"],
    ["tim", "Russian_BrightHeroine"],
    ["тим", "Russian_BrightHeroine"],
    ["arina", "Russian_BrightHeroine"],
    ["арина", "Russian_BrightHeroine"],
    ["bys_24000", "Bys_24000"],
    ["nec_24000", "Nec_24000"],
    ["tur_24000", "Tur_24000"],
    ["may_24000", "May_24000"],
    ["ost_24000", "Ost_24000"],
    ["pon_24000", "Pon_24000"],
    ["male_qn_jingying", "male-qn-jingying"],
    ["aleksey", "male-qn-jingying"],
    ["alexey", "male-qn-jingying"],
    ["алексей", "male-qn-jingying"],
]);
const normalizePreviewLanguage = (value) => {
    const normalized = String(value ?? "").trim().toLowerCase();
    if (!normalized) {
        return null;
    }
    return normalized === "en" ? "en" : "ru";
};
const normalizeVoiceKey = (value) => String(value ?? "").trim().toLowerCase().replace(/[-\s]+/g, "_");
const resolveVoiceId = (value) => {
    const normalized = normalizeVoiceKey(value);
    if (!normalized) {
        return null;
    }
    return voiceAliases.get(normalized) ?? null;
};
const getStaticPreviewPath = (fileName) => {
    for (const previewDir of staticPreviewDirs) {
        const filePath = join(previewDir, fileName);
        if (!existsSync(filePath)) {
            continue;
        }
        const fileStat = statSync(filePath);
        if (fileStat.isFile() && fileStat.size > 0) {
            return filePath;
        }
    }
    return null;
};
const getContentType = (fileName) => {
    switch (extname(fileName).toLowerCase()) {
        case ".mp3":
            return "audio/mpeg";
        case ".wav":
        default:
            return "audio/wav";
    }
};
export async function getStudioVoicePreview(options) {
    const voiceId = resolveVoiceId(options?.voiceId);
    if (!voiceId) {
        throw new StudioVoicePreviewNotFoundError("Unsupported voice preview sample.");
    }
    const sample = STUDIO_VOICE_PREVIEW_SAMPLES[voiceId];
    const language = normalizePreviewLanguage(options?.language);
    if (language && language !== sample.language) {
        throw new StudioVoicePreviewNotFoundError("Voice preview sample is not available for the requested language.");
    }
    const filePath = getStaticPreviewPath(sample.fileName);
    if (!filePath) {
        throw new StudioVoicePreviewNotFoundError(`Missing voice preview sample: ${sample.fileName}`);
    }
    return {
        audio: readFileSync(filePath),
        contentType: getContentType(sample.fileName),
    };
}
