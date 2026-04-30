import { spawnSync } from "node:child_process";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

import express from "express";
import cors from "cors";
import { fromNodeHeaders, toNodeHandler } from "better-auth/node";

import { auth, ensureAuthSchema, signInWithTelegram } from "./auth.js";
import { authDatabaseConfig } from "./database.js";
import { authProviderStatus, env } from "./env.js";
import { getLastDevEmailPreview, getMailStatus } from "./mail.js";
import {
  appendWorkspaceContentPlanIdeas,
  createWorkspaceContentPlan,
  deleteWorkspaceContentPlanIdea,
  deleteWorkspaceContentPlan,
  getWorkspaceContentPlan,
  listWorkspaceContentPlans,
  updateWorkspaceContentPlanIdeaUsedState,
} from "./content-plans.js";
import {
  disconnectWorkspaceYoutubeChannel,
  getWorkspacePublishBootstrap,
  getWorkspacePublishJobStatus,
  getWorkspaceYoutubeConnectUrl,
  isWorkspacePublishSuccessStatus,
  startWorkspaceYoutubePublish,
} from "./publish.js";
import {
  deleteWorkspaceProject,
  getWorkspaceProjectPlaybackAsset,
  getWorkspaceProjectPlaybackProxyTarget,
  getWorkspaceProjectPosterPath,
  getWorkspaceProjectVideoProxyTarget,
  getWorkspaceProjects,
  invalidateWorkspaceProjectsCache,
  WorkspaceProjectNotFoundError,
} from "./projects.js";
import {
  getWorkspaceProjectSegmentVideoProxyTarget,
  WorkspaceSegmentEditorError,
  getWorkspaceSegmentEditorSession,
  invalidateWorkspaceSegmentEditorSessionCache,
  type WorkspaceSegmentEditorVideoDelivery,
  type WorkspaceSegmentEditorVideoSource,
} from "./segment-editor.js";
import {
  getWorkspaceMediaLibraryItems,
  getWorkspaceMediaLibraryPreviewPath,
  invalidateWorkspaceMediaLibraryCache,
  WorkspaceMediaLibraryPreviewError,
} from "./media-library.js";
import {
  ensureWorkspaceVideoPoster,
  getWorkspaceVideoPosterCacheKey,
} from "./project-posters.js";
import {
  ensureWorkspaceMediaAssetPlayback,
  getWorkspaceMediaAssetPlaybackCacheKey,
} from "./media-asset-playback.js";
import { verifyTelegramLogin, getTelegramUserProfile, type TelegramLoginData } from "./telegram.js";
import {
  createStudioSegmentAiPhotoJob,
  getStudioSegmentAiVideoPlaybackAsset,
  createStudioSegmentAiVideoJob,
  createStudioSegmentImageEditJob,
  createStudioSegmentImageUpscaleJob,
  createStudioSegmentPhotoAnimationJob,
  createStudioGenerationJob,
  generateStudioSegmentAiPhoto,
  generateStudioContentPlanIdeas,
  getStudioSegmentAiPhotoJobStatus,
  getStudioSegmentAiVideoJobPosterPath,
  getStudioSegmentAiVideoJobStatus,
  getStudioSegmentImageEditJobStatus,
  getStudioSegmentImageUpscaleJobStatus,
  getStudioSegmentPhotoAnimationPlaybackAsset,
  getStudioSegmentPhotoAnimationJobPosterPath,
  getStudioSegmentPhotoAnimationJobStatus,
  getStudioPlaybackAsset,
  getWorkspaceBootstrap,
  getStudioGenerationStatus,
  getStudioVideoProxyTargetByPath,
  getStudioVideoProxyTarget,
  invalidateWorkspaceBootstrapCache,
  improveStudioSegmentAiPhotoPrompt,
  translateStudioTexts,
  WorkspaceCreditLimitError,
} from "./studio.js";
import { getStudioVoicePreview } from "./voice-preview.js";
import {
  CheckoutConfigError,
  CheckoutProductUnavailableError,
  applySimulatedCheckoutProfileOverride,
  getCheckoutUrl,
  getCheckoutWidgetSession,
  isCheckoutProductId,
  shouldSimulateCheckoutPayment,
  simulateCheckoutPayment,
} from "./payments.js";
import {
  deleteLocalExample,
  getLocalExampleVideoAsset,
  getLocalExamplesState,
  LocalExamplesPermissionError,
  saveLocalExample,
  type LocalExampleGoal,
} from "./local-examples.js";
import { normalizeExamplePrefillStudioSettings } from "../shared/example-prefill.js";
import { buildExternalUserId, resolveExternalUserIdentity } from "./external-user.js";
import {
  AgencyContactValidationError,
  parseAgencyContactSubmission,
  sendAgencyContactSubmission,
} from "./agency-contact.js";
import { buildAdsflowUrl, fetchUpstreamResponse, postAdsflowJson, UpstreamFetchError, upstreamPolicies } from "./upstream-client.js";
import { initServerLogging, logServerEvent } from "./logger.js";

initServerLogging();

const app = express();

const resolvePreferredExternalUserId = async (user: { email?: string | null; id?: string | null }) => {
  try {
    return (await resolveExternalUserIdentity(user)).preferred;
  } catch {
    return buildExternalUserId(user);
  }
};

const validateServerStartup = () => {
  if (!env.adsflowApiBaseUrl || !env.adsflowAdminToken) {
    console.warn("[server] AdsFlow environment variables are missing. Studio and workspace media features will fail.");
  }

  if (env.redisUrl) {
    console.warn("[server] REDIS_URL is configured, but the current asset queue adapter still uses in-memory execution.");
  }

  const ffmpegBinary = process.env.FFMPEG_PATH?.trim() || "ffmpeg";
  const ffmpegCheck = spawnSync(ffmpegBinary, ["-version"], {
    encoding: "utf8",
    stdio: "ignore",
  });

  if (ffmpegCheck.error || ffmpegCheck.status !== 0) {
    console.warn(`[server] ffmpeg is unavailable via "${ffmpegBinary}". Playback remuxing and poster capture will fail.`);
  }
};

const getServerErrorMessage = (error: unknown, fallback: string) =>
  error instanceof Error && error.message.trim() ? error.message : fallback;

const allowedCorsOrigins = Array.from(
  new Set(
    [
      env.appUrl,
      env.authBaseUrl,
      env.isProduction ? null : "http://localhost:4174",
      env.isProduction ? null : "http://127.0.0.1:4174",
    ].filter((value): value is string => Boolean(value)),
  ),
);

app.set("trust proxy", true);
app.use(
  cors({
    credentials: true,
    origin(origin, callback) {
      if (!origin || allowedCorsOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error(`CORS origin is not allowed: ${origin}`));
    },
  }),
);

const buildVideoProxyRequestHeaders = (req: express.Request) => {
  const headers: Record<string, string> = {};

  const range = req.header("range");
  if (range) headers.range = range;

  const ifRange = req.header("if-range");
  if (ifRange) headers["if-range"] = ifRange;

  return headers;
};

const isVideoProxyStreamAbortLikeError = (error: unknown) => {
  let current: unknown = error;
  const visited = new Set<unknown>();

  while (current && typeof current === "object" && !visited.has(current)) {
    visited.add(current);

    const name = "name" in current ? String(current.name ?? "") : "";
    const code = "code" in current ? String(current.code ?? "") : "";
    const message = "message" in current ? String(current.message ?? "").toLowerCase() : "";

    if (
      name === "AbortError" ||
      code === "ABORT_ERR" ||
      code === "ECONNRESET" ||
      code === "ERR_STREAM_UNABLE_TO_PIPE" ||
      code === "ERR_STREAM_PREMATURE_CLOSE" ||
      code === "UND_ERR_ABORTED" ||
      code === "UND_ERR_SOCKET" ||
      message.includes("aborted") ||
      message.includes("terminated") ||
      message.includes("closed or destroyed stream") ||
      message.includes("premature close") ||
      message.includes("econnreset")
    ) {
      return true;
    }

    current = "cause" in current ? current.cause : null;
  }

  return false;
};

const getVideoProxyFetchErrorCode = (error: unknown): string => {
  let current: unknown = error;
  const visited = new Set<unknown>();

  while (current && typeof current === "object" && !visited.has(current)) {
    visited.add(current);

    if ("code" in current && typeof current.code === "string" && current.code.trim()) {
      return current.code.trim();
    }

    current = "cause" in current ? current.cause : null;
  }

  return "";
};

const getVideoProxyFetchErrorMessage = (error: unknown) =>
  error instanceof Error && error.message.trim()
    ? error.message.trim()
    : typeof error === "string"
      ? error.trim()
      : "";

const isVideoProxyFetchTimeoutLikeError = (error: unknown) => {
  let current: unknown = error;
  const visited = new Set<unknown>();

  while (current && typeof current === "object" && !visited.has(current)) {
    visited.add(current);

    const name = "name" in current ? String(current.name ?? "") : "";
    const code = "code" in current ? String(current.code ?? "") : "";
    const message = "message" in current ? String(current.message ?? "").toLowerCase() : "";

    if (
      name === "AbortError" ||
      name === "TimeoutError" ||
      code === "ABORT_ERR" ||
      code === "ETIMEDOUT" ||
      code === "UND_ERR_CONNECT_TIMEOUT" ||
      code === "UND_ERR_HEADERS_TIMEOUT" ||
      message.includes("timeout") ||
      message.includes("timed out") ||
      message.includes("aborted")
    ) {
      return true;
    }

    current = "cause" in current ? current.cause : null;
  }

  return false;
};

