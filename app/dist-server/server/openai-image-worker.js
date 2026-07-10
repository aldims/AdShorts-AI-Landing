import { env } from "./env.js";
export class OpenAIImageProviderError extends Error {
    fallbackable;
    policy;
    status;
    constructor(message, options) {
        super(message);
        this.name = "OpenAIImageProviderError";
        this.fallbackable = options?.fallbackable ?? true;
        this.policy = options?.policy ?? false;
        this.status = options?.status;
    }
}
export const isOpenAIImagePolicyError = (error) => error instanceof OpenAIImageProviderError && error.policy;
const OPENAI_IMAGES_GENERATION_URL = "https://api.openai.com/v1/images/generations";
const OPENAI_IMAGES_EDIT_URL = "https://api.openai.com/v1/images/edits";
const OPENAI_TEMPORARY_STATUSES = new Set([408, 409, 429, 500, 502, 503, 504]);
const OPENAI_POLICY_CODES = new Set([
    "content_filter",
    "content_policy_violation",
    "invalid_prompt",
    "safety_system",
]);
const normalizeText = (value) => String(value ?? "").replace(/\s+/g, " ").trim();
const normalizeModel = (value) => normalizeText(value) || "gpt-image-2";
const normalizeQuality = (value, fallback) => {
    const normalized = normalizeText(value).toLowerCase();
    return normalized === "low" || normalized === "medium" || normalized === "high" || normalized === "auto"
        ? normalized
        : fallback;
};
const normalizeOutputFormat = (value, fallback) => {
    const normalized = normalizeText(value).toLowerCase();
    return normalized === "png" || normalized === "jpeg" || normalized === "webp" ? normalized : fallback;
};
const getOpenAIImageMimeType = (format) => {
    if (format === "jpeg")
        return "image/jpeg";
    if (format === "webp")
        return "image/webp";
    return "image/png";
};
const getOpenAIErrorMessage = (payload, fallback) => normalizeText(payload?.error?.message) || fallback;
const isOpenAIPolicyPayload = (status, payload) => {
    const code = normalizeText(payload?.error?.code).toLowerCase();
    const type = normalizeText(payload?.error?.type).toLowerCase();
    const message = normalizeText(payload?.error?.message).toLowerCase();
    return (OPENAI_POLICY_CODES.has(code) ||
        OPENAI_POLICY_CODES.has(type) ||
        (status === 400 &&
            (message.includes("content policy") ||
                message.includes("content_policy") ||
                message.includes("invalid prompt") ||
                message.includes("invalid_prompt") ||
                message.includes("safety"))));
};
const parseOpenAIImagePayload = async (response) => {
    try {
        return (await response.json());
    }
    catch {
        return null;
    }
};
const buildOpenAIImageError = (response, payload, operation) => {
    const policy = isOpenAIPolicyPayload(response.status, payload);
    const fallbackable = !policy && (OPENAI_TEMPORARY_STATUSES.has(response.status) || [400, 401, 403, 404].includes(response.status));
    return new OpenAIImageProviderError(getOpenAIErrorMessage(payload, `OpenAI ${operation} failed (${response.status}).`), {
        fallbackable,
        policy,
        status: response.status,
    });
};
const decodeOpenAIImage = (payload, options) => {
    const b64 = payload?.data?.[0]?.b64_json;
    if (!b64) {
        throw new OpenAIImageProviderError("OpenAI image response did not include b64_json.");
    }
    let bytes;
    try {
        bytes = Buffer.from(b64, "base64");
    }
    catch (error) {
        throw new OpenAIImageProviderError("OpenAI image response contained invalid base64.");
    }
    if (!bytes.length) {
        throw new OpenAIImageProviderError("OpenAI image response was empty.");
    }
    return {
        bytes,
        fileSize: bytes.length,
        meta: {
            model: options.model,
            outputFormat: options.outputFormat,
            provider: "openai",
            quality: options.quality,
            requestId: options.requestId,
            size: options.size,
            usage: payload?.usage,
        },
        mimeType: getOpenAIImageMimeType(options.outputFormat),
    };
};
const requireOpenAIImageApiKey = () => {
    const apiKey = normalizeText(env.openaiApiKey);
    if (!apiKey) {
        throw new OpenAIImageProviderError("OPENAI_API_KEY is not configured.");
    }
    return apiKey;
};
const getCharacterReferenceOptions = (options) => {
    const outputFormat = normalizeOutputFormat(options.outputFormat ?? env.openaiCharacterReferenceOutputFormat, "png");
    return {
        model: normalizeModel(options.model ?? env.openaiCharacterReferenceModel),
        outputFormat,
        prompt: normalizeText(options.prompt),
        quality: normalizeQuality(options.quality ?? env.openaiCharacterReferenceQuality, "medium"),
        size: normalizeText(options.size ?? env.openaiCharacterReferenceSize) || "2048x2048",
        timeoutMs: Math.max(1_000, options.timeoutMs ?? env.openaiImageTimeoutMs ?? 120_000),
    };
};
export const createOpenAIImageGeneration = async (options) => {
    const apiKey = requireOpenAIImageApiKey();
    const requestOptions = getCharacterReferenceOptions(options);
    if (!requestOptions.prompt) {
        throw new OpenAIImageProviderError("OpenAI image prompt is required.", { fallbackable: false, policy: true });
    }
    let response;
    try {
        response = await fetch(OPENAI_IMAGES_GENERATION_URL, {
            body: JSON.stringify({
                model: requestOptions.model,
                n: 1,
                output_format: requestOptions.outputFormat,
                prompt: requestOptions.prompt,
                quality: requestOptions.quality,
                size: requestOptions.size,
            }),
            headers: {
                Accept: "application/json",
                Authorization: `Bearer ${apiKey}`,
                "Content-Type": "application/json",
            },
            method: "POST",
            signal: AbortSignal.timeout(requestOptions.timeoutMs),
        });
    }
    catch (error) {
        throw new OpenAIImageProviderError(error instanceof Error ? error.message : "OpenAI image generation failed.");
    }
    const payload = await parseOpenAIImagePayload(response);
    if (!response.ok) {
        throw buildOpenAIImageError(response, payload, "image generation");
    }
    return decodeOpenAIImage(payload, {
        model: requestOptions.model,
        outputFormat: requestOptions.outputFormat,
        quality: requestOptions.quality,
        requestId: normalizeText(response.headers.get("x-request-id")) || undefined,
        size: requestOptions.size,
    });
};
export const createOpenAIImageEdit = async (options) => {
    const apiKey = requireOpenAIImageApiKey();
    const requestOptions = getCharacterReferenceOptions(options);
    if (!requestOptions.prompt) {
        throw new OpenAIImageProviderError("OpenAI image edit prompt is required.", { fallbackable: false, policy: true });
    }
    if (!options.image.byteLength) {
        throw new OpenAIImageProviderError("OpenAI image edit source image is empty.");
    }
    const formData = new FormData();
    formData.append("model", requestOptions.model);
    formData.append("prompt", requestOptions.prompt);
    formData.append("quality", requestOptions.quality);
    formData.append("size", requestOptions.size);
    formData.append("output_format", requestOptions.outputFormat);
    formData.append("image[]", new Blob([new Uint8Array(options.image)], {
        type: normalizeText(options.imageMimeType) || "image/png",
    }), normalizeText(options.imageFileName) || "character-source.png");
    let response;
    try {
        response = await fetch(OPENAI_IMAGES_EDIT_URL, {
            body: formData,
            headers: {
                Accept: "application/json",
                Authorization: `Bearer ${apiKey}`,
            },
            method: "POST",
            signal: AbortSignal.timeout(requestOptions.timeoutMs),
        });
    }
    catch (error) {
        throw new OpenAIImageProviderError(error instanceof Error ? error.message : "OpenAI image edit failed.");
    }
    const payload = await parseOpenAIImagePayload(response);
    if (!response.ok) {
        throw buildOpenAIImageError(response, payload, "image edit");
    }
    return decodeOpenAIImage(payload, {
        model: requestOptions.model,
        outputFormat: requestOptions.outputFormat,
        quality: requestOptions.quality,
        requestId: normalizeText(response.headers.get("x-request-id")) || undefined,
        size: requestOptions.size,
    });
};
