import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import express from "express";
import cors from "cors";
import { fromNodeHeaders, toNodeHandler } from "better-auth/node";
import { auth, ensureAuthSchema, signInWithTelegram } from "./auth.js";
import { authDatabaseConfig } from "./database.js";
import { authProviderStatus, env } from "./env.js";
import { getLastDevEmailPreview, getMailStatus } from "./mail.js";
import { disconnectWorkspaceYoutubeChannel, getWorkspacePublishBootstrap, getWorkspacePublishJobStatus, getWorkspaceYoutubeConnectUrl, startWorkspaceYoutubePublish, } from "./publish.js";
import { deleteWorkspaceProject, getWorkspaceProjectPlaybackAsset, getWorkspaceProjectPosterPath, getWorkspaceProjectVideoProxyTarget, getWorkspaceProjects, invalidateWorkspaceProjectsCache, WorkspaceProjectNotFoundError, } from "./projects.js";
import { getWorkspaceProjectSegmentVideoProxyTarget, WorkspaceSegmentEditorError, getWorkspaceSegmentEditorSession, } from "./segment-editor.js";
import { verifyTelegramLogin, getTelegramUserProfile } from "./telegram.js";
import { createStudioSegmentAiPhotoJob, createStudioSegmentAiVideoJob, createStudioSegmentPhotoAnimationJob, createStudioGenerationJob, generateStudioSegmentAiPhoto, getStudioSegmentAiPhotoJobStatus, getStudioSegmentAiVideoPlaybackAsset, getStudioSegmentAiVideoJobPosterPath, getStudioSegmentAiVideoJobStatus, getStudioSegmentPhotoAnimationPlaybackAsset, getStudioSegmentPhotoAnimationJobPosterPath, getStudioSegmentPhotoAnimationJobStatus, getStudioPlaybackAsset, getWorkspaceBootstrap, getStudioGenerationStatus, getStudioVideoProxyTargetByPath, getStudioVideoProxyTarget, improveStudioSegmentAiPhotoPrompt, translateStudioTexts, WorkspaceCreditLimitError, } from "./studio.js";
import { getStudioVoicePreview } from "./voice-preview.js";
import { CheckoutConfigError, getCheckoutUrl, isCheckoutProductId } from "./payments.js";
import { deleteLocalExample, getLocalExampleVideoAsset, getLocalExamplesState, saveLocalExample, } from "./local-examples.js";
import { AgencyContactValidationError, parseAgencyContactSubmission, sendAgencyContactSubmission, } from "./agency-contact.js";
const app = express();
const VIDEO_PROXY_UPSTREAM_FETCH_TIMEOUT_MS = 15_000;
const VIDEO_PROXY_UPSTREAM_MAX_ATTEMPTS = 3;
const VIDEO_PROXY_UPSTREAM_RETRY_BASE_DELAY_MS = 180;
app.set("trust proxy", true);
app.use(cors({
    credentials: true,
    origin: env.appUrl,
}));
const buildVideoProxyRequestHeaders = (req) => {
    const headers = {};
    const range = req.header("range");
    if (range)
        headers.range = range;
    const ifRange = req.header("if-range");
    if (ifRange)
        headers["if-range"] = ifRange;
    return headers;
};
const isVideoProxyStreamAbortLikeError = (error) => {
    let current = error;
    const visited = new Set();
    while (current && typeof current === "object" && !visited.has(current)) {
        visited.add(current);
        const name = "name" in current ? String(current.name ?? "") : "";
        const code = "code" in current ? String(current.code ?? "") : "";
        const message = "message" in current ? String(current.message ?? "").toLowerCase() : "";
        if (name === "AbortError" ||
            code === "ABORT_ERR" ||
            code === "ECONNRESET" ||
            code === "ERR_STREAM_PREMATURE_CLOSE" ||
            code === "UND_ERR_ABORTED" ||
            code === "UND_ERR_SOCKET" ||
            message.includes("aborted") ||
            message.includes("terminated") ||
            message.includes("premature close") ||
            message.includes("econnreset")) {
            return true;
        }
        current = "cause" in current ? current.cause : null;
    }
    return false;
};
const isVideoProxyUpstreamRetryableError = (error) => {
    if (isVideoProxyStreamAbortLikeError(error)) {
        return true;
    }
    let current = error;
    const visited = new Set();
    while (current && typeof current === "object" && !visited.has(current)) {
        visited.add(current);
        const code = "code" in current ? String(current.code ?? "") : "";
        const message = "message" in current ? String(current.message ?? "").toLowerCase() : "";
        if (code === "ETIMEDOUT" ||
            code === "UND_ERR_CONNECT_TIMEOUT" ||
            code === "UND_ERR_HEADERS_TIMEOUT" ||
            code === "EPIPE" ||
            message.includes("timeout")) {
            return true;
        }
        current = "cause" in current ? current.cause : null;
    }
    return false;
};
const waitForVideoProxyRetry = async (attempt) => {
    const delayMs = VIDEO_PROXY_UPSTREAM_RETRY_BASE_DELAY_MS * attempt;
    await new Promise((resolve) => setTimeout(resolve, delayMs));
};
const fetchVideoProxyUpstream = async (req, upstreamUrl, upstreamHeaders) => {
    let lastError = null;
    for (let attempt = 1; attempt <= VIDEO_PROXY_UPSTREAM_MAX_ATTEMPTS; attempt += 1) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), VIDEO_PROXY_UPSTREAM_FETCH_TIMEOUT_MS);
            try {
                return await fetch(upstreamUrl, {
                    headers: {
                        ...buildVideoProxyRequestHeaders(req),
                        ...(upstreamHeaders ?? {}),
                        connection: "close",
                    },
                    signal: controller.signal,
                });
            }
            finally {
                clearTimeout(timeoutId);
            }
        }
        catch (error) {
            lastError = error;
            if (attempt >= VIDEO_PROXY_UPSTREAM_MAX_ATTEMPTS || !isVideoProxyUpstreamRetryableError(error)) {
                throw error;
            }
            await waitForVideoProxyRetry(attempt);
        }
    }
    throw lastError ?? new Error("Failed to fetch upstream video.");
};
const proxyVideoResponse = async (req, res, upstreamUrl, fallbackMessage, upstreamHeaders) => {
    const upstreamResponse = await fetchVideoProxyUpstream(req, upstreamUrl, upstreamHeaders);
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
        if (value)
            res.setHeader(headerName, value);
    });
    const upstreamBody = Readable.fromWeb(upstreamResponse.body);
    try {
        await pipeline(upstreamBody, res);
    }
    catch (error) {
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
const isWorkspaceSegmentEditorVideoSource = (value) => value === "current" || value === "original";
const isWorkspaceSegmentEditorVideoDelivery = (value) => value === "preview" || value === "playback";
const isMultipartFormRequest = (req) => String(req.headers["content-type"] ?? "")
    .toLowerCase()
    .includes("multipart/form-data");
const parseServerJson = (value) => {
    const normalized = String(value ?? "").trim();
    if (!normalized) {
        return null;
    }
    try {
        return JSON.parse(normalized);
    }
    catch {
        return null;
    }
};
const getFormDataString = (formData, key) => {
    const value = formData.get(key);
    return typeof value === "string" ? value.trim() : "";
};
const getFormDataBoolean = (formData, key, defaultValue) => {
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
const getFormDataNumber = (formData, key) => {
    const value = Number(getFormDataString(formData, key));
    return Number.isFinite(value) ? value : 0;
};
const buildMultipartFileDataUrl = async (file) => {
    const buffer = Buffer.from(await file.arrayBuffer());
    const mimeType = file.type.trim() || "application/octet-stream";
    return `data:${mimeType};base64,${buffer.toString("base64")}`;
};
const parseMultipartFormData = async (req) => {
    const request = new Request(new URL(req.originalUrl, env.appUrl || "http://127.0.0.1").toString(), {
        body: Readable.toWeb(req),
        duplex: "half",
        headers: req.headers,
        method: req.method,
    });
    return request.formData();
};
const parseStudioGenerateMultipartBody = async (req) => {
    const formData = await parseMultipartFormData(req);
    const customMusicFileEntry = formData.get("customMusicFile");
    const customMusicFile = customMusicFileEntry instanceof File ? customMusicFileEntry : null;
    const customVideoFileEntry = formData.get("customVideoFile");
    const customVideoFile = customVideoFileEntry instanceof File ? customVideoFileEntry : null;
    const rawSegmentEditor = parseServerJson(getFormDataString(formData, "segmentEditor"));
    const segmentEditorRecord = rawSegmentEditor && typeof rawSegmentEditor === "object" ? rawSegmentEditor : null;
    const rawSegments = Array.isArray(segmentEditorRecord?.segments) ? segmentEditorRecord.segments : [];
    const segmentEditor = segmentEditorRecord && rawSegments.length > 0
        ? {
            projectId: segmentEditorRecord.projectId,
            segments: await Promise.all(rawSegments.map(async (segment) => {
                const segmentRecord = segment && typeof segment === "object" ? segment : {};
                const uploadKey = typeof segmentRecord.customVideoFileUploadKey === "string"
                    ? segmentRecord.customVideoFileUploadKey.trim()
                    : "";
                const uploadedEntry = uploadKey ? formData.get(uploadKey) : null;
                const uploadedFile = uploadedEntry instanceof File ? uploadedEntry : null;
                return {
                    customVideoFileDataUrl: uploadedFile
                        ? await buildMultipartFileDataUrl(uploadedFile)
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
                    startTime: segmentRecord.startTime,
                    text: segmentRecord.text,
                    videoAction: segmentRecord.videoAction,
                };
            })),
        }
        : undefined;
    return {
        customMusicFileDataUrl: customMusicFile ? await buildMultipartFileDataUrl(customMusicFile) : getFormDataString(formData, "customMusicFileDataUrl"),
        customMusicFileName: getFormDataString(formData, "customMusicFileName") || customMusicFile?.name?.trim() || "",
        customVideoFileDataUrl: customVideoFile ? await buildMultipartFileDataUrl(customVideoFile) : getFormDataString(formData, "customVideoFileDataUrl"),
        customVideoFileMimeType: getFormDataString(formData, "customVideoFileMimeType") || customVideoFile?.type?.trim() || "",
        customVideoFileName: getFormDataString(formData, "customVideoFileName") || customVideoFile?.name?.trim() || "",
        isRegeneration: getFormDataBoolean(formData, "isRegeneration", false),
        language: getFormDataString(formData, "language"),
        musicType: getFormDataString(formData, "musicType"),
        projectId: getFormDataNumber(formData, "projectId"),
        prompt: getFormDataString(formData, "prompt"),
        segmentEditor,
        subtitleColorId: getFormDataString(formData, "subtitleColorId"),
        subtitleEnabled: getFormDataBoolean(formData, "subtitleEnabled", true),
        subtitleStyleId: getFormDataString(formData, "subtitleStyleId"),
        videoMode: getFormDataString(formData, "videoMode"),
        voiceEnabled: getFormDataBoolean(formData, "voiceEnabled", true),
        voiceId: getFormDataString(formData, "voiceId"),
    };
};
const isLocalExampleGoal = (value) => value === "stories" ||
    value === "fun" ||
    value === "ads" ||
    value === "fantasy" ||
    value === "interesting" ||
    value === "effects";
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
    const loginData = {
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
    }
    catch (error) {
        console.error("[telegram] Failed to sign in with Telegram", error);
        res.redirect("/?error=telegram_login_failed");
    }
});
app.post("/api/auth/telegram/callback", express.json(), async (req, res) => {
    if (!authProviderStatus.telegramEnabled) {
        res.status(400).json({ error: "Telegram login not configured." });
        return;
    }
    const loginData = req.body;
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
    }
    catch (error) {
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
    if (!session?.user) {
        res.status(401).json({ error: "Unauthorized" });
        return;
    }
    try {
        const data = await getLocalExamplesState(session.user);
        res.json({ data });
    }
    catch (error) {
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
            prompt,
            sourceId: sourceId || null,
            title,
            videoUrl,
        });
        res.status(201).json({ data: { item } });
    }
    catch (error) {
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
    }
    catch (error) {
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
    if (!session?.user) {
        res.status(401).json({ error: "Unauthorized" });
        return;
    }
    try {
        const asset = await getLocalExampleVideoAsset(session.user, req.params.exampleId);
        res.setHeader("Cache-Control", "private, no-store");
        res.type(asset.contentType);
        await new Promise((resolve, reject) => {
            res.sendFile(asset.absolutePath, (error) => {
                if (error) {
                    reject(error);
                    return;
                }
                resolve();
            });
        });
    }
    catch (error) {
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
        res.json({
            data: {
                latestGeneration: workspace.latestGeneration,
                profile: workspace.profile,
                studioOptions: workspace.studioOptions,
            },
        });
    }
    catch (error) {
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
    }
    catch (error) {
        console.error("[workspace] Failed to load workspace projects", error);
        res.status(500).json({
            error: error instanceof Error ? error.message : "Failed to load workspace projects.",
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
    }
    catch (error) {
        if (error instanceof WorkspaceProjectNotFoundError) {
            res.status(404).json({ error: "Project not found." });
            return;
        }
        console.error("[workspace] Failed to load project poster", error);
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
    }
    catch (error) {
        if (error instanceof WorkspaceProjectNotFoundError) {
            res.status(404).json({ error: "Project not found." });
            return;
        }
        console.error("[workspace] Failed to load project playback cache", error);
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
        res.json({ data: { projectId } });
    }
    catch (error) {
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
        });
        res.status(200);
        res.setHeader("Cache-Control", "private, max-age=86400");
        res.setHeader("Content-Length", String(preview.audio.byteLength));
        res.setHeader("Content-Type", preview.contentType || "audio/wav");
        res.send(preview.audio);
    }
    catch (error) {
        console.error("[workspace] Failed to generate voice preview", error);
        res.status(502).json({
            error: error instanceof Error ? error.message : "Failed to generate voice preview.",
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
    }
    catch (error) {
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
        const data = await getWorkspaceSegmentEditorSession(session.user, projectId);
        res.json({ data });
    }
    catch (error) {
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
    }
    catch (error) {
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
        const url = await getCheckoutUrl(productId, session.user);
        res.json({ data: { url } });
    }
    catch (error) {
        const statusCode = error instanceof CheckoutConfigError ? 503 : 500;
        res.status(statusCode).json({
            error: error instanceof Error ? error.message : "Failed to prepare checkout.",
        });
    }
});
app.all(/^\/api\/auth(\/.*)?$/, toNodeHandler(auth));
app.use(express.json({ limit: "90mb" }));
app.post("/api/contact/agency", async (req, res) => {
    try {
        const submission = parseAgencyContactSubmission(req.body);
        await sendAgencyContactSubmission(submission);
        res.status(201).json({ data: { ok: true } });
    }
    catch (error) {
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
    }
    catch (error) {
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
    }
    catch (error) {
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
    }
    catch (error) {
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
    }
    catch (error) {
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
        if (data.status === "done" && data.videoProjectId) {
            await invalidateWorkspaceProjectsCache(session.user);
        }
        res.json({ data });
    }
    catch (error) {
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
            customMusicFileDataUrl: typeof req.body?.customMusicFileDataUrl === "string" ? req.body.customMusicFileDataUrl.trim() : "",
            customMusicFileName: typeof req.body?.customMusicFileName === "string" ? req.body.customMusicFileName.trim() : "",
            customVideoFileDataUrl: typeof req.body?.customVideoFileDataUrl === "string" ? req.body.customVideoFileDataUrl.trim() : "",
            customVideoFileMimeType: typeof req.body?.customVideoFileMimeType === "string" ? req.body.customVideoFileMimeType.trim() : "",
            customVideoFileName: typeof req.body?.customVideoFileName === "string" ? req.body.customVideoFileName.trim() : "",
            isRegeneration: Boolean(req.body?.isRegeneration),
            language: typeof req.body?.language === "string" ? req.body.language.trim() : "",
            musicType: typeof req.body?.musicType === "string" ? req.body.musicType.trim() : "",
            projectId: Number(req.body?.projectId ?? 0),
            prompt: typeof req.body?.prompt === "string" ? req.body.prompt.trim() : "",
            segmentEditor: req.body?.segmentEditor && typeof req.body.segmentEditor === "object" ? req.body.segmentEditor : undefined,
            subtitleColorId: typeof req.body?.subtitleColorId === "string" ? req.body.subtitleColorId.trim() : "",
            subtitleEnabled: req.body?.subtitleEnabled !== false,
            subtitleStyleId: typeof req.body?.subtitleStyleId === "string" ? req.body.subtitleStyleId.trim() : "",
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
    const customMusicFileName = requestBody.customMusicFileName;
    const customMusicFileDataUrl = requestBody.customMusicFileDataUrl;
    const videoMode = requestBody.videoMode;
    const subtitleStyleId = requestBody.subtitleStyleId;
    const subtitleColorId = requestBody.subtitleColorId;
    const subtitleEnabled = requestBody.subtitleEnabled;
    const customVideoFileName = requestBody.customVideoFileName;
    const customVideoFileMimeType = requestBody.customVideoFileMimeType;
    const customVideoFileDataUrl = requestBody.customVideoFileDataUrl;
    const projectId = requestBody.projectId;
    const segmentEditor = requestBody.segmentEditor;
    if (!prompt) {
        res.status(400).json({ error: "Prompt is required." });
        return;
    }
    try {
        const job = await createStudioGenerationJob(prompt, session.user, {
            customMusicFileDataUrl,
            customMusicFileName,
            customVideoFileDataUrl,
            customVideoFileMimeType,
            customVideoFileName,
            isRegeneration,
            language,
            musicType,
            projectId: Number.isFinite(projectId) && projectId > 0 ? projectId : undefined,
            segmentEditor,
            subtitleEnabled,
            subtitleColorId,
            subtitleStyleId,
            videoMode,
            voiceEnabled,
            voiceId,
        });
        res.json({ data: job });
    }
    catch (error) {
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
    const projectId = Number(req.body?.projectId ?? 0);
    const segmentIndex = Number(req.body?.segmentIndex ?? -1);
    if (!prompt) {
        res.status(400).json({ error: "Prompt is required." });
        return;
    }
    try {
        const result = await generateStudioSegmentAiPhoto(prompt, session.user, {
            language,
            projectId: Number.isFinite(projectId) && projectId > 0 ? projectId : undefined,
            segmentIndex: Number.isFinite(segmentIndex) && segmentIndex >= 0 ? segmentIndex : undefined,
        });
        res.json({ data: result });
    }
    catch (error) {
        console.error("[studio] Failed to generate segment AI photo", error);
        const statusCode = error instanceof WorkspaceCreditLimitError ? 402 : 500;
        res.status(statusCode).json({
            error: error instanceof Error ? error.message : "Failed to generate segment AI photo.",
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
    if (!prompt) {
        res.status(400).json({ error: "Prompt is required." });
        return;
    }
    try {
        const result = await improveStudioSegmentAiPhotoPrompt(prompt, { language });
        res.json({ data: result });
    }
    catch (error) {
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
        ? req.body.texts.map((text) => (typeof text === "string" ? text : String(text ?? "")))
        : [];
    try {
        const result = await translateStudioTexts(texts, {
            sourceLanguage,
            targetLanguage,
        });
        res.json({ data: result });
    }
    catch (error) {
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
    const projectId = Number(req.body?.projectId ?? 0);
    const segmentIndex = Number(req.body?.segmentIndex ?? -1);
    if (!prompt) {
        res.status(400).json({ error: "Prompt is required." });
        return;
    }
    try {
        const job = await createStudioSegmentAiPhotoJob(prompt, session.user, {
            language,
            projectId: Number.isFinite(projectId) && projectId > 0 ? projectId : undefined,
            segmentIndex: Number.isFinite(segmentIndex) && segmentIndex >= 0 ? segmentIndex : undefined,
        });
        res.json({ data: job });
    }
    catch (error) {
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
    }
    catch (error) {
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
    const projectId = Number(req.body?.projectId ?? 0);
    const segmentIndex = Number(req.body?.segmentIndex ?? -1);
    if (!prompt) {
        res.status(400).json({ error: "Prompt is required." });
        return;
    }
    try {
        const job = await createStudioSegmentAiVideoJob(prompt, session.user, {
            language,
            projectId: Number.isFinite(projectId) && projectId > 0 ? projectId : undefined,
            segmentIndex: Number.isFinite(segmentIndex) && segmentIndex >= 0 ? segmentIndex : undefined,
        });
        res.json({ data: job });
    }
    catch (error) {
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
    }
    catch (error) {
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
    }
    catch (error) {
        console.error("[studio] Failed to load segment AI video playback cache", error);
        res.status(502).json({
            error: error instanceof Error ? error.message : "Failed to load generated segment AI video playback.",
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
    }
    catch (error) {
        console.error("[studio] Failed to load generated segment AI video poster", error);
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
    const projectId = Number(req.body?.projectId ?? 0);
    const segmentIndex = Number(req.body?.segmentIndex ?? -1);
    if (!prompt) {
        res.status(400).json({ error: "Prompt is required." });
        return;
    }
    try {
        const job = await createStudioSegmentPhotoAnimationJob(prompt, session.user, {
            language,
            projectId: Number.isFinite(projectId) && projectId > 0 ? projectId : undefined,
            segmentIndex: Number.isFinite(segmentIndex) && segmentIndex >= 0 ? segmentIndex : undefined,
        });
        res.json({ data: job });
    }
    catch (error) {
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
    }
    catch (error) {
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
    }
    catch (error) {
        console.error("[studio] Failed to load segment photo animation playback cache", error);
        res.status(502).json({
            error: error instanceof Error ? error.message : "Failed to load generated segment photo animation playback.",
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
    }
    catch (error) {
        console.error("[studio] Failed to load generated segment photo animation poster", error);
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
            await invalidateWorkspaceProjectsCache(session.user);
        }
        res.json({ data: status });
    }
    catch (error) {
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
    }
    catch (error) {
        console.error("[studio] Failed to load playback cache", error);
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
    }
    catch (error) {
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
    }
    catch (error) {
        console.error("[studio] Failed to proxy generated video by path", error);
        res.status(500).json({
            error: error instanceof Error ? error.message : "Failed to proxy generated video.",
        });
    }
});
const startServer = async () => {
    await ensureAuthSchema();
    app.listen(env.authServerPort, () => {
        console.info(`[auth] Better Auth server listening on ${env.authServerPort}`);
        console.info(`[auth] Shared auth database: ${authDatabaseConfig.description}`);
        console.info(`[auth] Providers loaded: smtp=${authProviderStatus.smtpConfigured}, google=${authProviderStatus.googleEnabled}, telegram=${authProviderStatus.telegramEnabled}`);
    });
};
void startServer().catch((error) => {
    console.error("[auth] Failed to initialize auth server", error);
    process.exit(1);
});