const fetchVideoProxyUpstream = async (
  req: express.Request,
  upstreamUrl: URL,
  upstreamHeaders?: Record<string, string>,
) => {
  const policy = upstreamPolicies.playbackPreparation;
  const target = `${upstreamUrl.origin}${upstreamUrl.pathname}`;
  let lastError: unknown = null;
  let lastStatusCode: number | null = null;

  for (let attempt = 0; attempt <= policy.retryDelaysMs.length; attempt += 1) {
    const attemptNumber = attempt + 1;
    const startedAt = Date.now();
    const controller = new AbortController();
    const timeoutHandle = setTimeout(() => {
      controller.abort(new Error(`Upstream request timed out for ${target}.`));
    }, policy.timeoutMs);

    try {
      const response = await fetch(upstreamUrl, {
        headers: {
          ...buildVideoProxyRequestHeaders(req),
          ...(upstreamHeaders ?? {}),
          connection: "close",
        },
        signal: controller.signal,
      });
      clearTimeout(timeoutHandle);

      lastStatusCode = response.status;
      logServerEvent(response.ok ? "info" : "warn", "upstream.response", {
        attempt: attemptNumber,
        assetKind: "video-proxy",
        cacheHit: false,
        elapsedMs: Date.now() - startedAt,
        endpoint: req.path,
        jobId: null,
        policy: `${policy.name}-headers`,
        projectId: null,
        statusCode: response.status,
        target,
      });

      if (!policy.retryableStatusCodes.has(response.status) || attempt === policy.retryDelaysMs.length) {
        return response;
      }

      void response.body?.cancel();
    } catch (error) {
      clearTimeout(timeoutHandle);
      lastError = error;
      const isTimeout = isVideoProxyFetchTimeoutLikeError(error);

      logServerEvent("warn", "upstream.error", {
        attempt: attemptNumber,
        assetKind: "video-proxy",
        code: getVideoProxyFetchErrorCode(error) || null,
        elapsedMs: Date.now() - startedAt,
        endpoint: req.path,
        error: getVideoProxyFetchErrorMessage(error) || `Upstream request failed for ${target}.`,
        jobId: null,
        policy: `${policy.name}-headers`,
        projectId: null,
        target,
        timeout: isTimeout,
      });

      if (attempt === policy.retryDelaysMs.length || !isTimeout) {
        throw new UpstreamFetchError(
          getVideoProxyFetchErrorMessage(error) || `Upstream request failed for ${target}.`,
          {
            code: getVideoProxyFetchErrorCode(error) || null,
            isTimeout,
            target,
          },
        );
      }
    }

    const delayMs = policy.retryDelaysMs[attempt] ?? 0;
    if (delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  throw new UpstreamFetchError(
    lastStatusCode !== null
      ? `Upstream request failed (${lastStatusCode}) for ${target}.`
      : getVideoProxyFetchErrorMessage(lastError) || `Upstream request failed for ${target}.`,
    {
      code: getVideoProxyFetchErrorCode(lastError) || null,
      isTimeout: isVideoProxyFetchTimeoutLikeError(lastError),
      target,
    },
  );
};

const proxyVideoResponse = async (
  req: express.Request,
  res: express.Response,
  upstreamUrl: URL,
  fallbackMessage: string,
  upstreamHeaders?: Record<string, string>,
) => {
  let upstreamResponse: Response;

  try {
    upstreamResponse = await fetchVideoProxyUpstream(req, upstreamUrl, upstreamHeaders);
  } catch (error) {
    const statusCode = error instanceof UpstreamFetchError && error.isTimeout ? 504 : 502;
    res.status(statusCode).json({
      error: error instanceof Error && error.message.trim() ? error.message : fallbackMessage,
    });
    return;
  }

  if (!upstreamResponse.ok || !upstreamResponse.body) {
    const detail = await upstreamResponse.text().catch(() => "");
    res.status(upstreamResponse.status || 502).json({
      error: detail || fallbackMessage,
    });
    return;
  }

  res.status(upstreamResponse.status);

  const forwardedHeaders = [
    "accept-ranges",
    "cache-control",
    "content-length",
    "content-range",
    "content-type",
    "etag",
    "last-modified",
  ];

  forwardedHeaders.forEach((headerName) => {
    if (res.getHeader(headerName)) {
      return;
    }

    const value = upstreamResponse.headers.get(headerName);
    if (value) res.setHeader(headerName, value);
  });

  const upstreamBody = Readable.fromWeb(upstreamResponse.body as never);

  try {
    await pipeline(upstreamBody, res);
  } catch (error) {
    upstreamBody.destroy();

    if (isVideoProxyStreamAbortLikeError(error)) {
      if (!res.destroyed) {
        res.destroy();
      }
      return;
    }

    if (!res.headersSent) {
      res.status(502).json({
        error: fallbackMessage,
      });
      return;
    }

    throw error;
  }
};

const isWorkspaceSegmentEditorVideoSource = (value: string): value is WorkspaceSegmentEditorVideoSource =>
  value === "current" || value === "original";

const isWorkspaceSegmentEditorVideoDelivery = (value: string): value is WorkspaceSegmentEditorVideoDelivery =>
  value === "preview" || value === "playback";

type StudioGenerateMultipartSegment = {
  customVideoAssetId?: unknown;
  customVideoFileDataUrl?: unknown;
  customVideoFileMimeType?: unknown;
  customVideoFileName?: unknown;
  customVideoRemoteUrl?: unknown;
  customVideoFileUploadKey?: unknown;
  duration?: unknown;
  endTime?: unknown;
  index?: unknown;
  resetVisual?: unknown;
  startTime?: unknown;
  text?: unknown;
  videoAction?: unknown;
};

type StudioGenerateMultipartSegmentEditor = {
  projectId?: unknown;
  segments?: unknown;
};

type AdsflowMediaUploadSessionPayload = {
  asset?: unknown;
  success?: boolean;
  upload?: unknown;
};

const isMultipartFormRequest = (req: express.Request) =>
  String(req.headers["content-type"] ?? "")
    .toLowerCase()
    .includes("multipart/form-data");

const parseServerJson = <T>(value: string | null | undefined) => {
  const normalized = String(value ?? "").trim();
  if (!normalized) {
    return null;
  }

  try {
    return JSON.parse(normalized) as T;
  } catch {
    return null;
  }
};

const getFormDataString = (formData: FormData, key: string) => {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
};

const getFormDataBoolean = (formData: FormData, key: string, defaultValue: boolean) => {
  const value = formData.get(key);
  if (typeof value !== "string") {
    return defaultValue;
  }

  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return defaultValue;
  }

  return !["0", "false", "no", "off"].includes(normalized);
};

const getFormDataNumber = (formData: FormData, key: string) => {
  const value = Number(getFormDataString(formData, key));
  return Number.isFinite(value) ? value : 0;
};

const normalizeRequestPositiveInteger = (value: unknown) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return undefined;
  }

  const rounded = Math.trunc(numeric);
  return rounded > 0 ? rounded : undefined;
};

const normalizeRequestNonNegativeInteger = (value: unknown) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return undefined;
  }

  const rounded = Math.trunc(numeric);
  return rounded >= 0 ? rounded : undefined;
};

const buildMultipartFileDataUrl = async (file: File) => {
  const buffer = Buffer.from(await file.arrayBuffer());
  const mimeType = file.type.trim() || "application/octet-stream";
  return `data:${mimeType};base64,${buffer.toString("base64")}`;
};

const isLoopbackHostname = (hostname: string) => {
  const normalized = hostname.trim().toLowerCase();
  return normalized === "localhost" || normalized === "127.0.0.1" || normalized === "::1" || normalized === "[::1]";
};

const isSameOriginOrEquivalentLoopback = (left: URL, right: URL) => {
  if (left.origin === right.origin) {
    return true;
  }

  return left.protocol === right.protocol && left.port === right.port && isLoopbackHostname(left.hostname) && isLoopbackHostname(right.hostname);
};

const getRequestOriginUrl = (req: express.Request) => {
  const host = req.get("host")?.trim();
  if (!host) {
    return null;
  }

  try {
    return new URL(`${req.protocol}://${host}`);
  } catch {
    return null;
  }
};

const buildRemoteFileDataUrl = async (
  req: express.Request,
  remoteUrl: string,
  fallbackMimeType?: string,
) => {
  const appOriginUrl = (() => {
    try {
      return new URL(env.appUrl || "http://127.0.0.1");
    } catch {
      return new URL("http://127.0.0.1");
    }
  })();
  const targetUrl = new URL(remoteUrl, appOriginUrl);
  const requestOriginUrl = getRequestOriginUrl(req);
  const shouldForwardAuth =
    (requestOriginUrl && isSameOriginOrEquivalentLoopback(targetUrl, requestOriginUrl)) ||
    isSameOriginOrEquivalentLoopback(targetUrl, appOriginUrl);
  const headers: Record<string, string> = {
    Accept: `${fallbackMimeType || "*/*"},application/octet-stream`,
  };

  if (shouldForwardAuth) {
    const cookieHeader = req.headers.cookie;
    const authorizationHeader = req.headers.authorization;

    if (typeof cookieHeader === "string" && cookieHeader.trim()) {
      headers.Cookie = cookieHeader;
    }

    if (typeof authorizationHeader === "string" && authorizationHeader.trim()) {
      headers.Authorization = authorizationHeader;
    }
  }

  const response = await fetch(targetUrl, {
    headers,
    signal: AbortSignal.timeout(20_000),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch remote segment asset (${response.status}).`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  if (!buffer.length) {
    throw new Error("Remote segment asset is empty.");
  }

  const mimeType = response.headers.get("content-type")?.trim() || fallbackMimeType?.trim() || "application/octet-stream";
  return `data:${mimeType};base64,${buffer.toString("base64")}`;
};

const parseMultipartFormData = async (req: express.Request) => {
  const request = new Request(new URL(req.originalUrl, env.appUrl || "http://127.0.0.1").toString(), {
    body: Readable.toWeb(req) as never,
    duplex: "half",
    headers: req.headers as never,
    method: req.method,
  });

  return request.formData();
};

const parseStudioGenerateMultipartBody = async (req: express.Request) => {
  const formData = await parseMultipartFormData(req);
  const customMusicFileEntry = formData.get("customMusicFile");
  const customMusicFile = customMusicFileEntry instanceof File ? customMusicFileEntry : null;
  const customVideoFileEntry = formData.get("customVideoFile");
  const customVideoFile = customVideoFileEntry instanceof File ? customVideoFileEntry : null;
  const brandLogoFileEntry = formData.get("brandLogoFile");
  const brandLogoFile = brandLogoFileEntry instanceof File ? brandLogoFileEntry : null;
  const rawSegmentEditor = parseServerJson<StudioGenerateMultipartSegmentEditor>(getFormDataString(formData, "segmentEditor"));
  const segmentEditorRecord =
    rawSegmentEditor && typeof rawSegmentEditor === "object" ? rawSegmentEditor : null;
  const rawSegments = Array.isArray(segmentEditorRecord?.segments) ? segmentEditorRecord.segments : [];
  const segmentEditor =
    segmentEditorRecord && rawSegments.length > 0
      ? {
          projectId: segmentEditorRecord.projectId,
          segments: await Promise.all(
            rawSegments.map(async (segment) => {
              const segmentRecord =
                segment && typeof segment === "object" ? (segment as StudioGenerateMultipartSegment) : {};
              const uploadKey =
                typeof segmentRecord.customVideoFileUploadKey === "string"
                  ? segmentRecord.customVideoFileUploadKey.trim()
                  : "";
              const uploadedEntry = uploadKey ? formData.get(uploadKey) : null;
              const uploadedFile = uploadedEntry instanceof File ? uploadedEntry : null;
              const remoteUrl =
                typeof segmentRecord.customVideoRemoteUrl === "string"
                  ? segmentRecord.customVideoRemoteUrl.trim()
                  : "";
              const fallbackMimeType =
                typeof segmentRecord.customVideoFileMimeType === "string"
                  ? segmentRecord.customVideoFileMimeType.trim()
                  : undefined;

              return {
                customVideoAssetId: normalizeRequestPositiveInteger(segmentRecord.customVideoAssetId),
                customVideoFileDataUrl: uploadedFile
                  ? await buildMultipartFileDataUrl(uploadedFile)
                  : remoteUrl
                    ? await buildRemoteFileDataUrl(req, remoteUrl, fallbackMimeType)
                  : typeof segmentRecord.customVideoFileDataUrl === "string"
                    ? segmentRecord.customVideoFileDataUrl.trim()
                    : undefined,
                customVideoFileMimeType: uploadedFile
                  ? uploadedFile.type.trim() || undefined
                  : typeof segmentRecord.customVideoFileMimeType === "string"
                    ? segmentRecord.customVideoFileMimeType.trim()
                    : undefined,
                customVideoFileName: uploadedFile
                  ? uploadedFile.name.trim() || undefined
                  : typeof segmentRecord.customVideoFileName === "string"
                    ? segmentRecord.customVideoFileName.trim()
                    : undefined,
                duration: segmentRecord.duration,
                endTime: segmentRecord.endTime,
                index: segmentRecord.index,
                resetVisual: Boolean(segmentRecord.resetVisual),
                startTime: segmentRecord.startTime,
                text: segmentRecord.text,
                videoAction: segmentRecord.videoAction,
              };
            }),
          ),
        }
      : undefined;

  return {
    brandLogoAssetId: normalizeRequestPositiveInteger(getFormDataString(formData, "brandLogoAssetId")),
    brandLogoFileDataUrl: brandLogoFile ? await buildMultipartFileDataUrl(brandLogoFile) : getFormDataString(formData, "brandLogoFileDataUrl"),
    brandLogoFileMimeType:
      getFormDataString(formData, "brandLogoFileMimeType") || brandLogoFile?.type?.trim() || "",
    brandLogoFileName: getFormDataString(formData, "brandLogoFileName") || brandLogoFile?.name?.trim() || "",
    brandText: getFormDataString(formData, "brandText"),
    customMusicAssetId: normalizeRequestPositiveInteger(getFormDataString(formData, "customMusicAssetId")),
    customMusicFileDataUrl: customMusicFile ? await buildMultipartFileDataUrl(customMusicFile) : getFormDataString(formData, "customMusicFileDataUrl"),
    customMusicFileName: getFormDataString(formData, "customMusicFileName") || customMusicFile?.name?.trim() || "",
    customVideoAssetId: normalizeRequestPositiveInteger(getFormDataString(formData, "customVideoAssetId")),
    customVideoFileDataUrl: customVideoFile ? await buildMultipartFileDataUrl(customVideoFile) : getFormDataString(formData, "customVideoFileDataUrl"),
    customVideoFileMimeType:
      getFormDataString(formData, "customVideoFileMimeType") || customVideoFile?.type?.trim() || "",
    customVideoFileName: getFormDataString(formData, "customVideoFileName") || customVideoFile?.name?.trim() || "",
    editedFromProjectAdId: normalizeRequestPositiveInteger(getFormDataString(formData, "editedFromProjectAdId")),
    isRegeneration: getFormDataBoolean(formData, "isRegeneration", false),
    language: getFormDataString(formData, "language"),
    musicType: getFormDataString(formData, "musicType"),
    projectId: getFormDataNumber(formData, "projectId"),
    prompt: getFormDataString(formData, "prompt"),
    segmentEditor,
    subtitleColorId: getFormDataString(formData, "subtitleColorId"),
    subtitleEnabled: getFormDataBoolean(formData, "subtitleEnabled", true),
    subtitleStyleId: getFormDataString(formData, "subtitleStyleId"),
    versionRootProjectAdId: normalizeRequestPositiveInteger(getFormDataString(formData, "versionRootProjectAdId")),
    videoMode: getFormDataString(formData, "videoMode"),
    voiceEnabled: getFormDataBoolean(formData, "voiceEnabled", true),
    voiceId: getFormDataString(formData, "voiceId"),
  };
};

const isLocalExampleGoal = (value: string): value is LocalExampleGoal =>
  value === "ads" ||
  value === "growth" ||
  value === "expert";

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/api/auth/status", (_req, res) => {
  res.json({
    ...getMailStatus(),
    googleEnabled: authProviderStatus.googleEnabled,
    telegramEnabled: authProviderStatus.telegramEnabled,
  });
});

app.get("/api/auth/dev/last-email", (_req, res) => {
  if (env.isProduction) {
    res.status(404).json({ data: null });
    return;
  }

  res.json({ data: getLastDevEmailPreview() });
});

app.get("/api/auth/telegram/config", (_req, res) => {
  if (!authProviderStatus.telegramEnabled || !env.telegramBotId || !env.telegramBotUsername) {
    res.status(404).json({ error: "Telegram login not configured." });
    return;
  }

  res.json({
    botId: env.telegramBotId,
    botUsername: env.telegramBotUsername,
    requestAccess: "write",
  });
});

app.get("/api/auth/telegram/login", (_req, res) => {
  if (!authProviderStatus.telegramEnabled || !env.telegramBotUsername) {
    res.status(400).send("Telegram login not configured.");
    return;
  }

  const authUrl = `${env.appUrl}/api/auth/telegram/redirect`;

  res.send(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Вход через Telegram — AdShorts AI</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      background: #0f131b;
      color: #fff;
    }
    h1 { font-size: 1.5rem; margin-bottom: 24px; }
    #tg-widget { min-height: 48px; }
    .back { margin-top: 24px; color: rgba(255,255,255,0.6); text-decoration: none; }
    .back:hover { color: #fff; }
  </style>
</head>
<body>
  <h1>Войти через Telegram</h1>
  
  <div id="tg-widget">
    <script async src="https://telegram.org/js/telegram-widget.js?22"
            data-telegram-login="${env.telegramBotUsername}"
            data-size="large"
            data-radius="8"
            data-auth-url="${authUrl}"
            data-request-access="write"></script>
  </div>
  
  <a class="back" href="/">← Вернуться на сайт</a>
</body>
</html>`);
});

