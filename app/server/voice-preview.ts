import { existsSync, readFileSync, statSync } from "node:fs";
import { extname, join } from "node:path";

import { env } from "./env.js";

type StudioLanguage = "ru" | "en";

type StudioVoicePreviewResult = {
  audio: Buffer;
  contentType: string;
};

type StudioVoicePreviewSample = {
  fileName: string;
  language: StudioLanguage;
};

export class StudioVoicePreviewNotFoundError extends Error {
  constructor(message = "Voice preview sample is not available.") {
    super(message);
    this.name = "StudioVoicePreviewNotFoundError";
  }
}

export const STUDIO_VOICE_PREVIEW_SAMPLES: Record<string, StudioVoicePreviewSample> = {
  Liam: {
    fileName: "alexander-premium.wav",
    language: "ru",
  },
  Liam_Timing: {
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
  Russian_Mikhail: {
    fileName: "mikhail.wav",
    language: "ru",
  },
  Russian_ReliableMan: {
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

const voiceAliases = new Map<string, keyof typeof STUDIO_VOICE_PREVIEW_SAMPLES>([
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
  ["liam_timing", "Liam_Timing"],
  ["alexander_timing", "Liam_Timing"],
  ["alexandr_timing", "Liam_Timing"],
  ["aleksandr_timing", "Liam_Timing"],
  ["александр_timing", "Liam_Timing"],
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
  ["natalya", "Nec_24000"],
  ["natalia", "Nec_24000"],
  ["наталья", "Nec_24000"],
  ["tur_24000", "Tur_24000"],
  ["taras", "Tur_24000"],
  ["тарас", "Tur_24000"],
  ["vladimir", "Tur_24000"],
  ["владимир", "Tur_24000"],
  ["may_24000", "May_24000"],
  ["marfa", "May_24000"],
  ["марфа", "May_24000"],
  ["ekaterina", "May_24000"],
  ["екатерина", "May_24000"],
  ["ost_24000", "Ost_24000"],
  ["alexandra", "Ost_24000"],
  ["александра", "Ost_24000"],
  ["mikhail", "Russian_Mikhail"],
  ["russian_mikhail", "Russian_Mikhail"],
  ["михаил", "Russian_Mikhail"],
  ["pon_24000", "Russian_ReliableMan"],
  ["russian_reliableman", "Russian_ReliableMan"],
  ["russian reliableman", "Russian_ReliableMan"],
  ["male_qn_jingying", "male-qn-jingying"],
  ["aleksey", "male-qn-jingying"],
  ["alexey", "male-qn-jingying"],
  ["алексей", "male-qn-jingying"],
]);

const normalizePreviewLanguage = (value: string | null | undefined): StudioLanguage | null => {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  return normalized === "en" ? "en" : "ru";
};

const normalizeVoiceKey = (value: string | null | undefined) =>
  String(value ?? "").trim().toLowerCase().replace(/[-\s]+/g, "_");

const resolveVoiceId = (value: string | null | undefined): keyof typeof STUDIO_VOICE_PREVIEW_SAMPLES | null => {
  const normalized = normalizeVoiceKey(value);
  if (!normalized) {
    return null;
  }

  return voiceAliases.get(normalized) ?? null;
};

const getStaticPreviewPath = (fileName: string) => {
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

const getContentType = (fileName: string) => {
  switch (extname(fileName).toLowerCase()) {
    case ".mp3":
      return "audio/mpeg";
    case ".wav":
    default:
      return "audio/wav";
  }
};

export async function getStudioVoicePreview(options?: {
  language?: string | null;
  voiceId?: string | null;
}): Promise<StudioVoicePreviewResult> {
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
