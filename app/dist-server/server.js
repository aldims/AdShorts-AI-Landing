import { Readable } from "node:stream";
import express from "express";
import cors from "cors";
import { fromNodeHeaders, toNodeHandler } from "better-auth/node";
import { auth, ensureAuthSchema } from "./auth.js";
import { authDatabaseConfig } from "./database.js";
import { authProviderStatus, env } from "./env.js";
import { getLastDevEmailPreview, getMailStatus } from "./mail.js";
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
