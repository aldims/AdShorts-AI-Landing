import { Readable } from "node:stream";
import express from "express";
import cors from "cors";
import { fromNodeHeaders, toNodeHandler } from "better-auth/node";
import { auth, ensureAuthSchema, signInWithTelegram } from "./auth.js";
import { authDatabaseConfig } from "./database.js";
import { authProviderStatus, env } from "./env.js";
import { getLastDevEmailPreview, getMailStatus } from "./mail.js";
import { getWorkspaceProjects } from "./projects.js";
import { verifyTelegramLogin, getTelegramUserProfile } from "./telegram.js";
import { createStudioGenerationJob, getWorkspaceBootstrap, getStudioGenerationStatus, getStudioVideoProxyTarget, WorkspaceCreditLimitError, } from "./studio.js";
const app = express();
app.set("trust proxy", true);
app.use(cors({
    credentials: true,
    origin: env.appUrl,
}));
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
        res.json({
            data: {
                latestGeneration: workspace.latestGeneration,
                profile: workspace.profile,
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
app.all(/^\/api\/auth(\/.*)?$/, toNodeHandler(auth));
app.use(express.json());
app.post("/api/studio/generate", async (req, res) => {
    const session = await auth.api.getSession({
        headers: fromNodeHeaders(req.headers),
    });
    if (!session?.user) {
        res.status(401).json({ error: "Unauthorized" });
        return;
    }
    const prompt = typeof req.body?.prompt === "string" ? req.body.prompt.trim() : "";
    if (!prompt) {
        res.status(400).json({ error: "Prompt is required." });
        return;
    }
    try {
        const job = await createStudioGenerationJob(prompt, session.user);
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
        res.json({ data: status });
    }
    catch (error) {
        console.error("[studio] Failed to fetch generation status", error);
        res.status(500).json({
            error: error instanceof Error ? error.message : "Failed to fetch generation status.",
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
        const upstreamResponse = await fetch(upstreamUrl);
        if (!upstreamResponse.ok || !upstreamResponse.body) {
            const detail = await upstreamResponse.text().catch(() => "");
            res.status(upstreamResponse.status || 502).json({
                error: detail || "Failed to load generated video.",
            });
            return;
        }
        const contentType = upstreamResponse.headers.get("content-type") ?? "video/mp4";
        const contentLength = upstreamResponse.headers.get("content-length");
        const cacheControl = upstreamResponse.headers.get("cache-control");
        res.status(200);
        res.setHeader("Content-Type", contentType);
        if (contentLength)
            res.setHeader("Content-Length", contentLength);
        if (cacheControl)
            res.setHeader("Cache-Control", cacheControl);
        Readable.fromWeb(upstreamResponse.body).pipe(res);
    }
    catch (error) {
        console.error("[studio] Failed to proxy generated video", error);
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