app.get("/api/auth/telegram/redirect", async (req, res) => {
  if (!authProviderStatus.telegramEnabled) {
    res.redirect("/?error=telegram_not_configured");
    return;
  }

  const { id, first_name, last_name, username, photo_url, auth_date, hash } = req.query;

  if (!id || !hash || !auth_date) {
    res.redirect("/?error=invalid_telegram_data");
    return;
  }

  const loginData: TelegramLoginData = {
    id: Number(id),
    first_name: String(first_name || ""),
    last_name: last_name ? String(last_name) : undefined,
    username: username ? String(username) : undefined,
    photo_url: photo_url ? String(photo_url) : undefined,
    auth_date: Number(auth_date),
    hash: String(hash),
  };

  if (!verifyTelegramLogin(loginData)) {
    console.warn("[telegram] Invalid login data or hash verification failed");
    res.redirect("/?error=invalid_telegram_hash");
    return;
  }

  try {
    const profile = getTelegramUserProfile(loginData);
    await signInWithTelegram(profile, req, res);

    res.redirect("/app/studio");
  } catch (error) {
    console.error("[telegram] Failed to sign in with Telegram", error);
    res.redirect("/?error=telegram_login_failed");
  }
});

app.post("/api/auth/telegram/callback", express.json(), async (req, res) => {
  if (!authProviderStatus.telegramEnabled) {
    res.status(400).json({ error: "Telegram login not configured." });
    return;
  }

  const loginData = req.body as TelegramLoginData;

  if (!verifyTelegramLogin(loginData)) {
    console.warn("[telegram] Invalid login data or hash verification failed");
    res.status(401).json({ error: "Invalid Telegram login data." });
    return;
  }

  try {
    const profile = getTelegramUserProfile(loginData);
    const result = await signInWithTelegram(profile, req, res);

    res.json({
      success: true,
      user: result.user,
      redirectTo: "/app/studio",
    });
  } catch (error) {
    console.error("[telegram] Failed to sign in with Telegram", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to sign in with Telegram.",
    });
  }
});

app.get("/api/me", async (req, res) => {
  const session = await auth.api.getSession({
    headers: fromNodeHeaders(req.headers),
  });
  res.json(session);
});

app.get("/api/examples/local", async (req, res) => {
  const session = await auth.api.getSession({
    headers: fromNodeHeaders(req.headers),
  });

  try {
    const data = await getLocalExamplesState(session?.user ?? null);
    res.json({ data });
  } catch (error) {
    console.error("[examples] Failed to load local examples", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to load local examples.",
    });
  }
});

app.post("/api/examples/local", express.json(), async (req, res) => {
  const session = await auth.api.getSession({
    headers: fromNodeHeaders(req.headers),
  });

  if (!session?.user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const goal = typeof req.body?.goal === "string" ? req.body.goal.trim() : "";
  const prompt = typeof req.body?.prompt === "string" ? req.body.prompt.trim() : "";
  const title = typeof req.body?.title === "string" ? req.body.title.trim() : "";
  const videoUrl = typeof req.body?.videoUrl === "string" ? req.body.videoUrl.trim() : "";
  const sourceId = typeof req.body?.sourceId === "string" ? req.body.sourceId.trim() : "";
  const prefillSettings = normalizeExamplePrefillStudioSettings(req.body?.prefillSettings);

  if (!isLocalExampleGoal(goal)) {
    res.status(400).json({ error: "Local example section is invalid." });
    return;
  }

  if (!prompt || !videoUrl) {
    res.status(400).json({ error: "Video topic and URL are required." });
    return;
  }

  try {
    const item = await saveLocalExample(session.user, {
      goal,
      prefillSettings,
      prompt,
      sourceId: sourceId || null,
      title,
      videoUrl,
    });
    res.status(201).json({ data: { item } });
  } catch (error) {
    if (error instanceof LocalExamplesPermissionError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }

    console.error("[examples] Failed to save local example", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to save local example.",
    });
  }
});

app.delete("/api/examples/local/:exampleId", async (req, res) => {
  const session = await auth.api.getSession({
    headers: fromNodeHeaders(req.headers),
  });

  if (!session?.user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const exampleId = typeof req.params.exampleId === "string" ? req.params.exampleId.trim() : "";
  if (!exampleId) {
    res.status(400).json({ error: "Local example id is required." });
    return;
  }

  try {
    const data = await deleteLocalExample(session.user, exampleId);
    res.json({ data });
  } catch (error) {
    if (error instanceof LocalExamplesPermissionError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }

    console.error("[examples] Failed to delete local example", error);
    res.status(404).json({
      error: error instanceof Error ? error.message : "Failed to delete local example.",
    });
  }
});

app.get("/api/examples/local-video/:exampleId", async (req, res) => {
  const session = await auth.api.getSession({
    headers: fromNodeHeaders(req.headers),
  });

  try {
    const asset = await getLocalExampleVideoAsset(session?.user ?? null, req.params.exampleId);
    res.setHeader("Cache-Control", "private, no-store");
    res.type(asset.contentType);
    await new Promise<void>((resolve, reject) => {
      res.sendFile(asset.absolutePath, (error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });
  } catch (error) {
    console.error("[examples] Failed to stream local example video", error);
    if (!res.headersSent) {
      res.status(404).json({
        error: error instanceof Error ? error.message : "Failed to stream local example video.",
      });
      return;
    }

    if (!res.destroyed) {
      res.destroy();
    }
  }
});

app.get("/api/workspace/bootstrap", async (req, res) => {
  const session = await auth.api.getSession({
    headers: fromNodeHeaders(req.headers),
  });

  if (!session?.user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const workspace = await getWorkspaceBootstrap(session.user);

    if (workspace.latestGeneration?.generation) {
      await invalidateWorkspaceProjectsCache(session.user);
    }

    const profile = applySimulatedCheckoutProfileOverride(session.user, workspace.profile);

    res.json({
      data: {
        latestGeneration: workspace.latestGeneration,
        profile,
        studioOptions: workspace.studioOptions,
      },
    });
  } catch (error) {
    console.error("[workspace] Failed to bootstrap workspace", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to bootstrap workspace.",
    });
  }
});

app.get("/api/workspace/projects", async (req, res) => {
  const session = await auth.api.getSession({
    headers: fromNodeHeaders(req.headers),
  });

  if (!session?.user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const projects = await getWorkspaceProjects(session.user);
    res.json({ data: { projects } });
  } catch (error) {
    console.error("[workspace] Failed to load workspace projects", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to load workspace projects.",
    });
  }
});

app.get("/api/workspace/media-library", async (req, res) => {
  const session = await auth.api.getSession({
    headers: fromNodeHeaders(req.headers),
  });

  if (!session?.user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const shouldReload = typeof req.query.reload === "string" && req.query.reload.trim() === "1";
  const cursor = typeof req.query.cursor === "string" ? req.query.cursor.trim() : null;
  const limit = typeof req.query.limit === "string" ? Number(req.query.limit) : undefined;

  try {
    if (shouldReload) {
      await invalidateWorkspaceProjectsCache(session.user);
      invalidateWorkspaceMediaLibraryCache(session.user);
      invalidateWorkspaceSegmentEditorSessionCache(session.user);
    }

    const page = await getWorkspaceMediaLibraryItems(session.user, {
      bypassCache: shouldReload,
      cursor,
      limit,
    });
    res.json({ data: page });
  } catch (error) {
    console.error("[workspace] Failed to load media library", error);
    res.status(502).json({
      error: error instanceof Error ? error.message : "Failed to load media library.",
    });
  }
});

app.delete("/api/workspace/media-library/:assetId", async (req, res) => {
  const session = await auth.api.getSession({
    headers: fromNodeHeaders(req.headers),
  });

  if (!session?.user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const assetId = Number(req.params.assetId ?? 0);
  if (!Number.isFinite(assetId) || assetId <= 0) {
    res.status(400).json({ error: "Asset id is required." });
    return;
  }

  try {
    const externalUserId = await resolvePreferredExternalUserId(session.user);
    const upstreamUrl = buildAdsflowUrl(`/api/media/${Math.trunc(assetId)}`, {
      admin_token: env.adsflowAdminToken,
      external_user_id: externalUserId,
    });
    const response = await fetchUpstreamResponse(
      upstreamUrl,
      { method: "DELETE" },
      upstreamPolicies.adsflowMutation,
      {
        assetKind: "media-library-asset",
        endpoint: req.path,
      },
    );
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      const detail =
        payload && typeof payload === "object" && "detail" in payload && typeof payload.detail === "string"
          ? payload.detail
          : `AdsFlow request failed (${response.status}).`;
      throw new Error(detail);
    }

    invalidateWorkspaceMediaLibraryCache(session.user);
    invalidateWorkspaceSegmentEditorSessionCache(session.user);
    res.json({ data: payload ?? { success: true, assetId: Math.trunc(assetId) } });
  } catch (error) {
    console.error("[workspace] Failed to delete media asset", error);
    res.status(502).json({
      error: error instanceof Error ? error.message : "Failed to delete media asset.",
    });
  }
});

app.get("/api/workspace/media-library-preview", async (req, res) => {
  const session = await auth.api.getSession({
    headers: fromNodeHeaders(req.headers),
  });

  if (!session?.user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const projectId = Number(req.query.projectId ?? 0);
  const segmentIndex = Number(req.query.segmentIndex ?? -1);
  const kind = typeof req.query.kind === "string" ? req.query.kind.trim() : "";
  const version = typeof req.query.v === "string" ? req.query.v.trim() : null;

  try {
    const previewPath = await getWorkspaceMediaLibraryPreviewPath(session.user, {
      kind: kind as "ai_photo" | "ai_video" | "photo_animation" | "image_edit",
      projectId,
      segmentIndex,
      version,
    });
    res.setHeader("Cache-Control", "private, max-age=86400, stale-while-revalidate=604800");
    res.sendFile(previewPath);
  } catch (error) {
    if (error instanceof WorkspaceMediaLibraryPreviewError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }

    if (error instanceof WorkspaceSegmentEditorError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }

    console.error("[workspace] Failed to load media library preview", {
      error: getServerErrorMessage(error, "Failed to load media library preview."),
      kind,
      projectId,
      segmentIndex,
    });
    res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to load media library preview.",
    });
  }
});

app.get("/api/workspace/content-plans", async (req, res) => {
  const session = await auth.api.getSession({
    headers: fromNodeHeaders(req.headers),
  });

  if (!session?.user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const plans = await listWorkspaceContentPlans(session.user);
    res.json({ data: { plans } });
  } catch (error) {
    console.error("[workspace] Failed to load content plans", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to load content plans.",
    });
  }
});

app.post("/api/workspace/content-plans/generate", express.json(), async (req, res) => {
  const session = await auth.api.getSession({
    headers: fromNodeHeaders(req.headers),
  });

  if (!session?.user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const query = typeof req.body?.query === "string" ? req.body.query.trim() : "";
  const requestedCount =
    typeof req.body?.count === "number"
      ? req.body.count
      : typeof req.body?.count === "string" && req.body.count.trim()
        ? Number(req.body.count)
        : undefined;
  const planId = typeof req.body?.planId === "string" ? req.body.planId.trim() : "";
  if (!query) {
    res.status(400).json({ error: "Query is required." });
    return;
  }

  try {
    const existingPlan = planId ? await getWorkspaceContentPlan(session.user, planId) : null;
    if (planId && !existingPlan) {
      res.status(404).json({ error: "Content plan not found." });
      return;
    }

    const generatedPlan = await generateStudioContentPlanIdeas(query, {
      count: requestedCount,
      existingIdeas: existingPlan?.ideas.map((idea) => ({
        prompt: idea.prompt,
        summary: idea.summary,
        title: idea.title,
      })),
      language: typeof req.body?.language === "string" ? req.body.language : undefined,
    });
    const plan = existingPlan
      ? await appendWorkspaceContentPlanIdeas(session.user, {
          ideas: generatedPlan.ideas,
          planId: existingPlan.id,
        })
      : await createWorkspaceContentPlan(session.user, {
          ideas: generatedPlan.ideas,
          language: generatedPlan.language,
          query,
        });

    if (!plan) {
      res.status(404).json({ error: "Content plan not found." });
      return;
    }

    res.json({ data: { plan } });
  } catch (error) {
    console.error("[workspace] Failed to generate content plan", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to generate content plan.",
    });
  }
});

app.patch("/api/workspace/content-plans/:planId/ideas/:ideaId", express.json(), async (req, res) => {
  const session = await auth.api.getSession({
    headers: fromNodeHeaders(req.headers),
  });

  if (!session?.user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const planId = typeof req.params.planId === "string" ? req.params.planId.trim() : "";
  const ideaId = typeof req.params.ideaId === "string" ? req.params.ideaId.trim() : "";
  const isUsed = req.body?.isUsed;

  if (!planId || !ideaId) {
    res.status(400).json({ error: "Plan id and idea id are required." });
    return;
  }

  if (typeof isUsed !== "boolean") {
    res.status(400).json({ error: "isUsed must be a boolean." });
    return;
  }

  try {
    const result = await updateWorkspaceContentPlanIdeaUsedState(session.user, {
      ideaId,
      isUsed,
      planId,
    });

    if (!result) {
      res.status(404).json({ error: "Content plan idea not found." });
      return;
    }

    res.json({ data: result });
  } catch (error) {
    console.error("[workspace] Failed to update content plan idea", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to update content plan idea.",
    });
  }
});

app.delete("/api/workspace/content-plans/:planId/ideas/:ideaId", async (req, res) => {
  const session = await auth.api.getSession({
    headers: fromNodeHeaders(req.headers),
  });

  if (!session?.user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const planId = typeof req.params.planId === "string" ? req.params.planId.trim() : "";
  const ideaId = typeof req.params.ideaId === "string" ? req.params.ideaId.trim() : "";
  if (!planId || !ideaId) {
    res.status(400).json({ error: "Plan id and idea id are required." });
    return;
  }

  try {
    const result = await deleteWorkspaceContentPlanIdea(session.user, {
      ideaId,
      planId,
    });

    if (!result) {
      res.status(404).json({ error: "Content plan idea not found." });
      return;
    }

    res.json({ data: result });
  } catch (error) {
    console.error("[workspace] Failed to delete content plan idea", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to delete content plan idea.",
    });
  }
});

app.delete("/api/workspace/content-plans/:planId", async (req, res) => {
  const session = await auth.api.getSession({
    headers: fromNodeHeaders(req.headers),
  });

  if (!session?.user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const planId = typeof req.params.planId === "string" ? req.params.planId.trim() : "";
  if (!planId) {
    res.status(400).json({ error: "Plan id is required." });
    return;
  }

  try {
    const deleted = await deleteWorkspaceContentPlan(session.user, planId);
    if (!deleted) {
      res.status(404).json({ error: "Content plan not found." });
      return;
    }

    res.json({ data: { planId } });
  } catch (error) {
    console.error("[workspace] Failed to delete content plan", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to delete content plan.",
    });
  }
});

app.get("/api/workspace/projects/:projectId/poster", async (req, res) => {
  const session = await auth.api.getSession({
    headers: fromNodeHeaders(req.headers),
  });

  if (!session?.user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const projectId = typeof req.params.projectId === "string" ? req.params.projectId.trim() : "";
  if (!projectId) {
    res.status(400).json({ error: "Project id is required." });
    return;
  }

  try {
    const posterPath = await getWorkspaceProjectPosterPath(session.user, projectId);
    res.setHeader("Cache-Control", "private, max-age=86400, stale-while-revalidate=604800");
    res.type("jpg");
    res.sendFile(posterPath);
  } catch (error) {
    if (error instanceof WorkspaceProjectNotFoundError) {
      res.status(404).json({ error: "Project not found." });
      return;
    }

    console.error("[workspace] Failed to load project poster", {
      error: getServerErrorMessage(error, "Failed to load project poster."),
      projectId,
    });
    res.status(502).json({
      error: error instanceof Error ? error.message : "Failed to load project poster.",
    });
  }
});

app.get("/api/workspace/projects/:projectId/playback", async (req, res) => {
  const session = await auth.api.getSession({
    headers: fromNodeHeaders(req.headers),
  });

  if (!session?.user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const projectId = typeof req.params.projectId === "string" ? req.params.projectId.trim() : "";
  if (!projectId) {
    res.status(400).json({ error: "Project id is required." });
    return;
  }

  try {
    const asset = await getWorkspaceProjectPlaybackAsset(session.user, projectId);
    res.setHeader("Accept-Ranges", "bytes");
    res.setHeader("Cache-Control", "private, max-age=31536000, immutable");
    res.type(asset.contentType || "video/mp4");
    res.sendFile(asset.absolutePath);
  } catch (error) {
    if (error instanceof WorkspaceProjectNotFoundError) {
      res.status(404).json({ error: "Project not found." });
      return;
    }

    const fallbackTarget = await getWorkspaceProjectPlaybackProxyTarget(session.user, projectId).catch(
      () => null,
    );
    if (fallbackTarget) {
      console.warn("[workspace] Falling back to direct project playback", {
        error: getServerErrorMessage(error, "Failed to prepare project playback cache."),
        projectId,
      });
      res.setHeader("Cache-Control", "private, max-age=600, stale-while-revalidate=60");
      await proxyVideoResponse(req, res, fallbackTarget, "Failed to load project playback.");
      return;
    }

    console.error("[workspace] Failed to load project playback cache", {
      error: getServerErrorMessage(error, "Failed to load project playback."),
      projectId,
    });
    res.status(502).json({
      error: error instanceof Error ? error.message : "Failed to load project playback.",
    });
  }
});

app.delete("/api/workspace/projects/:projectId", async (req, res) => {
  const session = await auth.api.getSession({
    headers: fromNodeHeaders(req.headers),
  });

  if (!session?.user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const projectId = typeof req.params.projectId === "string" ? req.params.projectId.trim() : "";
  if (!projectId) {
    res.status(400).json({ error: "Project id is required." });
    return;
  }

  try {
    await deleteWorkspaceProject(session.user, projectId);
    await invalidateWorkspaceBootstrapCache(session.user);
    invalidateWorkspaceMediaLibraryCache(session.user);
    invalidateWorkspaceSegmentEditorSessionCache(session.user);
    res.json({ data: { projectId } });
  } catch (error) {
    if (error instanceof WorkspaceProjectNotFoundError) {
      res.status(404).json({ error: "Project not found." });
      return;
    }

    console.error("[workspace] Failed to delete workspace project", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to delete workspace project.",
    });
  }
});

app.get("/api/workspace/voice-preview", async (req, res) => {
  const session = await auth.api.getSession({
    headers: fromNodeHeaders(req.headers),
  });

  if (!session?.user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const preview = await getStudioVoicePreview({
      language: typeof req.query.language === "string" ? req.query.language : null,
      voiceId: typeof req.query.voiceId === "string" ? req.query.voiceId : null,
      previewText: typeof req.query.text === "string" ? req.query.text : null,
    });

    res.status(200);
    res.setHeader("Cache-Control", "private, max-age=86400");
    res.setHeader("Content-Length", String(preview.audio.byteLength));
    res.setHeader("Content-Type", preview.contentType || "audio/wav");
    res.send(preview.audio);
  } catch (error) {
    console.error("[workspace] Failed to generate voice preview", error);
    res.status(502).json({
      error: error instanceof Error ? error.message : "Failed to generate voice preview.",
    });
  }
});

const proxyWorkspaceMediaAssetDownload = async (req: express.Request, res: express.Response) => {
  const session = await auth.api.getSession({
    headers: fromNodeHeaders(req.headers),
  });

  if (!session?.user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const assetId = Number(req.params.assetId ?? 0);
  if (!Number.isFinite(assetId) || assetId <= 0) {
    res.status(400).json({ error: "Asset id is required." });
    return;
  }

  try {
    const externalUserId = await resolvePreferredExternalUserId(session.user);
    const upstreamUrl = buildAdsflowUrl(`/api/media/${Math.trunc(assetId)}/download`, {
      admin_token: env.adsflowAdminToken,
      external_user_id: externalUserId,
    });
    const response = await fetchUpstreamResponse(
      upstreamUrl,
      {
        headers: {
          ...buildVideoProxyRequestHeaders(req),
          connection: "close",
        },
      },
      upstreamPolicies.proxyInteractive,
      {
        assetKind: "media-asset",
        endpoint: req.path,
      },
    );

    if (!response.ok || !response.body) {
      res.status(response.status).json({ error: `Media asset request failed (${response.status}).` });
      return;
    }

    [
      "accept-ranges",
      "cache-control",
      "content-disposition",
      "content-length",
      "content-range",
      "content-type",
      "etag",
      "last-modified",
    ].forEach((headerName) => {
      const value = response.headers.get(headerName);
      if (value) res.setHeader(headerName, value);
    });
    res.setHeader("Cache-Control", "private, max-age=300");
    res.status(response.status);
    await pipeline(Readable.fromWeb(response.body as never), res);
  } catch (error) {
    if (isVideoProxyStreamAbortLikeError(error)) {
      if (!res.destroyed) {
        res.destroy();
      }
      return;
    }

    if (res.headersSent) {
      if (!res.destroyed) {
        res.destroy();
      }
      return;
    }

    console.error("[workspace] Failed to proxy media asset", error);
    res.status(502).json({
      error: error instanceof Error ? error.message : "Failed to proxy media asset.",
    });
  }
};

app.get("/api/media/:assetId/download", proxyWorkspaceMediaAssetDownload);
app.get("/api/workspace/media-assets/:assetId", proxyWorkspaceMediaAssetDownload);
app.get("/api/workspace/media-assets/:assetId/playback", async (req, res) => {
  const session = await auth.api.getSession({
    headers: fromNodeHeaders(req.headers),
  });

  if (!session?.user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const assetId = Number(req.params.assetId ?? 0);
  if (!Number.isFinite(assetId) || assetId <= 0) {
    res.status(400).json({ error: "Asset id is required." });
    return;
  }

  const safeAssetId = Math.trunc(assetId);
  let fallbackTarget: URL | null = null;

  try {
    const externalUserId = await resolvePreferredExternalUserId(session.user);
    fallbackTarget = buildAdsflowUrl(`/api/media/${safeAssetId}/download`, {
      admin_token: env.adsflowAdminToken,
      external_user_id: externalUserId,
    });

    const asset = await ensureWorkspaceMediaAssetPlayback({
      assetId: safeAssetId,
      cacheKey: getWorkspaceMediaAssetPlaybackCacheKey({
        assetId: safeAssetId,
        externalUserId,
        targetUrl: fallbackTarget,
      }),
      upstreamUrl: fallbackTarget,
    });
    res.setHeader("Accept-Ranges", "bytes");
    res.setHeader("Cache-Control", "private, max-age=31536000, immutable");
    res.type(asset.contentType || "video/mp4");
    res.sendFile(asset.absolutePath);
  } catch (error) {
    if (fallbackTarget) {
      console.warn("[workspace] Falling back to direct media asset playback", {
        assetId: safeAssetId,
        error: getServerErrorMessage(error, "Failed to prepare media asset playback cache."),
      });
      res.setHeader("Cache-Control", "private, max-age=600, stale-while-revalidate=60");
      await proxyVideoResponse(req, res, fallbackTarget, "Failed to load media asset playback.");
      return;
    }

    console.error("[workspace] Failed to load media asset playback cache", {
      assetId: safeAssetId,
      error: getServerErrorMessage(error, "Failed to load media asset playback."),
    });
    res.status(502).json({
      error: error instanceof Error ? error.message : "Failed to load media asset playback.",
    });
  }
});

app.get("/api/workspace/media-assets/:assetId/poster", async (req, res) => {
  const session = await auth.api.getSession({
    headers: fromNodeHeaders(req.headers),
  });

  if (!session?.user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const assetId = Number(req.params.assetId ?? 0);
  if (!Number.isFinite(assetId) || assetId <= 0) {
    res.status(400).json({ error: "Asset id is required." });
    return;
  }

  const version = typeof req.query.v === "string" ? req.query.v.trim() : "";

  try {
    const externalUserId = await resolvePreferredExternalUserId(session.user);
    const upstreamUrl = buildAdsflowUrl(`/api/media/${Math.trunc(assetId)}/download`, {
      admin_token: env.adsflowAdminToken,
      external_user_id: externalUserId,
    });
    const cacheTargetUrl = buildAdsflowUrl(`/api/media/${Math.trunc(assetId)}/download`);
    const posterPath = await ensureWorkspaceVideoPoster({
      cacheKey: getWorkspaceVideoPosterCacheKey({
        posterId: `workspace-media-asset:${Math.trunc(assetId)}`,
        targetUrl: cacheTargetUrl,
        version: version || `asset:${Math.trunc(assetId)}`,
      }),
      upstreamUrl,
    });

    res.setHeader("Cache-Control", "private, max-age=86400, stale-while-revalidate=604800");
    res.sendFile(posterPath);
  } catch (error) {
    console.error("[workspace] Failed to build media asset poster", error);
    res.status(502).json({
      error: error instanceof Error ? error.message : "Failed to build media asset poster.",
    });
  }
});

app.get("/api/workspace/project-video", async (req, res) => {
  const session = await auth.api.getSession({
    headers: fromNodeHeaders(req.headers),
  });

  if (!session?.user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const path = typeof req.query.path === "string" ? req.query.path.trim() : "";
  if (!path) {
    res.status(400).json({ error: "Project video path is required." });
    return;
  }

  try {
    const upstreamUrl = getWorkspaceProjectVideoProxyTarget(path);
    res.setHeader("Cache-Control", "private, max-age=600, stale-while-revalidate=60");
    await proxyVideoResponse(req, res, upstreamUrl, "Failed to load project video.");
  } catch (error) {
    console.error("[workspace] Failed to proxy project video", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to proxy project video.",
    });
  }
});

app.get("/api/workspace/projects/:projectId/segment-editor", async (req, res) => {
  const session = await auth.api.getSession({
    headers: fromNodeHeaders(req.headers),
  });

  if (!session?.user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const projectId = Number(req.params.projectId ?? 0);
  if (!Number.isFinite(projectId) || projectId <= 0) {
    res.status(400).json({ error: "Project id is required." });
    return;
  }

  try {
    const shouldBypassCache = ["1", "true", "yes"].includes(
      String(req.query.refresh ?? req.query.bypassCache ?? "").trim().toLowerCase(),
    );
    const data = await getWorkspaceSegmentEditorSession(session.user, projectId, {
      bypassCache: shouldBypassCache,
    });
    res.json({ data });
  } catch (error) {
    if (error instanceof WorkspaceSegmentEditorError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }

    console.error("[workspace] Failed to load segment editor session", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to load segment editor session.",
    });
  }
});

app.get("/api/workspace/project-segment-video", async (req, res) => {
  const session = await auth.api.getSession({
    headers: fromNodeHeaders(req.headers),
  });

  if (!session?.user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const projectId = Number(req.query.projectId ?? 0);
  const segmentIndex = Number(req.query.segmentIndex ?? -1);
  const delivery = typeof req.query.delivery === "string" ? req.query.delivery.trim() : "preview";
  const source = typeof req.query.source === "string" ? req.query.source.trim() : "";

  if (!Number.isFinite(projectId) || projectId <= 0) {
    res.status(400).json({ error: "Project id is required." });
    return;
  }

  if (!Number.isFinite(segmentIndex) || segmentIndex < 0) {
    res.status(400).json({ error: "Segment index is required." });
    return;
  }

  if (!isWorkspaceSegmentEditorVideoSource(source)) {
    res.status(400).json({ error: "Segment video source is invalid." });
    return;
  }

  if (!isWorkspaceSegmentEditorVideoDelivery(delivery)) {
    res.status(400).json({ error: "Segment video delivery is invalid." });
    return;
  }

  try {
    const target = await getWorkspaceProjectSegmentVideoProxyTarget(session.user, {
      delivery,
      projectId,
      segmentIndex,
      source,
    });
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    await proxyVideoResponse(req, res, target.url, "Failed to load segment video.", target.headers);
  } catch (error) {
    if (error instanceof WorkspaceSegmentEditorError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }

    console.error("[workspace] Failed to proxy segment video", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to proxy segment video.",
    });
  }
});

app.get("/api/payments/checkout/:productId", async (req, res) => {
  const session = await auth.api.getSession({
    headers: fromNodeHeaders(req.headers),
  });

  if (!session?.user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const productId = String(req.params.productId ?? "").trim().toLowerCase();
  if (!isCheckoutProductId(productId)) {
    res.status(400).json({ error: "Unknown checkout product." });
    return;
  }

  try {
    const mode = String(req.query.mode ?? "").trim().toLowerCase();
    if (mode === "widget" && shouldSimulateCheckoutPayment(session.user)) {
      const simulatedPayment = await simulateCheckoutPayment(productId, session.user);
      res.json({ data: { simulatedPayment } });
      return;
    }

    if (mode === "widget") {
      try {
        const widget = await getCheckoutWidgetSession(productId, session.user);
        res.json({ data: { widget, url: widget.url } });
        return;
      } catch (widgetError) {
        if (widgetError instanceof CheckoutProductUnavailableError) {
          throw widgetError;
        }

        const url = await getCheckoutUrl(productId, session.user);
        res.json({
          data: { url },
          warning: widgetError instanceof Error ? widgetError.message : "Payment widget unavailable.",
        });
        return;
      }
    }

    const url = await getCheckoutUrl(productId, session.user);
    res.json({ data: { url } });
  } catch (error) {
    const statusCode = error instanceof CheckoutProductUnavailableError ? 409 : error instanceof CheckoutConfigError ? 503 : 500;
    res.status(statusCode).json({
      error: error instanceof Error ? error.message : "Failed to prepare checkout.",
    });
  }
});

app.all(/^\/api\/auth(\/.*)?$/, toNodeHandler(auth));

app.use(express.json({ limit: "90mb" }));

app.post("/api/client-events", async (req, res) => {
  const session = await auth.api.getSession({
    headers: fromNodeHeaders(req.headers),
  });

  const eventName = typeof req.body?.event === "string" ? req.body.event.trim() : "";
  const level = req.body?.level === "debug" || req.body?.level === "info" || req.body?.level === "warn" || req.body?.level === "error"
    ? req.body.level
    : "info";
  const payload =
    req.body?.payload && typeof req.body.payload === "object" && !Array.isArray(req.body.payload)
      ? req.body.payload
      : {};

  if (!eventName) {
    res.status(400).json({ error: "Client event name is required." });
    return;
  }

  logServerEvent(level, eventName, {
    ...payload,
    authUserEmail: session?.user?.email ?? null,
    source: "client",
  });

  res.status(202).json({ data: { ok: true } });
});

app.post("/api/contact/agency", async (req, res) => {
  try {
    const submission = parseAgencyContactSubmission(req.body);
    await sendAgencyContactSubmission(submission);
    res.status(201).json({ data: { ok: true } });
  } catch (error) {
    if (error instanceof AgencyContactValidationError) {
      res.status(400).json({ error: error.message });
      return;
    }

    console.error("[contact] Failed to process agency contact form", error);
    res.status(500).json({
      error: "Не удалось отправить заявку. Попробуйте ещё раз через пару минут.",
    });
  }
});

app.post("/api/studio/media-upload/init", async (req, res) => {
  const session = await auth.api.getSession({
    headers: fromNodeHeaders(req.headers),
  });

  if (!session?.user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const fileName = typeof req.body?.fileName === "string" ? req.body.fileName.trim() : "";
  const mimeType = typeof req.body?.mimeType === "string" ? req.body.mimeType.trim() : "";
  const kind = typeof req.body?.kind === "string" ? req.body.kind.trim() : "";
  const mediaType = typeof req.body?.mediaType === "string" ? req.body.mediaType.trim() : "";
  const role = typeof req.body?.role === "string" ? req.body.role.trim() : "";
  const language = typeof req.body?.language === "string" ? req.body.language.trim() : "";
  const projectId = normalizeRequestPositiveInteger(req.body?.projectId);
  const segmentIndex = normalizeRequestNonNegativeInteger(req.body?.segmentIndex);
  const sizeBytes = normalizeRequestPositiveInteger(req.body?.sizeBytes);

  if (!fileName || !kind || !mediaType) {
    res.status(400).json({ error: "fileName, kind and mediaType are required." });
    return;
  }

  try {
    const externalUserId = await resolvePreferredExternalUserId(session.user);
    const data = await postAdsflowJson<AdsflowMediaUploadSessionPayload>(
      "/api/media/uploads/init",
      {
        admin_token: env.adsflowAdminToken,
        external_user_id: externalUserId,
        file_name: fileName,
        kind,
        language,
        media_type: mediaType,
        mime_type: mimeType || undefined,
        project_id: projectId,
        role: role || kind,
        segment_index: segmentIndex,
        size_bytes: sizeBytes,
        user_email: session.user.email ?? undefined,
        user_name: session.user.name ?? undefined,
      },
      upstreamPolicies.adsflowMutation,
      {
        assetKind: "media-upload",
        endpoint: "media.uploads.init",
      },
    );
    res.json({ data });
  } catch (error) {
    console.error("[studio] Failed to initialize media upload", error);
    res.status(502).json({
      error: error instanceof Error ? error.message : "Failed to initialize media upload.",
    });
  }
});

app.post("/api/studio/media-upload/complete", async (req, res) => {
  const session = await auth.api.getSession({
    headers: fromNodeHeaders(req.headers),
  });

  if (!session?.user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const assetId = normalizeRequestPositiveInteger(req.body?.assetId);
  const role = typeof req.body?.role === "string" ? req.body.role.trim() : "";
  const language = typeof req.body?.language === "string" ? req.body.language.trim() : "";
  const projectId = normalizeRequestPositiveInteger(req.body?.projectId);
  const segmentIndex = normalizeRequestNonNegativeInteger(req.body?.segmentIndex);

  if (!assetId) {
    res.status(400).json({ error: "assetId is required." });
    return;
  }

  try {
    const externalUserId = await resolvePreferredExternalUserId(session.user);
    const data = await postAdsflowJson<AdsflowMediaUploadSessionPayload>(
      "/api/media/uploads/complete",
      {
        admin_token: env.adsflowAdminToken,
        asset_id: assetId,
        external_user_id: externalUserId,
        language,
        project_id: projectId,
        role: role || undefined,
        segment_index: segmentIndex,
        user_email: session.user.email ?? undefined,
        user_name: session.user.name ?? undefined,
      },
      upstreamPolicies.adsflowMutation,
      {
        assetKind: "media-upload",
        endpoint: "media.uploads.complete",
      },
    );
    res.json({ data });
  } catch (error) {
    console.error("[studio] Failed to complete media upload", error);
    res.status(502).json({
      error: error instanceof Error ? error.message : "Failed to complete media upload.",
    });
  }
});

app.post("/api/workspace/publish/bootstrap", async (req, res) => {
  const session = await auth.api.getSession({
    headers: fromNodeHeaders(req.headers),
  });

  if (!session?.user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const videoProjectId = Number(req.body?.videoProjectId ?? 0);
  if (!Number.isFinite(videoProjectId) || videoProjectId <= 0) {
    res.status(400).json({ error: "Video project id is required." });
    return;
  }

  try {
    const data = await getWorkspacePublishBootstrap(session.user, videoProjectId);
    res.json({ data });
  } catch (error) {
    console.error("[workspace] Failed to bootstrap publish modal", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to load publish options.",
    });
  }
});

app.post("/api/workspace/youtube/connect-url", async (req, res) => {
  const session = await auth.api.getSession({
    headers: fromNodeHeaders(req.headers),
  });

  if (!session?.user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const url = await getWorkspaceYoutubeConnectUrl(session.user, {
      videoProjectId: Number(req.body?.videoProjectId ?? 0) || null,
    });
    res.json({ data: { url } });
  } catch (error) {
    console.error("[workspace] Failed to build YouTube connect url", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to build YouTube connect url.",
    });
  }
});

app.post("/api/workspace/youtube/disconnect", async (req, res) => {
  const session = await auth.api.getSession({
    headers: fromNodeHeaders(req.headers),
  });

  if (!session?.user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const videoProjectId = Number(req.body?.videoProjectId ?? 0);
  const channelPk = Number(req.body?.channelPk ?? 0);

  if (!Number.isFinite(videoProjectId) || videoProjectId <= 0) {
    res.status(400).json({ error: "Video project id is required." });
    return;
  }

  if (!Number.isFinite(channelPk) || channelPk <= 0) {
    res.status(400).json({ error: "YouTube channel is required." });
    return;
  }

  try {
    const data = await disconnectWorkspaceYoutubeChannel(session.user, {
      channelPk,
      videoProjectId,
    });
    res.json({ data });
  } catch (error) {
    console.error("[workspace] Failed to disconnect YouTube channel", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to disconnect YouTube channel.",
    });
  }
});

app.post("/api/workspace/publish/youtube", async (req, res) => {
  const session = await auth.api.getSession({
    headers: fromNodeHeaders(req.headers),
  });

  if (!session?.user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const videoProjectId = Number(req.body?.videoProjectId ?? 0);
  const channelPk = Number(req.body?.channelPk ?? 0);
  const title = typeof req.body?.title === "string" ? req.body.title.trim() : "";
  const description = typeof req.body?.description === "string" ? req.body.description.trim() : "";
  const hashtags = typeof req.body?.hashtags === "string" ? req.body.hashtags.trim() : "";
  const publishAt = typeof req.body?.publishAt === "string" ? req.body.publishAt.trim() : "";

  if (!Number.isFinite(videoProjectId) || videoProjectId <= 0) {
    res.status(400).json({ error: "Video project id is required." });
    return;
  }

  if (!Number.isFinite(channelPk) || channelPk <= 0) {
    res.status(400).json({ error: "YouTube channel is required." });
    return;
  }

  if (!title) {
    res.status(400).json({ error: "Publish title is required." });
    return;
  }

  try {
    const data = await startWorkspaceYoutubePublish(session.user, {
      channelPk,
      description,
      hashtags,
      publishAt: publishAt || null,
      title,
      videoProjectId,
    });
    res.json({ data });
  } catch (error) {
    console.error("[workspace] Failed to queue YouTube publish", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to queue YouTube publish.",
    });
  }
});

app.get("/api/workspace/publish/jobs/:jobId", async (req, res) => {
  const session = await auth.api.getSession({
    headers: fromNodeHeaders(req.headers),
  });

  if (!session?.user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const jobId = String(req.params.jobId ?? "").trim();
  if (!jobId) {
    res.status(400).json({ error: "Publish job id is required." });
    return;
  }

  try {
    const data = await getWorkspacePublishJobStatus(session.user, jobId);
    if (isWorkspacePublishSuccessStatus(data.status) && data.videoProjectId) {
      await invalidateWorkspaceProjectsCache(session.user);
    }
    res.json({ data });
  } catch (error) {
    console.error("[workspace] Failed to fetch publish job status", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to fetch publish job status.",
    });
  }
});

app.post("/api/studio/generate", async (req, res) => {
  const session = await auth.api.getSession({
    headers: fromNodeHeaders(req.headers),
  });

  if (!session?.user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const requestBody = isMultipartFormRequest(req)
    ? await parseStudioGenerateMultipartBody(req)
    : {
        brandLogoAssetId: normalizeRequestPositiveInteger(req.body?.brandLogoAssetId),
        brandLogoFileDataUrl:
          typeof req.body?.brandLogoFileDataUrl === "string" ? req.body.brandLogoFileDataUrl.trim() : "",
        brandLogoFileMimeType:
          typeof req.body?.brandLogoFileMimeType === "string" ? req.body.brandLogoFileMimeType.trim() : "",
        brandLogoFileName: typeof req.body?.brandLogoFileName === "string" ? req.body.brandLogoFileName.trim() : "",
        brandText: typeof req.body?.brandText === "string" ? req.body.brandText.trim() : "",
        customMusicFileDataUrl:
          typeof req.body?.customMusicFileDataUrl === "string" ? req.body.customMusicFileDataUrl.trim() : "",
        customMusicAssetId: normalizeRequestPositiveInteger(req.body?.customMusicAssetId),
        customMusicFileName: typeof req.body?.customMusicFileName === "string" ? req.body.customMusicFileName.trim() : "",
        customVideoFileDataUrl:
          typeof req.body?.customVideoFileDataUrl === "string" ? req.body.customVideoFileDataUrl.trim() : "",
        customVideoAssetId: normalizeRequestPositiveInteger(req.body?.customVideoAssetId),
        customVideoFileMimeType:
          typeof req.body?.customVideoFileMimeType === "string" ? req.body.customVideoFileMimeType.trim() : "",
        customVideoFileName: typeof req.body?.customVideoFileName === "string" ? req.body.customVideoFileName.trim() : "",
        editedFromProjectAdId: normalizeRequestPositiveInteger(req.body?.editedFromProjectAdId),
        isRegeneration: Boolean(req.body?.isRegeneration),
        language: typeof req.body?.language === "string" ? req.body.language.trim() : "",
        musicType: typeof req.body?.musicType === "string" ? req.body.musicType.trim() : "",
        projectId: Number(req.body?.projectId ?? 0),
        prompt: typeof req.body?.prompt === "string" ? req.body.prompt.trim() : "",
        segmentEditor:
          req.body?.segmentEditor && typeof req.body.segmentEditor === "object" ? req.body.segmentEditor : undefined,
        subtitleColorId: typeof req.body?.subtitleColorId === "string" ? req.body.subtitleColorId.trim() : "",
        subtitleEnabled: req.body?.subtitleEnabled !== false,
        subtitleStyleId: typeof req.body?.subtitleStyleId === "string" ? req.body.subtitleStyleId.trim() : "",
        versionRootProjectAdId: normalizeRequestPositiveInteger(req.body?.versionRootProjectAdId),
        videoMode: typeof req.body?.videoMode === "string" ? req.body.videoMode.trim() : "",
        voiceEnabled: req.body?.voiceEnabled !== false,
        voiceId: typeof req.body?.voiceId === "string" ? req.body.voiceId.trim() : "",
      };
  const prompt = requestBody.prompt;
  const isRegeneration = requestBody.isRegeneration;
  const language = requestBody.language;
  const voiceId = requestBody.voiceId;
  const musicType = requestBody.musicType;
  const voiceEnabled = requestBody.voiceEnabled;
  const brandLogoFileDataUrl = requestBody.brandLogoFileDataUrl;
  const brandLogoAssetId = requestBody.brandLogoAssetId;
  const brandLogoFileMimeType = requestBody.brandLogoFileMimeType;
  const brandLogoFileName = requestBody.brandLogoFileName;
  const brandText = requestBody.brandText;
  const customMusicFileName = requestBody.customMusicFileName;
  const customMusicFileDataUrl = requestBody.customMusicFileDataUrl;
  const customMusicAssetId = requestBody.customMusicAssetId;
  const videoMode = requestBody.videoMode;
  const subtitleStyleId = requestBody.subtitleStyleId;
  const subtitleColorId = requestBody.subtitleColorId;
  const subtitleEnabled = requestBody.subtitleEnabled;
  const customVideoFileName = requestBody.customVideoFileName;
  const customVideoFileMimeType = requestBody.customVideoFileMimeType;
  const customVideoFileDataUrl = requestBody.customVideoFileDataUrl;
  const customVideoAssetId = requestBody.customVideoAssetId;
  const editedFromProjectAdId = requestBody.editedFromProjectAdId;
  const projectId = requestBody.projectId;
  const segmentEditor = requestBody.segmentEditor;
  const versionRootProjectAdId = requestBody.versionRootProjectAdId;

  console.info("[studio] generate.brand-input", {
    brandLogoDataUrlLength: brandLogoFileDataUrl.length,
    brandLogoFileName: brandLogoFileName || null,
    brandLogoMimeType: brandLogoFileMimeType || null,
    brandTextLength: brandText.trim().length,
    hasBrandLogo: Boolean(brandLogoFileDataUrl),
    hasBrandText: Boolean(brandText.trim()),
    isRegeneration,
    language: language || null,
    projectId: Number.isFinite(projectId) && projectId > 0 ? projectId : null,
    segmentEditorActive: Boolean(segmentEditor),
    voiceId: voiceId || null,
  });

  if (!prompt) {
    res.status(400).json({ error: "Prompt is required." });
    return;
  }

  try {
    const job = await createStudioGenerationJob(prompt, session.user, {
      brandLogoFileDataUrl,
      brandLogoAssetId,
      brandLogoFileMimeType,
      brandLogoFileName,
      brandText,
      customMusicFileDataUrl,
      customMusicAssetId,
      customMusicFileName,
      customVideoFileDataUrl,
      customVideoAssetId,
      customVideoFileMimeType,
      customVideoFileName,
      editedFromProjectAdId: editedFromProjectAdId ?? undefined,
      isRegeneration,
      language,
      musicType,
      projectId: Number.isFinite(projectId) && projectId > 0 ? projectId : undefined,
      segmentEditor,
      subtitleEnabled,
      subtitleColorId,
      subtitleStyleId,
      versionRootProjectAdId: versionRootProjectAdId ?? undefined,
      videoMode,
      voiceEnabled,
      voiceId,
    });
    res.json({ data: job });
  } catch (error) {
    console.error("[studio] Failed to create generation job", error);
    const statusCode = error instanceof WorkspaceCreditLimitError ? 402 : 500;

    res.status(statusCode).json({
      error: error instanceof Error ? error.message : "Failed to create generation job.",
    });
  }
});

app.post("/api/studio/segment-ai-photo/generate", async (req, res) => {
  const session = await auth.api.getSession({
    headers: fromNodeHeaders(req.headers),
  });

  if (!session?.user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const prompt = typeof req.body?.prompt === "string" ? req.body.prompt.trim() : "";
  const language = typeof req.body?.language === "string" ? req.body.language.trim() : "";
  const quality = typeof req.body?.quality === "string" ? req.body.quality.trim() : "";
  const projectId = Number(req.body?.projectId ?? 0);
  const segmentIndex = Number(req.body?.segmentIndex ?? -1);

  if (!prompt) {
    res.status(400).json({ error: "Prompt is required." });
    return;
  }

  try {
    const result = await generateStudioSegmentAiPhoto(prompt, session.user, {
      language,
      quality,
      projectId: Number.isFinite(projectId) && projectId > 0 ? projectId : undefined,
      segmentIndex: Number.isFinite(segmentIndex) && segmentIndex >= 0 ? segmentIndex : undefined,
    });
    res.json({ data: result });
  } catch (error) {
    console.error("[studio] Failed to generate segment AI photo", error);
    const statusCode = error instanceof WorkspaceCreditLimitError ? 402 : 500;

    res.status(statusCode).json({
      error: error instanceof Error ? error.message : "Failed to generate segment AI photo.",
    });
  }
});

app.post("/api/studio/segment-image-upscale/jobs", async (req, res) => {
  const session = await auth.api.getSession({
    headers: fromNodeHeaders(req.headers),
  });

  if (!session?.user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const imageAssetId = normalizeRequestPositiveInteger(req.body?.imageAssetId);
  const imageDataUrl = typeof req.body?.imageDataUrl === "string" ? req.body.imageDataUrl.trim() : "";
  const imageFileName = typeof req.body?.imageFileName === "string" ? req.body.imageFileName.trim() : "";
  const language = typeof req.body?.language === "string" ? req.body.language.trim() : "";
  const projectId = Number(req.body?.projectId ?? 0);
  const segmentIndex = Number(req.body?.segmentIndex ?? -1);

  if (!imageDataUrl && !imageAssetId) {
    res.status(400).json({ error: "Image asset id or image data URL is required." });
    return;
  }

  try {
    const job = await createStudioSegmentImageUpscaleJob(imageDataUrl || undefined, session.user, {
      fileName: imageFileName || undefined,
      imageAssetId,
      language,
      projectId: Number.isFinite(projectId) && projectId > 0 ? projectId : undefined,
      segmentIndex: Number.isFinite(segmentIndex) && segmentIndex >= 0 ? segmentIndex : undefined,
    });
    res.json({ data: job });
  } catch (error) {
    console.error("[studio] Failed to create segment image upscale job", error);
    const statusCode = error instanceof WorkspaceCreditLimitError ? 402 : 500;

    res.status(statusCode).json({
      error: error instanceof Error ? error.message : "Failed to create segment image upscale job.",
    });
  }
});

app.get("/api/studio/segment-image-upscale/jobs/:jobId", async (req, res) => {
  const session = await auth.api.getSession({
    headers: fromNodeHeaders(req.headers),
  });

  if (!session?.user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const status = await getStudioSegmentImageUpscaleJobStatus(req.params.jobId, session.user);
    res.json({ data: status });
  } catch (error) {
    console.error("[studio] Failed to get segment image upscale status", error);
    const statusCode = error instanceof WorkspaceCreditLimitError ? 402 : 500;

    res.status(statusCode).json({
      error: error instanceof Error ? error.message : "Failed to get segment image upscale status.",
    });
  }
});

app.post("/api/studio/segment-image-edit/jobs", async (req, res) => {
  const session = await auth.api.getSession({
    headers: fromNodeHeaders(req.headers),
  });

  if (!session?.user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const prompt = typeof req.body?.prompt === "string" ? req.body.prompt.trim() : "";
  const imageAssetId = normalizeRequestPositiveInteger(req.body?.imageAssetId);
  const imageDataUrl = typeof req.body?.imageDataUrl === "string" ? req.body.imageDataUrl.trim() : "";
  const imageFileName = typeof req.body?.imageFileName === "string" ? req.body.imageFileName.trim() : "";
  const language = typeof req.body?.language === "string" ? req.body.language.trim() : "";
  const projectId = Number(req.body?.projectId ?? 0);
  const segmentIndex = Number(req.body?.segmentIndex ?? -1);

  if (!prompt) {
    res.status(400).json({ error: "Prompt is required." });
    return;
  }

  if (!imageDataUrl && !imageAssetId) {
    res.status(400).json({ error: "Image asset id or image data URL is required." });
    return;
  }

  console.info("[studio] segment-image-edit route: request received", JSON.stringify({ imageAssetId, imageDataUrl: imageDataUrl ? `[dataUrl len=${imageDataUrl.length}]` : null, imageFileName, projectId, segmentIndex }));
  try {
    const job = await createStudioSegmentImageEditJob(prompt, imageDataUrl || undefined, session.user, {
      fileName: imageFileName || undefined,
      imageAssetId,
      language,
      projectId: Number.isFinite(projectId) && projectId > 0 ? projectId : undefined,
      segmentIndex: Number.isFinite(segmentIndex) && segmentIndex >= 0 ? segmentIndex : undefined,
    });
    res.json({ data: job });
  } catch (error) {
    console.error("[studio] Failed to create segment image edit job", { imageAssetId, imageFileName, projectId, segmentIndex }, error);
    const statusCode = error instanceof WorkspaceCreditLimitError ? 402 : 500;

    res.status(statusCode).json({
      error: error instanceof Error ? error.message : "Failed to create segment image edit job.",
    });
  }
});

app.get("/api/studio/segment-image-edit/jobs/:jobId", async (req, res) => {
  const session = await auth.api.getSession({
    headers: fromNodeHeaders(req.headers),
  });

  if (!session?.user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const status = await getStudioSegmentImageEditJobStatus(req.params.jobId, session.user);
    res.json({ data: status });
  } catch (error) {
    console.error("[studio] Failed to get segment image edit status", error);
    const statusCode = error instanceof WorkspaceCreditLimitError ? 402 : 500;

    res.status(statusCode).json({
      error: error instanceof Error ? error.message : "Failed to get segment image edit status.",
    });
  }
});

app.post("/api/studio/segment-ai-photo/improve-prompt", async (req, res) => {
  const session = await auth.api.getSession({
    headers: fromNodeHeaders(req.headers),
  });

  if (!session?.user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const prompt = typeof req.body?.prompt === "string" ? req.body.prompt.trim() : "";
  const language = typeof req.body?.language === "string" ? req.body.language.trim() : "";
  const mode = typeof req.body?.mode === "string" ? req.body.mode.trim() : "";

  if (!prompt) {
    res.status(400).json({ error: "Prompt is required." });
    return;
  }

  try {
    const result = await improveStudioSegmentAiPhotoPrompt(prompt, { language, mode });
    res.json({ data: result });
  } catch (error) {
    console.error("[studio] Failed to improve segment AI photo prompt", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to improve segment AI photo prompt.",
    });
  }
});

app.post("/api/studio/translate", async (req, res) => {
  const session = await auth.api.getSession({
    headers: fromNodeHeaders(req.headers),
  });

  if (!session?.user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const sourceLanguage = typeof req.body?.sourceLanguage === "string" ? req.body.sourceLanguage.trim() : "";
  const targetLanguage = typeof req.body?.targetLanguage === "string" ? req.body.targetLanguage.trim() : "";
  const texts = Array.isArray(req.body?.texts)
    ? req.body.texts.map((text: unknown) => (typeof text === "string" ? text : String(text ?? "")))
    : [];

  try {
    const result = await translateStudioTexts(texts, {
      sourceLanguage,
      targetLanguage,
    });
    res.json({ data: result });
  } catch (error) {
    console.error("[studio] Failed to translate segment texts", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to translate segment texts.",
    });
  }
});

app.post("/api/studio/segment-ai-photo/jobs", async (req, res) => {
  const session = await auth.api.getSession({
    headers: fromNodeHeaders(req.headers),
  });

  if (!session?.user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const prompt = typeof req.body?.prompt === "string" ? req.body.prompt.trim() : "";
  const language = typeof req.body?.language === "string" ? req.body.language.trim() : "";
  const quality = typeof req.body?.quality === "string" ? req.body.quality.trim() : "";
  const projectId = Number(req.body?.projectId ?? 0);
  const segmentIndex = Number(req.body?.segmentIndex ?? -1);

  if (!prompt) {
    res.status(400).json({ error: "Prompt is required." });
    return;
  }

  try {
    const job = await createStudioSegmentAiPhotoJob(prompt, session.user, {
      language,
      quality,
      projectId: Number.isFinite(projectId) && projectId > 0 ? projectId : undefined,
      segmentIndex: Number.isFinite(segmentIndex) && segmentIndex >= 0 ? segmentIndex : undefined,
    });
    res.json({ data: job });
  } catch (error) {
    console.error("[studio] Failed to create segment AI photo job", error);
    const statusCode = error instanceof WorkspaceCreditLimitError ? 402 : 500;

    res.status(statusCode).json({
      error: error instanceof Error ? error.message : "Failed to create segment AI photo job.",
    });
  }
});

app.get("/api/studio/segment-ai-photo/jobs/:jobId", async (req, res) => {
  const session = await auth.api.getSession({
    headers: fromNodeHeaders(req.headers),
  });

  if (!session?.user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const status = await getStudioSegmentAiPhotoJobStatus(req.params.jobId, session.user);
    res.json({ data: status });
  } catch (error) {
    console.error("[studio] Failed to fetch segment AI photo job status", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to fetch segment AI photo job status.",
    });
  }
});

app.post("/api/studio/segment-ai-video/jobs", async (req, res) => {
  const session = await auth.api.getSession({
    headers: fromNodeHeaders(req.headers),
  });

  if (!session?.user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const prompt = typeof req.body?.prompt === "string" ? req.body.prompt.trim() : "";
  const language = typeof req.body?.language === "string" ? req.body.language.trim() : "";
  const quality = typeof req.body?.quality === "string" ? req.body.quality.trim() : "";
  const imageDataUrl = typeof req.body?.imageDataUrl === "string" ? req.body.imageDataUrl.trim() : "";
  const imageFileName = typeof req.body?.imageFileName === "string" ? req.body.imageFileName.trim() : "";
  const imageMimeType = typeof req.body?.imageMimeType === "string" ? req.body.imageMimeType.trim() : "";
  const imageAssetId = Number(req.body?.imageAssetId ?? 0);
  const projectId = Number(req.body?.projectId ?? 0);
  const segmentIndex = Number(req.body?.segmentIndex ?? -1);

  if (!prompt) {
    res.status(400).json({ error: "Prompt is required." });
    return;
  }

  try {
    const job = await createStudioSegmentAiVideoJob(prompt, session.user, {
      imageAssetId: Number.isFinite(imageAssetId) && imageAssetId > 0 ? imageAssetId : undefined,
      imageDataUrl: imageDataUrl || undefined,
      imageFileName: imageFileName || undefined,
      imageMimeType: imageMimeType || undefined,
      language,
      quality,
      projectId: Number.isFinite(projectId) && projectId > 0 ? projectId : undefined,
      segmentIndex: Number.isFinite(segmentIndex) && segmentIndex >= 0 ? segmentIndex : undefined,
    });
    res.json({ data: job });
  } catch (error) {
    console.error("[studio] Failed to create segment AI video job", error);
    const statusCode = error instanceof WorkspaceCreditLimitError ? 402 : 500;

    res.status(statusCode).json({
      error: error instanceof Error ? error.message : "Failed to create segment AI video job.",
    });
  }
});

app.get("/api/studio/segment-ai-video/jobs/:jobId", async (req, res) => {
  const session = await auth.api.getSession({
    headers: fromNodeHeaders(req.headers),
  });

  if (!session?.user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const status = await getStudioSegmentAiVideoJobStatus(req.params.jobId, session.user);
    res.json({ data: status });
  } catch (error) {
    console.error("[studio] Failed to fetch segment AI video job status", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to fetch segment AI video job status.",
    });
  }
});

app.get("/api/studio/segment-ai-video/jobs/:jobId/video", async (req, res) => {
  const session = await auth.api.getSession({
    headers: fromNodeHeaders(req.headers),
  });

  if (!session?.user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const asset = await getStudioSegmentAiVideoPlaybackAsset(req.params.jobId, session.user);
    res.setHeader("Accept-Ranges", "bytes");
    res.setHeader("Cache-Control", "private, max-age=31536000, immutable");
    res.type(asset.contentType || "video/mp4");
    res.sendFile(asset.absolutePath);
  } catch (error) {
    console.error("[studio] Failed to load segment AI video playback", {
      error: getServerErrorMessage(error, "Failed to load generated segment AI video."),
      jobId: req.params.jobId,
    });
    res.status(502).json({
      error: error instanceof Error ? error.message : "Failed to load generated segment AI video.",
    });
  }
});

app.get("/api/studio/segment-ai-video/jobs/:jobId/poster", async (req, res) => {
  const session = await auth.api.getSession({
    headers: fromNodeHeaders(req.headers),
  });

  if (!session?.user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const posterPath = await getStudioSegmentAiVideoJobPosterPath(req.params.jobId, session.user);
    res.setHeader("Cache-Control", "private, max-age=86400, stale-while-revalidate=604800");
    res.type("jpg");
    res.sendFile(posterPath);
  } catch (error) {
    console.error("[studio] Failed to load generated segment AI video poster", {
      error: getServerErrorMessage(error, "Failed to load generated segment AI video poster."),
      jobId: req.params.jobId,
    });
    res.status(502).json({
      error: error instanceof Error ? error.message : "Failed to load generated segment AI video poster.",
    });
  }
});

app.post("/api/studio/segment-photo-animation/jobs", async (req, res) => {
  const session = await auth.api.getSession({
    headers: fromNodeHeaders(req.headers),
  });

  if (!session?.user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const prompt = typeof req.body?.prompt === "string" ? req.body.prompt.trim() : "";
  const language = typeof req.body?.language === "string" ? req.body.language.trim() : "";
  const quality = typeof req.body?.quality === "string" ? req.body.quality.trim() : "";
  const customVideoAssetId = normalizeRequestPositiveInteger(req.body?.customVideoAssetId);
  const customVideoFileDataUrl =
    typeof req.body?.customVideoFileDataUrl === "string" ? req.body.customVideoFileDataUrl.trim() : "";
  const customVideoFileMimeType =
    typeof req.body?.customVideoFileMimeType === "string" ? req.body.customVideoFileMimeType.trim() : "";
  const customVideoFileName =
    typeof req.body?.customVideoFileName === "string" ? req.body.customVideoFileName.trim() : "";
  const projectId = Number(req.body?.projectId ?? 0);
  const segmentIndex = Number(req.body?.segmentIndex ?? -1);

  if (!prompt) {
    res.status(400).json({ error: "Prompt is required." });
    return;
  }

  if (!customVideoAssetId && !customVideoFileDataUrl) {
    res.status(400).json({ error: "Photo source asset id or image data URL is required." });
    return;
  }

  try {
    const job = await createStudioSegmentPhotoAnimationJob(prompt, session.user, {
      customVideoAssetId,
      customVideoFileDataUrl: customVideoFileDataUrl || undefined,
      customVideoFileMimeType: customVideoFileMimeType || undefined,
      customVideoFileName: customVideoFileName || undefined,
      language,
      projectId: Number.isFinite(projectId) && projectId > 0 ? projectId : undefined,
      quality,
      segmentIndex: Number.isFinite(segmentIndex) && segmentIndex >= 0 ? segmentIndex : undefined,
    });
    res.json({ data: job });
  } catch (error) {
    console.error("[studio] Failed to create segment photo animation job", error);
    const statusCode = error instanceof WorkspaceCreditLimitError ? 402 : 500;

    res.status(statusCode).json({
      error: error instanceof Error ? error.message : "Failed to create segment photo animation job.",
    });
  }
});

app.get("/api/studio/segment-photo-animation/jobs/:jobId", async (req, res) => {
  const session = await auth.api.getSession({
    headers: fromNodeHeaders(req.headers),
  });

  if (!session?.user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const status = await getStudioSegmentPhotoAnimationJobStatus(req.params.jobId, session.user);
    res.json({ data: status });
  } catch (error) {
    console.error("[studio] Failed to fetch segment photo animation job status", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to fetch segment photo animation job status.",
    });
  }
});

app.get("/api/studio/segment-photo-animation/jobs/:jobId/video", async (req, res) => {
  const session = await auth.api.getSession({
    headers: fromNodeHeaders(req.headers),
  });

  if (!session?.user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const asset = await getStudioSegmentPhotoAnimationPlaybackAsset(req.params.jobId, session.user);
    res.setHeader("Accept-Ranges", "bytes");
    res.setHeader("Cache-Control", "private, max-age=31536000, immutable");
    res.type(asset.contentType || "video/mp4");
    res.sendFile(asset.absolutePath);
  } catch (error) {
    console.error("[studio] Failed to load segment photo animation playback", {
      error: getServerErrorMessage(error, "Failed to load generated segment photo animation."),
      jobId: req.params.jobId,
    });
    res.status(502).json({
      error: error instanceof Error ? error.message : "Failed to load generated segment photo animation.",
    });
  }
});

app.get("/api/studio/segment-photo-animation/jobs/:jobId/poster", async (req, res) => {
  const session = await auth.api.getSession({
    headers: fromNodeHeaders(req.headers),
  });

  if (!session?.user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const posterPath = await getStudioSegmentPhotoAnimationJobPosterPath(req.params.jobId, session.user);
    res.setHeader("Cache-Control", "private, max-age=86400, stale-while-revalidate=604800");
    res.type("jpg");
    res.sendFile(posterPath);
  } catch (error) {
    console.error("[studio] Failed to load generated segment photo animation poster", {
      error: getServerErrorMessage(error, "Failed to load generated segment photo animation poster."),
      jobId: req.params.jobId,
    });
    res.status(502).json({
      error: error instanceof Error ? error.message : "Failed to load generated segment photo animation poster.",
    });
  }
});

app.get("/api/studio/generations/:jobId", async (req, res) => {
  const session = await auth.api.getSession({
    headers: fromNodeHeaders(req.headers),
  });

  if (!session?.user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const status = await getStudioGenerationStatus(req.params.jobId, session.user);
    if (status.generation) {
      await invalidateWorkspaceBootstrapCache(session.user);
      await invalidateWorkspaceProjectsCache(session.user);
      invalidateWorkspaceMediaLibraryCache(session.user);
      invalidateWorkspaceSegmentEditorSessionCache(session.user);
    }
    res.json({ data: status });
  } catch (error) {
    console.error("[studio] Failed to fetch generation status", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to fetch generation status.",
    });
  }
});

app.get("/api/studio/playback/:jobId", async (req, res) => {
  const session = await auth.api.getSession({
    headers: fromNodeHeaders(req.headers),
  });

  if (!session?.user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const jobId = typeof req.params.jobId === "string" ? req.params.jobId.trim() : "";
  if (!jobId) {
    res.status(400).json({ error: "Job id is required." });
    return;
  }

  const version = typeof req.query.v === "string" ? req.query.v.trim() : "";

  try {
    const asset = await getStudioPlaybackAsset(jobId, session.user, {
      version: version || null,
    });
    res.setHeader("Accept-Ranges", "bytes");
    res.setHeader("Cache-Control", "private, max-age=31536000, immutable");
    res.type(asset.contentType || "video/mp4");
    res.sendFile(asset.absolutePath);
  } catch (error) {
    const fallbackTarget = await getStudioVideoProxyTarget(jobId, session.user).catch(() => null);
    if (fallbackTarget) {
      console.warn("[studio] Falling back to direct playback", {
        error: getServerErrorMessage(error, "Failed to prepare generated video playback cache."),
        jobId,
      });
      res.setHeader("Cache-Control", "private, max-age=600, stale-while-revalidate=60");
      await proxyVideoResponse(req, res, fallbackTarget, "Failed to load generated video playback.");
      return;
    }

    console.error("[studio] Failed to load playback cache", {
      error: getServerErrorMessage(error, "Failed to load generated video playback."),
      jobId,
    });
    res.status(502).json({
      error: error instanceof Error ? error.message : "Failed to load generated video playback.",
    });
  }
});

app.get("/api/studio/video/:jobId", async (req, res) => {
  const session = await auth.api.getSession({
    headers: fromNodeHeaders(req.headers),
  });

  if (!session?.user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const upstreamUrl = await getStudioVideoProxyTarget(req.params.jobId, session.user);
    await proxyVideoResponse(req, res, upstreamUrl, "Failed to load generated video.");
  } catch (error) {
    console.error("[studio] Failed to proxy generated video", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to proxy generated video.",
    });
  }
});

app.get("/api/studio/video", async (req, res) => {
  const session = await auth.api.getSession({
    headers: fromNodeHeaders(req.headers),
  });

  if (!session?.user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const path = typeof req.query.path === "string" ? req.query.path.trim() : "";
  if (!path) {
    res.status(400).json({ error: "Video path is required." });
    return;
  }

  try {
    const upstreamUrl = getStudioVideoProxyTargetByPath(path);
    await proxyVideoResponse(req, res, upstreamUrl, "Failed to load generated video.");
  } catch (error) {
    console.error("[studio] Failed to proxy generated video by path", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to proxy generated video.",
    });
  }
});

const startServer = async () => {
  validateServerStartup();
  await ensureAuthSchema();

  app.listen(env.authServerPort, env.authServerHost, () => {
    console.info(`[auth] Better Auth server listening on ${env.authServerHost}:${env.authServerPort}`);
    console.info(`[auth] Shared auth database: ${authDatabaseConfig.description}`);
    console.info(
      `[auth] Providers loaded: smtp=${authProviderStatus.smtpConfigured}, google=${authProviderStatus.googleEnabled}, telegram=${authProviderStatus.telegramEnabled}`,
    );
  });
};

void startServer().catch((error) => {
  console.error("[auth] Failed to initialize auth server", error);
  process.exit(1);
});
