import { spawn } from "node:child_process";
import { createReadStream } from "node:fs";
import { createServer } from "node:http";
import { mkdir, rm, stat } from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, firefox, webkit } from "playwright";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(scriptDir, "..");
const repoRoot = path.resolve(appRoot, "..");
const quickMode = process.env.RESPONSIVE_AUDIT_QUICK === "1";
const scenesOnly = process.env.RESPONSIVE_AUDIT_SCENES_ONLY === "1";
const requestedScope = process.env.RESPONSIVE_AUDIT_SCOPE ?? "all";
const auditScope = scenesOnly ? "app" : requestedScope;
const supportedScopes = new Set(["all", "app", "static"]);

if (!supportedScopes.has(auditScope)) {
  throw new Error(`Unsupported RESPONSIVE_AUDIT_SCOPE: ${auditScope}. Use all, app, or static.`);
}

const auditsApp = auditScope === "all" || auditScope === "app";
const auditsStatic = auditScope === "all" || auditScope === "static";
const artifactDir = path.join(repoRoot, ".codex-tmp", "responsive-audit", auditScope);
const browserTypes = { chromium, firefox, webkit };
const requestedBrowserNames = (process.env.RESPONSIVE_AUDIT_BROWSERS ?? "chromium")
  .split(",")
  .map((name) => name.trim())
  .filter(Boolean);
const unsupportedBrowsers = requestedBrowserNames.filter((name) => !(name in browserTypes));

if (requestedBrowserNames.length === 0 || unsupportedBrowsers.length > 0) {
  throw new Error(
    `Unsupported RESPONSIVE_AUDIT_BROWSERS value. Use a comma-separated subset of chromium, firefox, webkit.`,
  );
}

const requestedConcurrency = Number.parseInt(process.env.RESPONSIVE_AUDIT_CONCURRENCY ?? "", 10);
const auditConcurrency = Number.isFinite(requestedConcurrency) && requestedConcurrency > 0
  ? requestedConcurrency
  : quickMode
    ? 4
    : 3;
const requestedAuditTimeoutMs = Number.parseInt(process.env.RESPONSIVE_AUDIT_TIMEOUT_MS ?? "", 10);
const auditTimeoutMs = Number.isFinite(requestedAuditTimeoutMs) && requestedAuditTimeoutMs > 0
  ? requestedAuditTimeoutMs
  : quickMode
    ? 8 * 60_000
    : 20 * 60_000;
const requestedProgressEvery = Number.parseInt(process.env.RESPONSIVE_AUDIT_PROGRESS_EVERY ?? "", 10);
const progressEvery = Number.isFinite(requestedProgressEvery) && requestedProgressEvery > 0
  ? requestedProgressEvery
  : 50;

const popularViewports = [
  [320, 568],
  [360, 800],
  [375, 812],
  [390, 844],
  [412, 915],
  [430, 932],
  [768, 1024],
  [820, 1180],
  [1024, 768],
  [1280, 720],
  [1366, 768],
  [1440, 900],
  [1536, 864],
  [1920, 1080],
  [2560, 1440],
];
const zooms = [1, 1.25, 1.5, 1.75, 2];
const fontScales = [1, 1.25, 1.5];

const appRoutes = scenesOnly
  ? ["/app/studio?mode=scenes", "/en/app/studio?mode=scenes"]
  : quickMode
    ? [
        "/",
        "/en",
        "/pricing",
        "/en/pricing",
        "/examples",
        "/en/examples",
        "/app",
        "/en/app",
        "/app/studio",
        "/en/app/studio",
        "/app/studio?audit=legacy-project",
        "/en/app/studio?audit=legacy-project",
        "/app/studio?mode=scenes",
        "/en/app/studio?mode=scenes",
        "/app/projects",
        "/en/app/projects",
      ]
    : [
        "/",
        "/pricing",
        "/examples",
        "/en",
        "/en/pricing",
        "/en/examples",
        "/app",
        "/en/app",
        "/app/studio",
        "/en/app/studio",
        "/app/studio?audit=legacy-project",
        "/en/app/studio?audit=legacy-project",
        "/app/studio?mode=scenes",
        "/en/app/studio?mode=scenes",
        "/app/projects",
        "/en/app/projects",
      ];

const staticRoutes = scenesOnly
  ? []
  : quickMode
    ? ["/", "/pricing/", "/examples/", "/shorts-guides/", "/kak-sdelat-shorts-na-youtube/"]
    : [
      "/",
      "/pricing/",
      "/examples/",
      "/shorts-guides/",
      "/kak-sdelat-shorts-na-youtube/",
      "/kak-sdelat-huk-v-shorts/",
      "/en/how-to-make-shorts-on-youtube/",
      ];

const nowIso = new Date().toISOString();
const workspaceProfile = {
  balance: 42,
  expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString(),
  plan: "PRO",
  startPlanUsed: true,
};

const studioOptions = {
  subtitleStyles: [
    {
      defaultColorId: "purple",
      description: "Responsive audit subtitle style.",
      fontFamily: "Manrope",
      fontSize: 96,
      id: "modern",
      label: "Modern",
      logicMode: "block",
      marginBottom: 420,
      outlineWidth: 3,
      position: "bottom_center",
      transitionMode: "hard_cut",
      usesAccentColor: true,
      windowSize: 3,
      wordEffect: "none",
    },
  ],
  subtitleColors: [{ hex: "8B5CF6", id: "purple", label: "Purple" }],
};

const exampleItems = [
  {
    id: "audit-example-1",
    title: "Audit real estate hook",
    goal: "Lead generation",
    status: "ready",
    locale: "en",
    summary: "Fast vertical sample used for responsive checks.",
    insert: "Opening hook, benefit, CTA.",
    tags: ["real estate", "shorts"],
    videoSrc: "",
    posterSrc: "",
  },
  {
    id: "audit-example-2",
    title: "Audit product demo",
    goal: "Product reveal",
    status: "ready",
    locale: "ru",
    summary: "Compact sample card for wrapping checks.",
    insert: "Pain point, product shot, offer.",
    tags: ["demo", "ugc"],
    videoSrc: "",
    posterSrc: "",
  },
];

const workspaceProject = {
  adId: 101,
  createdAt: nowIso,
  description: "Responsive audit fixture project.",
  editedFromProjectAdId: null,
  finalAsset: null,
  generatedAt: nowIso,
  hashtags: ["#shorts", "#audit"],
  id: "audit-project",
  jobId: null,
  prompt: "Create a short product video.",
  source: "project",
  status: "ready",
  title: "Responsive audit project",
  updatedAt: nowIso,
  versionRootProjectAdId: null,
  posterUrl: null,
  prefillSettings: null,
  videoFallbackUrl: null,
  videoUrl: null,
  youtubePublication: null,
};

const legacyProjectGeneration = {
  error: undefined,
  generation: {
    adId: workspaceProject.adId,
    aspectRatio: "9:16",
    description: "Legacy project used to verify the compact laptop layout.",
    durationLabel: "00:12",
    generatedAt: nowIso,
    hashtags: ["#shorts", "#audit"],
    id: "audit-legacy-generation",
    isReadyForEditor: false,
    modelLabel: "Audit",
    prefillSettings: null,
    projectStatus: "ready",
    prompt: "Legacy project responsive fixture.",
    readyReason: "project_not_ready",
    title: "Legacy responsive audit project",
    videoFallbackUrl: null,
    videoUrl: "/studio/generation-background.mp4",
  },
  isReadyForEditor: false,
  jobId: "audit-legacy-job",
  projectStatus: "ready",
  readyReason: "project_not_ready",
  status: "done",
};

const mimeTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".ico", "image/x-icon"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".webp", "image/webp"],
]);

const getFreePort = () =>
  new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close(() => resolve(address.port));
    });
  });

const waitForUrl = async (url, label) => {
  const deadline = Date.now() + 30_000;
  let lastError = null;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
      lastError = new Error(`${label} returned ${response.status}`);
    } catch (error) {
      lastError = error;
    }

    await new Promise((resolve) => setTimeout(resolve, 350));
  }

  throw new Error(`Timed out waiting for ${label} at ${url}: ${lastError?.message ?? "no response"}`);
};

const startProcess = (command, args, cwd, label) => {
  const child = spawn(command, args, {
    cwd,
    detached: process.platform !== "win32",
    env: { ...process.env, BROWSER: "none", FORCE_COLOR: "0" },
    stdio: ["ignore", "pipe", "pipe"],
  });

  const log = (chunk) => {
    const text = String(chunk).trim();
    if (text) console.log(`[${label}] ${text}`);
  };

  child.stdout.on("data", log);
  child.stderr.on("data", log);

  child.once("exit", (code, signal) => {
    if (code !== 0 && signal !== "SIGTERM") {
      console.warn(`[${label}] exited with code ${code ?? "null"} signal ${signal ?? "null"}`);
    }
  });

  return child;
};

const stopProcess = async (child) => {
  if (!child || child.killed) return;

  const signalProcess = (signal) => {
    try {
      if (process.platform === "win32") {
        child.kill(signal);
      } else {
        process.kill(-child.pid, signal);
      }
    } catch (error) {
      if (error?.code !== "ESRCH") throw error;
    }
  };

  signalProcess("SIGTERM");
  await new Promise((resolve) => {
    const timeout = setTimeout(resolve, 2_000);
    child.once("exit", () => {
      clearTimeout(timeout);
      resolve();
    });
  });

  if (child.exitCode === null && child.signalCode === null) {
    signalProcess("SIGKILL");
  }
};

const startStaticServer = (port) =>
  new Promise((resolve, reject) => {
    const server = createServer(async (request, response) => {
      try {
        const requestUrl = new URL(request.url ?? "/", `http://${request.headers.host ?? "127.0.0.1"}`);
        let pathname = decodeURIComponent(requestUrl.pathname);
        if (pathname.endsWith("/")) pathname += "index.html";

        let filePath = path.resolve(repoRoot, `.${pathname}`);
        if (!filePath.startsWith(repoRoot + path.sep) && filePath !== repoRoot) {
          response.writeHead(403);
          response.end("Forbidden");
          return;
        }

        let fileStat = await stat(filePath).catch(() => null);
        if (fileStat?.isDirectory()) {
          filePath = path.join(filePath, "index.html");
          fileStat = await stat(filePath).catch(() => null);
        }

        if (!fileStat?.isFile()) {
          response.writeHead(404);
          response.end("Not found");
          return;
        }

        response.writeHead(200, {
          "content-type": mimeTypes.get(path.extname(filePath).toLowerCase()) ?? "application/octet-stream",
          "content-length": String(fileStat.size),
        });
        createReadStream(filePath).pipe(response);
      } catch (error) {
        response.writeHead(500);
        response.end(error instanceof Error ? error.message : String(error));
      }
    });

    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => {
      console.log(`[static] serving ${repoRoot} at http://127.0.0.1:${port}/`);
      resolve(server);
    });
  });

const stopStaticServer = async (server) => {
  if (!server) return;
  await new Promise((resolve) => server.close(resolve));
};

const fulfillJson = (route, body, status = 200) =>
  route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  });

const installAppMocks = async (page, { hasLegacyProject = false } = {}) => {
  await page.route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const resourceType = request.resourceType();

    if (resourceType === "media" && url.pathname !== "/studio/generation-background.mp4") {
      await route.fulfill({ status: 204, body: "" });
      return;
    }

    if (!url.pathname.startsWith("/api/")) {
      await route.continue();
      return;
    }

    if (url.pathname.startsWith("/api/auth/")) {
      await fulfillJson(route, {
        session: {
          id: "audit-session",
          token: "audit-session-token",
          userId: "audit-user",
          expiresAt: new Date(Date.now() + 1000 * 60 * 60).toISOString(),
          createdAt: nowIso,
          updatedAt: nowIso,
        },
        user: {
          id: "audit-user",
          email: "audit@adshortsai.test",
          emailVerified: true,
          name: "Audit User",
          image: null,
        },
      });
      return;
    }

    if (url.pathname === "/api/workspace/bootstrap") {
      await fulfillJson(route, {
        data: {
          latestGeneration: hasLegacyProject ? legacyProjectGeneration : null,
          profile: workspaceProfile,
          studioOptions,
        },
      });
      return;
    }

    if (url.pathname === "/api/workspace/projects") {
      await fulfillJson(route, { data: { projects: [workspaceProject] } });
      return;
    }

    if (url.pathname === "/api/workspace/content-plans") {
      await fulfillJson(route, { data: { plans: [] } });
      return;
    }

    if (url.pathname.startsWith("/api/workspace/media-library")) {
      await fulfillJson(route, { data: { items: [], nextCursor: null, total: 0 } });
      return;
    }

    if (url.pathname === "/api/workspace/publish/bootstrap") {
      await fulfillJson(route, { data: { channels: [], jobs: [] } });
      return;
    }

    if (url.pathname === "/api/examples/local") {
      await fulfillJson(route, { data: { examples: exampleItems } });
      return;
    }

    if (url.pathname.startsWith("/api/examples/local/")) {
      await fulfillJson(route, { data: { example: exampleItems[0] } });
      return;
    }

    if (url.pathname.startsWith("/api/client-events")) {
      await route.fulfill({ status: 204, body: "" });
      return;
    }

    await fulfillJson(route, { data: {} });
  });
};

const buildScenarios = () => {
  if (quickMode) {
    return [
      { width: 320, height: 568, zoom: 1, fontScale: 1, type: "viewport" },
      { width: 390, height: 844, zoom: 1, fontScale: 1, type: "viewport" },
      { width: 768, height: 1024, zoom: 1, fontScale: 1, type: "viewport" },
      { width: 820, height: 1180, zoom: 1, fontScale: 1, type: "viewport" },
      { width: 1024, height: 768, zoom: 1, fontScale: 1, type: "viewport" },
      { width: 1280, height: 720, zoom: 1, fontScale: 1, type: "viewport" },
      { width: 1440, height: 900, zoom: 1, fontScale: 1, type: "viewport" },
      { width: 1920, height: 1080, zoom: 1, fontScale: 1, type: "viewport" },
      { width: 844, height: 390, zoom: 1, fontScale: 1, type: "landscape" },
      { width: 1280, height: 720, zoom: 1.5, fontScale: 1, type: "zoom" },
      { width: 1280, height: 720, zoom: 1.75, fontScale: 1, type: "zoom" },
      { width: 1280, height: 720, zoom: 2, fontScale: 1, type: "zoom" },
      { width: 1440, height: 900, zoom: 1.25, fontScale: 1, type: "zoom" },
      { width: 1920, height: 1080, zoom: 1.75, fontScale: 1, type: "zoom" },
      { width: 390, height: 844, zoom: 1, fontScale: 1.5, type: "font" },
      { width: 1024, height: 768, zoom: 1, fontScale: 1.5, type: "font" },
      { width: 1229, height: 692, zoom: 1, fontScale: 1, type: "laptop-125" },
      { width: 1208, height: 615, zoom: 1, fontScale: 1, type: "idea-controls" },
      { width: 2560, height: 1440, zoom: 1, fontScale: 1, type: "idea-standard" },
      { width: 1121, height: 419, zoom: 1, fontScale: 1, type: "idea-compact" },
      { width: 1002, height: 424, zoom: 1, fontScale: 1, type: "idea-compact" },
      { width: 983, height: 388, zoom: 1, fontScale: 1, type: "idea-compact" },
      { width: 1180, height: 499, zoom: 1, fontScale: 1, type: "scene-breakpoint-lower" },
      { width: 1144, height: 406, zoom: 1, fontScale: 1, type: "scene-short-desktop" },
      { width: 1121, height: 419, zoom: 1, fontScale: 1, type: "scene-short-desktop" },
      { width: 1166, height: 464, zoom: 1, fontScale: 1, type: "scene-short-desktop" },
      { width: 1181, height: 499, zoom: 1, fontScale: 1, type: "scene-breakpoint-upper" },
      { width: 1688, height: 400, zoom: 1, fontScale: 1, type: "scene-height-continuum" },
      { width: 1688, height: 458, zoom: 1, fontScale: 1, type: "scene-height-continuum" },
      { width: 1688, height: 516, zoom: 1, fontScale: 1, type: "scene-height-continuum" },
      { width: 1688, height: 559, zoom: 1, fontScale: 1, type: "scene-height-continuum" },
      { width: 1688, height: 560, zoom: 1, fontScale: 1, type: "scene-height-continuum" },
      { width: 1688, height: 575, zoom: 1, fontScale: 1, type: "scene-height-continuum" },
      { width: 1688, height: 620, zoom: 1, fontScale: 1, type: "scene-height-continuum" },
      { width: 1688, height: 621, zoom: 1, fontScale: 1, type: "scene-height-continuum" },
      { width: 1688, height: 760, zoom: 1, fontScale: 1, type: "scene-height-continuum" },
      { width: 1688, height: 860, zoom: 1, fontScale: 1, type: "scene-height-continuum" },
      { width: 1688, height: 861, zoom: 1, fontScale: 1, type: "scene-height-continuum" },
      { width: 1920, height: 980, zoom: 1.25, fontScale: 1, type: "scene-fit" },
      { width: 1208, height: 681, zoom: 1, fontScale: 1, type: "scene-user-laptop" },
      { width: 961, height: 698, zoom: 1, fontScale: 1, type: "scene-user-laptop" },
      { width: 850, height: 434, zoom: 1, fontScale: 1, type: "scene-embedded" },
      { width: 1352, height: 690, zoom: 1, fontScale: 1, type: "scene-compact-desktop" },
    ];
  }

  const scenarios = [];

  for (const [width, height] of popularViewports) {
    for (const zoom of zooms) {
      scenarios.push({ width, height, zoom, fontScale: 1, type: "zoom" });
    }

    for (const fontScale of fontScales.filter((value) => value !== 1)) {
      scenarios.push({ width, height, zoom: 1, fontScale, type: "font" });
    }
  }

  scenarios.push(
    { width: 844, height: 390, zoom: 1, fontScale: 1, type: "landscape" },
    { width: 932, height: 430, zoom: 1, fontScale: 1, type: "landscape" },
    { width: 1229, height: 692, zoom: 1, fontScale: 1, type: "laptop-125" },
    { width: 1208, height: 615, zoom: 1, fontScale: 1, type: "idea-controls" },
    { width: 2560, height: 1440, zoom: 1, fontScale: 1, type: "idea-standard" },
    { width: 1121, height: 419, zoom: 1, fontScale: 1, type: "idea-compact" },
    { width: 1002, height: 424, zoom: 1, fontScale: 1, type: "idea-compact" },
    { width: 983, height: 388, zoom: 1, fontScale: 1, type: "idea-compact" },
    { width: 1180, height: 499, zoom: 1, fontScale: 1, type: "scene-breakpoint-lower" },
    { width: 1144, height: 406, zoom: 1, fontScale: 1, type: "scene-short-desktop" },
    { width: 1121, height: 419, zoom: 1, fontScale: 1, type: "scene-short-desktop" },
    { width: 1166, height: 464, zoom: 1, fontScale: 1, type: "scene-short-desktop" },
    { width: 1181, height: 499, zoom: 1, fontScale: 1, type: "scene-breakpoint-upper" },
    { width: 1688, height: 400, zoom: 1, fontScale: 1, type: "scene-height-continuum" },
    { width: 1688, height: 458, zoom: 1, fontScale: 1, type: "scene-height-continuum" },
    { width: 1688, height: 516, zoom: 1, fontScale: 1, type: "scene-height-continuum" },
    { width: 1688, height: 559, zoom: 1, fontScale: 1, type: "scene-height-continuum" },
    { width: 1688, height: 560, zoom: 1, fontScale: 1, type: "scene-height-continuum" },
    { width: 1688, height: 575, zoom: 1, fontScale: 1, type: "scene-height-continuum" },
    { width: 1688, height: 620, zoom: 1, fontScale: 1, type: "scene-height-continuum" },
    { width: 1688, height: 621, zoom: 1, fontScale: 1, type: "scene-height-continuum" },
    { width: 1688, height: 760, zoom: 1, fontScale: 1, type: "scene-height-continuum" },
    { width: 1688, height: 860, zoom: 1, fontScale: 1, type: "scene-height-continuum" },
    { width: 1688, height: 861, zoom: 1, fontScale: 1, type: "scene-height-continuum" },
    { width: 1920, height: 980, zoom: 1.25, fontScale: 1, type: "scene-fit" },
    { width: 1208, height: 681, zoom: 1, fontScale: 1, type: "scene-user-laptop" },
    { width: 961, height: 698, zoom: 1, fontScale: 1, type: "scene-user-laptop" },
    { width: 850, height: 434, zoom: 1, fontScale: 1, type: "scene-embedded" },
    { width: 1352, height: 690, zoom: 1, fontScale: 1, type: "scene-compact-desktop" },
    { width: 1342, height: 755, zoom: 1, fontScale: 1, type: "scene-compact-desktop" },
  );

  return scenarios;
};

const safeName = (value) =>
  value
    .replace(/^https?:\/\//, "")
    .replace(/[^a-z0-9._-]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 140);

const evaluateLayout = async (page) =>
  page.evaluate(() => {
    const doc = document.documentElement;
    const body = document.body;
    const viewportWidth = doc.clientWidth;
    const viewportHeight = doc.clientHeight;
    const scrollWidth = Math.max(doc.scrollWidth, body?.scrollWidth ?? 0);
    const scrollHeight = Math.max(doc.scrollHeight, body?.scrollHeight ?? 0);
    const visibleElements = [];

    const isVisible = (element, rect) => {
      const style = window.getComputedStyle(element);
      return (
        rect.width > 0 &&
        rect.height > 0 &&
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        Number(style.opacity || "1") > 0.01
      );
    };

    const isInsideReachableHorizontalScroller = (element) => {
      let ancestor = element.parentElement;

      while (ancestor && ancestor !== body) {
        const style = window.getComputedStyle(ancestor);
        const overflowX = style.overflowX;
        const isScrollable =
          (overflowX === "auto" || overflowX === "scroll") &&
          ancestor.scrollWidth > ancestor.clientWidth + 1;

        if (isScrollable) {
          const ancestorRect = ancestor.getBoundingClientRect();
          return (
            ancestorRect.width > 0 &&
            ancestorRect.right > 0 &&
            ancestorRect.left < viewportWidth
          );
        }

        ancestor = ancestor.parentElement;
      }

      return false;
    };

    for (const element of document.body.querySelectorAll("*")) {
      const rect = element.getBoundingClientRect();
      if (!isVisible(element, rect)) continue;
      visibleElements.push({ element, rect });
    }

    const offenders = visibleElements
      .filter(
        ({ element, rect }) =>
          (rect.right > viewportWidth + 1 || rect.left < -1) &&
          !isInsideReachableHorizontalScroller(element),
      )
      .map(({ element, rect }) => ({
        selector:
          element.id ||
          element.className?.toString?.().trim?.().replace(/\s+/g, ".") ||
          element.getAttribute("aria-label") ||
          element.tagName.toLowerCase(),
        tag: element.tagName.toLowerCase(),
        left: Math.round(rect.left),
        right: Math.round(rect.right),
        width: Math.round(rect.width),
      }))
      .slice(0, 8);

    const badControls = Array.from(
      document.querySelectorAll(
        "header a[href], header button, main a.btn, main button, input, select, textarea, [role='button']",
      ),
    )
      .map((element) => ({ element, rect: element.getBoundingClientRect(), style: window.getComputedStyle(element) }))
      .filter(({ element, rect, style }) => {
        if (!isVisible(element, rect)) return false;
        if (element.closest("[hidden], [aria-hidden='true']")) return false;
        const intersectsViewportVertically = rect.bottom > 0 && rect.top < viewportHeight;
        if (!intersectsViewportVertically) return false;
        const isOutsideViewportHorizontally = rect.left < -1 || rect.right > viewportWidth + 1;
        return (
          rect.width < 1 ||
          rect.height < 1 ||
          (isOutsideViewportHorizontally && !isInsideReachableHorizontalScroller(element))
        );
      })
      .slice(0, 8)
      .map(({ element, rect }) => ({
        selector:
          element.id ||
          element.className?.toString?.().trim?.().replace(/\s+/g, ".") ||
          element.getAttribute("aria-label") ||
          element.tagName.toLowerCase(),
        tag: element.tagName.toLowerCase(),
        left: Math.round(rect.left),
        right: Math.round(rect.right),
        top: Math.round(rect.top),
        bottom: Math.round(rect.bottom),
      }));

    const isStudioRoute = Boolean(document.querySelector(".studio-canvas-route"));
    const clippedText = isStudioRoute
      ? []
      : visibleElements
          .filter(({ element, rect }) => {
            if (!element.matches("main h1, main h2, main h3, main p, main button, header button, header a[href]")) {
              return false;
            }
            if (!element.textContent?.trim() || element.closest("[aria-hidden='true']")) return false;
            const style = window.getComputedStyle(element);
            if (style.textOverflow === "ellipsis" || style.webkitLineClamp !== "none") return false;
            const clipsX = style.overflowX === "hidden" || style.overflowX === "clip";
            const clipsY = style.overflowY === "hidden" || style.overflowY === "clip";
            return (
              (clipsX && element.scrollWidth > element.clientWidth + 1) ||
              (clipsY && element.scrollHeight > element.clientHeight + 1) ||
              rect.width < 1 ||
              rect.height < 1
            );
          })
          .slice(0, 8)
          .map(({ element }) => ({
            selector:
              element.id ||
              element.className?.toString?.().trim?.().replace(/\s+/g, ".") ||
              element.tagName.toLowerCase(),
            clientWidth: element.clientWidth,
            scrollWidth: element.scrollWidth,
            clientHeight: element.clientHeight,
            scrollHeight: element.scrollHeight,
          }));

    const smallTouchControls = isStudioRoute || viewportWidth > 640
      ? []
      : Array.from(
          document.querySelectorAll(
            "header a[href], header button, main a.btn, main button:not([tabindex='-1']), main input, main select, main textarea",
          ),
        )
          .map((element) => ({ element, rect: element.getBoundingClientRect() }))
          .filter(({ element, rect }) => {
            if (!isVisible(element, rect) || element.closest("[aria-hidden='true']")) return false;
            if (rect.bottom <= 0 || rect.top >= viewportHeight) return false;
            return rect.width < 44 || rect.height < 44;
          })
          .slice(0, 8)
          .map(({ element, rect }) => ({
            selector:
              element.id ||
              element.className?.toString?.().trim?.().replace(/\s+/g, ".") ||
              element.tagName.toLowerCase(),
            width: Math.round(rect.width),
            height: Math.round(rect.height),
          }));

    const headerControls = Array.from(document.querySelectorAll("header a[href], header button"))
      .map((element) => ({ element, rect: element.getBoundingClientRect(), style: window.getComputedStyle(element) }))
      .filter(({ element, rect, style }) => isVisible(element, rect) && !element.closest("[hidden], [aria-hidden='true']"));
    const overlaps = [];

    for (let i = 0; i < headerControls.length; i += 1) {
      for (let j = i + 1; j < headerControls.length; j += 1) {
        const a = headerControls[i];
        const b = headerControls[j];
        if (a.element.contains(b.element) || b.element.contains(a.element)) continue;
        const x = Math.max(0, Math.min(a.rect.right, b.rect.right) - Math.max(a.rect.left, b.rect.left));
        const y = Math.max(0, Math.min(a.rect.bottom, b.rect.bottom) - Math.max(a.rect.top, b.rect.top));
        if (x > 3 && y > 3) {
          overlaps.push({
            a: a.element.className?.toString?.().trim?.().replace(/\s+/g, ".") || a.element.tagName.toLowerCase(),
            b: b.element.className?.toString?.().trim?.().replace(/\s+/g, ".") || b.element.tagName.toLowerCase(),
            x: Math.round(x),
            y: Math.round(y),
          });
        }
      }
    }

    const activeSceneCard = document.querySelector(".studio-segment-editor__card.is-active");
    const activeSceneCardRect = activeSceneCard?.getBoundingClientRect();
    const sceneCardCopyRect = activeSceneCard
      ?.querySelector(".studio-segment-editor__card-copy")
      ?.getBoundingClientRect();
    const sceneCardFooter = activeSceneCard?.querySelector(
      ".studio-segment-editor__card-overlay-footer",
    );
    const sceneCardFooterRect = sceneCardFooter?.getBoundingClientRect();
    const sceneCardFooterStyle = sceneCardFooter
      ? window.getComputedStyle(sceneCardFooter)
      : null;
    const sceneSourceBadge = activeSceneCard?.querySelector(
      ".studio-segment-editor__card-badge",
    );
    const sceneSourceBadgeRect = sceneSourceBadge?.getBoundingClientRect();
    const sceneSourceBadgeStyle = sceneSourceBadge
      ? window.getComputedStyle(sceneSourceBadge)
      : null;
    const sceneBrandAddRect = activeSceneCard
      ?.querySelector(".studio-segment-editor__brand-add")
      ?.getBoundingClientRect();
    const sceneTimeline = document.querySelector(".studio-segment-editor__timeline");
    const sceneTimelineRect = sceneTimeline?.getBoundingClientRect();
    const sceneTimelineScroll = document.querySelector(".studio-segment-editor__timeline-scroll");
    const sceneTimelineContentMaxBottom = sceneTimelineScroll
      ? Math.max(
          sceneTimelineScroll.getBoundingClientRect().bottom,
          ...Array.from(
            sceneTimelineScroll.querySelectorAll("*"),
            (element) => element.getBoundingClientRect().bottom,
          ),
        )
      : null;
    const sceneSubmitRect = document
      .querySelector(".studio-segment-editor__timeline-submit-row")
      ?.getBoundingClientRect();
    const sceneVisualTrack = document.querySelector(
      ".studio-segment-editor__timeline-track--visual",
    );
    const sceneVisualTrackRect = sceneVisualTrack?.getBoundingClientRect();
    const sceneActiveVisualCell = document.querySelector(
      ".studio-segment-editor__timeline-row--visual .studio-segment-editor__timeline-cell--visual[aria-pressed='true']",
    );
    const sceneActiveVisualCellRect = sceneActiveVisualCell?.getBoundingClientRect();
    const sceneActiveVisualCellStyle = sceneActiveVisualCell
      ? window.getComputedStyle(sceneActiveVisualCell)
      : null;
    const existingSceneSelectionFrame = document.querySelector(
      ".studio-segment-editor__timeline-scene-selection-frame",
    );
    const sceneSelectionFrameProbe = !existingSceneSelectionFrame && sceneVisualTrack
      ? document.createElement("span")
      : null;
    if (sceneSelectionFrameProbe) {
      sceneSelectionFrameProbe.className = "studio-segment-editor__timeline-scene-selection-frame";
      sceneSelectionFrameProbe.setAttribute("aria-hidden", "true");
      sceneVisualTrack.append(sceneSelectionFrameProbe);
    }
    const sceneSelectionFrame = existingSceneSelectionFrame ?? sceneSelectionFrameProbe;
    const sceneSelectionFrameRect = sceneSelectionFrame?.getBoundingClientRect();
    const sceneMain = document.querySelector(".studio-canvas-main.is-segment-editor");
    const sceneLayout = document.querySelector(".studio-segment-editor__layout");
    const sceneLayoutRect = sceneLayout?.getBoundingClientRect();
    const sceneLayoutStyle = sceneLayout ? window.getComputedStyle(sceneLayout) : null;
    const scenePreviewColumnRect = document
      .querySelector(".studio-segment-editor__preview-column")
      ?.getBoundingClientRect();
    const studioIdeaEmptyStateRect = document
      .querySelector(".studio-idea-empty-state")
      ?.getBoundingClientRect();
    const studioComposerRect = document
      .querySelector(".studio-canvas-route:not(.is-segment-editor) .studio-canvas-prompt")
      ?.getBoundingClientRect();
    const studioComposerInnerRect = document
      .querySelector(".studio-canvas-route:not(.is-segment-editor) .studio-canvas-prompt__inner")
      ?.getBoundingClientRect();
    const studioPreviewRect = document
      .querySelector(".studio-canvas-preview.has-video-preview:not(.is-segment-editor)")
      ?.getBoundingClientRect();
    const studioPreviewCloseRect = document
      .querySelector('.studio-canvas-preview.has-video-preview [aria-label="Закрыть видео"], .studio-canvas-preview.has-video-preview [aria-label="Close video"]')
      ?.getBoundingClientRect();
    const studioPreviewActionElements = Array.from(
      document.querySelectorAll(
        ".studio-canvas-preview.has-video-preview .studio-canvas-preview__floating-actions button, " +
          ".studio-canvas-preview.has-video-preview .studio-canvas-preview__floating-actions a",
      ),
    );
    const studioPreviewActionRects = studioPreviewActionElements.map((element) =>
      element.getBoundingClientRect(),
    );
    const studioPreviewActionIconRects = studioPreviewActionElements
      .map((element) => element.querySelector("svg")?.getBoundingClientRect())
      .filter(Boolean);
    const studioPreviewControlRects = Array.from(
      document.querySelectorAll(
        ".studio-canvas-preview.has-video-preview .studio-video-modal__control-btn",
      ),
    ).map((element) => element.getBoundingClientRect());
    const studioPreviewControlsRect = document
      .querySelector(".studio-canvas-preview.has-video-preview .studio-video-modal__player-controls")
      ?.getBoundingClientRect();
    const studioPreviewPlayer = document.querySelector(
      ".studio-canvas-preview.has-video-preview .studio-video-modal__player",
    );
    const studioPreviewPlayerStyle = studioPreviewPlayer
      ? window.getComputedStyle(studioPreviewPlayer)
      : null;
    const studioWelcomeRect = document
      .querySelector(".studio-welcome-card.studio-canvas-welcome")
      ?.getBoundingClientRect();
    const headerRect = document.querySelector("header")?.getBoundingClientRect();
    const firstHeadingRect = document.querySelector("main h1")?.getBoundingClientRect();
    const sceneSelectionFrameMetrics = sceneSelectionFrameRect && sceneSelectionFrame
      ? {
          top: Math.round(sceneSelectionFrameRect.top),
          bottom: Math.round(sceneSelectionFrameRect.bottom),
          clientHeight: Math.round(sceneSelectionFrame.clientHeight),
          scrollHeight: Math.round(sceneSelectionFrame.scrollHeight),
          outlineBoxSizing: window.getComputedStyle(sceneSelectionFrame, "::before").boxSizing,
        }
      : null;
    sceneSelectionFrameProbe?.remove();
    return {
      isStudioRoute,
      clientWidth: viewportWidth,
      clientHeight: viewportHeight,
      scrollWidth,
      scrollHeight,
      offenders,
      badControls,
      clippedText,
      smallTouchControls,
      overlaps: overlaps.slice(0, 6),
      scenePreview: activeSceneCardRect
        ? {
            left: Math.round(activeSceneCardRect.left),
            right: Math.round(activeSceneCardRect.right),
            width: Math.round(activeSceneCardRect.width),
            height: Math.round(activeSceneCardRect.height),
            top: Math.round(activeSceneCardRect.top),
            bottom: Math.round(activeSceneCardRect.bottom),
          }
        : null,
      sceneCardCopy: sceneCardCopyRect
        ? {
            left: Math.round(sceneCardCopyRect.left),
            right: Math.round(sceneCardCopyRect.right),
            top: Math.round(sceneCardCopyRect.top),
            bottom: Math.round(sceneCardCopyRect.bottom),
          }
        : null,
      sceneCardFooterVisible: Boolean(
        sceneCardFooterRect &&
          sceneCardFooterStyle?.display !== "none" &&
          sceneCardFooterRect.width > 1 &&
          sceneCardFooterRect.height > 1,
      ),
      sceneSourceBadgeVisible: Boolean(
        sceneSourceBadgeRect &&
          sceneSourceBadgeStyle?.display !== "none" &&
          sceneSourceBadgeRect.width > 1 &&
          sceneSourceBadgeRect.height > 1,
      ),
      sceneBrandAdd: sceneBrandAddRect
        ? {
            left: Math.round(sceneBrandAddRect.left),
            right: Math.round(sceneBrandAddRect.right),
            top: Math.round(sceneBrandAddRect.top),
            bottom: Math.round(sceneBrandAddRect.bottom),
          }
        : null,
      sceneTimeline: sceneTimelineRect
        ? {
            top: Math.round(sceneTimelineRect.top),
            bottom: Math.round(sceneTimelineRect.bottom),
            height: Math.round(sceneTimelineRect.height),
            clientHeight: Math.round(sceneTimeline.clientHeight),
            scrollHeight: Math.round(sceneTimeline.scrollHeight),
            contentClientHeight: sceneTimelineScroll ? Math.round(sceneTimelineScroll.clientHeight) : null,
            contentScrollHeight: sceneTimelineScroll ? Math.round(sceneTimelineScroll.scrollHeight) : null,
            contentMaxBottom: sceneTimelineContentMaxBottom === null
              ? null
              : Math.round(sceneTimelineContentMaxBottom),
          }
        : null,
      sceneSubmit: sceneSubmitRect
        ? {
            left: Math.round(sceneSubmitRect.left),
            right: Math.round(sceneSubmitRect.right),
            width: Math.round(sceneSubmitRect.width),
            height: Math.round(sceneSubmitRect.height),
            top: Math.round(sceneSubmitRect.top),
            bottom: Math.round(sceneSubmitRect.bottom),
          }
        : null,
      sceneVisualTrack: sceneVisualTrackRect
        ? {
            top: Math.round(sceneVisualTrackRect.top),
            bottom: Math.round(sceneVisualTrackRect.bottom),
            height: Math.round(sceneVisualTrackRect.height),
          }
        : null,
      sceneActiveVisualCell: sceneActiveVisualCellRect
        ? {
            top: Math.round(sceneActiveVisualCellRect.top),
            bottom: Math.round(sceneActiveVisualCellRect.bottom),
            height: Math.round(sceneActiveVisualCellRect.height),
            pointerEvents: sceneActiveVisualCellStyle?.pointerEvents ?? "",
          }
        : null,
      sceneSelectionFrame: sceneSelectionFrameMetrics,
      sceneMainScrollTop: sceneMain ? Math.round(sceneMain.scrollTop) : null,
      sceneMainClientHeight: sceneMain ? Math.round(sceneMain.clientHeight) : null,
      sceneMainScrollHeight: sceneMain ? Math.round(sceneMain.scrollHeight) : null,
      sceneLayout: sceneLayoutRect
        ? {
            top: Math.round(sceneLayoutRect.top),
            bottom: Math.round(sceneLayoutRect.bottom),
            height: Math.round(sceneLayoutRect.height),
            gridTemplateRows: sceneLayoutStyle?.gridTemplateRows ?? "",
          }
        : null,
      scenePreviewColumn: scenePreviewColumnRect
        ? {
            top: Math.round(scenePreviewColumnRect.top),
            bottom: Math.round(scenePreviewColumnRect.bottom),
            height: Math.round(scenePreviewColumnRect.height),
          }
        : null,
      studioIdeaEmptyState: studioIdeaEmptyStateRect
        ? {
            top: Math.round(studioIdeaEmptyStateRect.top),
            bottom: Math.round(studioIdeaEmptyStateRect.bottom),
            height: Math.round(studioIdeaEmptyStateRect.height),
          }
        : null,
      studioComposer: studioComposerRect
        ? {
            top: Math.round(studioComposerRect.top),
            bottom: Math.round(studioComposerRect.bottom),
            height: Math.round(studioComposerRect.height),
          }
        : null,
      studioComposerInner: studioComposerInnerRect
        ? {
            top: Math.round(studioComposerInnerRect.top),
            right: Math.round(studioComposerInnerRect.right),
            bottom: Math.round(studioComposerInnerRect.bottom),
            left: Math.round(studioComposerInnerRect.left),
            width: Math.round(studioComposerInnerRect.width),
            height: Math.round(studioComposerInnerRect.height),
          }
        : null,
      studioPreview: studioPreviewRect
        ? {
            top: Math.round(studioPreviewRect.top),
            right: Math.round(studioPreviewRect.right),
            bottom: Math.round(studioPreviewRect.bottom),
            left: Math.round(studioPreviewRect.left),
            width: Math.round(studioPreviewRect.width),
            height: Math.round(studioPreviewRect.height),
          }
        : null,
      studioPreviewClose: studioPreviewCloseRect
        ? {
            top: Math.round(studioPreviewCloseRect.top),
            right: Math.round(studioPreviewCloseRect.right),
            bottom: Math.round(studioPreviewCloseRect.bottom),
            left: Math.round(studioPreviewCloseRect.left),
            width: Math.round(studioPreviewCloseRect.width),
            height: Math.round(studioPreviewCloseRect.height),
          }
        : null,
      studioPreviewActions: studioPreviewActionRects.map((rect) => ({
        top: Math.round(rect.top),
        right: Math.round(rect.right),
        bottom: Math.round(rect.bottom),
        left: Math.round(rect.left),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      })),
      studioPreviewActionIcons: studioPreviewActionIconRects.map((rect) => ({
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      })),
      studioPreviewControls: studioPreviewControlsRect
        ? {
            top: Math.round(studioPreviewControlsRect.top),
            right: Math.round(studioPreviewControlsRect.right),
            bottom: Math.round(studioPreviewControlsRect.bottom),
            left: Math.round(studioPreviewControlsRect.left),
            width: Math.round(studioPreviewControlsRect.width),
            height: Math.round(studioPreviewControlsRect.height),
          }
        : null,
      studioPreviewPlayerRadius: studioPreviewPlayerStyle
        ? Number.parseFloat(studioPreviewPlayerStyle.borderTopLeftRadius) || 0
        : null,
      studioPreviewControlButtons: studioPreviewControlRects.map((rect) => ({
        top: Math.round(rect.top),
        right: Math.round(rect.right),
        bottom: Math.round(rect.bottom),
        left: Math.round(rect.left),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      })),
      studioWelcome: studioWelcomeRect
        ? {
            top: Math.round(studioWelcomeRect.top),
            right: Math.round(studioWelcomeRect.right),
            bottom: Math.round(studioWelcomeRect.bottom),
            left: Math.round(studioWelcomeRect.left),
            width: Math.round(studioWelcomeRect.width),
            height: Math.round(studioWelcomeRect.height),
          }
        : null,
      headerHeight: headerRect ? Math.round(headerRect.height) : null,
      headerBottom: headerRect ? Math.round(headerRect.bottom) : null,
      firstHeading: firstHeadingRect
        ? {
            top: Math.round(firstHeadingRect.top),
            bottom: Math.round(firstHeadingRect.bottom),
          }
        : null,
    };
  });

const openAndMeasureSceneVisualPanel = async (page) => {
  const addVisualButton = page.locator(
    'button[aria-label^="Добавить визуал в сцену"], button[aria-label^="Add visual to scene"]',
  );
  const addVisualButtonCount = await addVisualButton.count();
  if (addVisualButtonCount !== 1) {
    return { error: `expected one add-visual button, found ${addVisualButtonCount}` };
  }

  await addVisualButton.click();
  await page.waitForSelector(
    ".studio-segment-editor__layout.is-visual-panel-open .studio-segment-editor__prompt-column",
    { state: "visible", timeout: 2_000 },
  );
  await page.waitForTimeout(80);

  const openedMetrics = await page.evaluate(() => {
    const main = document.querySelector(".studio-canvas-main.is-segment-editor");
    const promptColumn = document.querySelector(
      ".studio-segment-editor__layout.is-visual-panel-open .studio-segment-editor__prompt-column",
    );
    const promptPanel = promptColumn?.querySelector(".studio-segment-editor__prompt-panel");
    const promptVisualPanel = promptColumn?.querySelector(".studio-segment-editor__prompt-visual-panel");
    const promptField = promptColumn?.querySelector(".studio-segment-editor__prompt-field");
    const promptActionRow = promptColumn?.querySelector(".studio-segment-editor__prompt-action-row");
    const preview = document.querySelector(
      ".studio-segment-editor__layout.is-visual-panel-open .studio-segment-editor__carousel",
    );
    const submitRow = document.querySelector(
      ".studio-segment-editor__layout.is-visual-panel-open .studio-segment-editor__timeline-submit-row",
    );
    const previewToggleLabel = submitRow?.querySelector(
      ".studio-segment-editor__timeline-preview-toggle span",
    );
    const timeline = document.querySelector(".studio-segment-editor__timeline");
    const timelineScroll = timeline?.querySelector(".studio-segment-editor__timeline-scroll");
    const timelineAddRail = timeline?.querySelector(".studio-segment-editor__timeline-add-rail");
    const timelineEndTimecode = timeline?.querySelector(
      ".studio-segment-editor__timeline-timecode-boundary--end",
    );
    const firstVoiceShell = timeline?.querySelector(
      ".studio-segment-editor__timeline-row--voice .studio-segment-editor__timeline-cell-shell",
    );
    const firstVoicePlay = firstVoiceShell?.querySelector(".studio-segment-editor__timeline-play");
    const firstVoiceCopy = firstVoiceShell?.querySelector(".studio-segment-editor__timeline-cell-copy");
    const header = document.querySelector(".site-header--workspace .site-header__inner");
    if (
      !main ||
      !promptColumn ||
      !promptPanel ||
      !promptVisualPanel ||
      !promptField ||
      !promptActionRow ||
      !preview ||
      !submitRow ||
      !timeline
    ) {
      return { error: "opened visual panel is missing from the scene editor" };
    }

    const mainRect = main.getBoundingClientRect();
    const promptColumnRect = promptColumn.getBoundingClientRect();
    const promptPanelRect = promptPanel.getBoundingClientRect();
    const promptVisualPanelRect = promptVisualPanel.getBoundingClientRect();
    const promptFieldRect = promptField.getBoundingClientRect();
    const promptActionRowRect = promptActionRow.getBoundingClientRect();
    const previewRect = preview.getBoundingClientRect();
    const submitRowRect = submitRow.getBoundingClientRect();
    const timelineRect = timeline.getBoundingClientRect();
    const timelineScrollRect = timelineScroll?.getBoundingClientRect() ?? null;
    const timelineAddRailRect = timelineAddRail?.getBoundingClientRect() ?? null;
    const timelineEndTimecodeRect = timelineEndTimecode?.getBoundingClientRect() ?? null;
    const firstVoicePlayRect = firstVoicePlay?.getBoundingClientRect() ?? null;
    const firstVoiceCopyRect = firstVoiceCopy?.getBoundingClientRect() ?? null;
    const headerRect = header?.getBoundingClientRect() ?? null;
    const documentElement = document.documentElement;
    const body = document.body;
    const mainStyle = window.getComputedStyle(main);
    const contentTop = mainRect.top + (Number.parseFloat(mainStyle.paddingTop) || 0);
    const visibleHeight = Math.max(
      0,
      Math.min(promptColumnRect.bottom, mainRect.bottom) - Math.max(promptColumnRect.top, contentTop),
    );
    const promptTextEscapes = Array.from(
      promptColumn.querySelectorAll(".studio-segment-editor__prompt-submenu-button"),
    ).flatMap((button) => {
      const buttonRect = button.getBoundingClientRect();
      return Array.from(
        button.querySelectorAll(
          ".studio-segment-editor__prompt-tool-label strong, .studio-segment-editor__prompt-tool-label small",
        ),
      )
        .filter((label) => {
          const labelStyle = window.getComputedStyle(label);
          if (labelStyle.display === "none" || labelStyle.visibility === "hidden") {
            return false;
          }
          const labelRect = label.getBoundingClientRect();
          return (
            labelRect.left < buttonRect.left - 1 ||
            labelRect.right > buttonRect.right + 1 ||
            labelRect.top < buttonRect.top - 1 ||
            labelRect.bottom > buttonRect.bottom + 1
          );
        })
        .map((label) => label.textContent?.trim() || "unnamed label");
    });

    return {
      error: null,
      documentClientHeight: documentElement.clientHeight,
      documentScrollHeight: Math.max(documentElement.scrollHeight, body?.scrollHeight ?? 0),
      mainClientHeight: Math.round(main.clientHeight),
      mainScrollHeight: Math.round(main.scrollHeight),
      mainScrollTop: Math.round(main.scrollTop),
      panelHeight: Math.round(promptPanelRect.height),
      panelWidth: Math.round(promptPanelRect.width),
      panelRight: Math.round(promptPanelRect.right),
      headerHeight: headerRect ? Math.round(headerRect.height) : null,
      promptActionWidth: Math.round(promptActionRowRect.width),
      promptBottom: Math.round(promptColumnRect.bottom),
      promptFieldHeight: Math.round(promptFieldRect.height),
      promptFieldWidth: Math.round(promptFieldRect.width),
      promptTop: Math.round(promptColumnRect.top),
      promptVisualHeight: Math.round(promptVisualPanelRect.height),
      promptVisualWidth: Math.round(promptVisualPanelRect.width),
      promptTextEscapes,
      previewBottom: Math.round(previewRect.bottom),
      previewHeight: Math.round(previewRect.height),
      previewTop: Math.round(previewRect.top),
      previewRight: Math.round(previewRect.right),
      previewWidth: Math.round(previewRect.width),
      submitBottom: Math.round(submitRowRect.bottom),
      submitHeight: Math.round(submitRowRect.height),
      submitLeft: Math.round(submitRowRect.left),
      submitRight: Math.round(submitRowRect.right),
      submitTop: Math.round(submitRowRect.top),
      previewLabelClientWidth: previewToggleLabel?.clientWidth ?? null,
      previewLabelScrollWidth: previewToggleLabel?.scrollWidth ?? null,
      timelineAddRailBottom: timelineAddRailRect ? Math.round(timelineAddRailRect.bottom) : null,
      timelineAddRailHeight: timelineAddRailRect ? Math.round(timelineAddRailRect.height) : null,
      timelineAddRailTop: timelineAddRailRect ? Math.round(timelineAddRailRect.top) : null,
      timelineBottom: Math.round(timelineRect.bottom),
      timelineEndTimecodeRight: timelineEndTimecodeRect
        ? Math.round(timelineEndTimecodeRect.right)
        : null,
      timelineScrollRight: timelineScrollRect ? Math.round(timelineScrollRect.right) : null,
      timelineTop: Math.round(timelineRect.top),
      voiceCopyLeft: firstVoiceCopyRect ? Math.round(firstVoiceCopyRect.left) : null,
      voicePlayRight: firstVoicePlayRect ? Math.round(firstVoicePlayRect.right) : null,
      visibleHeight: Math.round(visibleHeight),
      viewportHeight: document.documentElement.clientHeight,
      viewportWidth: document.documentElement.clientWidth,
    };
  });

  if (openedMetrics.error) {
    return openedMetrics;
  }

  const activeTimelineVisual = page.locator(
    'button[aria-pressed="true"][aria-label^="Открыть визуал сцены"], ' +
      'button[aria-pressed="true"][aria-label^="Open scene"]',
  );
  const activeTimelineVisualCount = await activeTimelineVisual.count();
  if (activeTimelineVisualCount !== 1) {
    return {
      ...openedMetrics,
      error: `expected one active timeline visual, found ${activeTimelineVisualCount}`,
    };
  }

  await activeTimelineVisual.click();
  await page.waitForSelector(".studio-segment-editor__layout.is-visual-panel-closed", {
    state: "visible",
    timeout: 2_000,
  });
  await page.waitForTimeout(80);

  const closedMetrics = await page.evaluate(() => {
    const previewContainer = document.querySelector(".studio-canvas-preview.is-segment-editor");
    const activeCard = document.querySelector(".studio-segment-editor__card.is-active");
    const activeCardCopy = activeCard?.querySelector(".studio-segment-editor__card-copy");
    const activeCardPlaceholder = activeCard?.querySelector(
      ".studio-segment-editor__card-placeholder.is-action",
    );
    const activeCardPlaceholderBefore = activeCardPlaceholder
      ? window.getComputedStyle(activeCardPlaceholder, "::before")
      : null;
    const timeline = document.querySelector(".studio-segment-editor__timeline");
    const timelineScroll = timeline?.querySelector(".studio-segment-editor__timeline-scroll");
    const timelineMusicRow = timeline?.querySelector(
      ".studio-segment-editor__timeline-row--music",
    );
    const timelineLabels = Array.from(
      timeline?.querySelectorAll(
        ".studio-segment-editor__timeline-row .studio-segment-editor__timeline-label",
      ) ?? [],
    );
    const header = document.querySelector("header");
    const activeCardRect = activeCard?.getBoundingClientRect();
    const timelineScrollRect = timelineScroll?.getBoundingClientRect();
    const timelineMusicRowRect = timelineMusicRow?.getBoundingClientRect();
    const headerRect = header?.getBoundingClientRect();
    const timelineLabelsValid =
      timelineLabels.length === 5 &&
      timelineLabels.every((label) => {
        const style = window.getComputedStyle(label);
        const row = label.closest(".studio-segment-editor__timeline-row");
        const track = row?.querySelector(".studio-segment-editor__timeline-track");
        const labelRect = label.getBoundingClientRect();
        const trackRect = track?.getBoundingClientRect();
        return (
          Number.parseFloat(style.fontSize) > 0 &&
          style.color !== "rgba(0, 0, 0, 0)" &&
          label.scrollWidth <= label.clientWidth + 1 &&
          Boolean(trackRect && labelRect.right <= trackRect.left + 1)
        );
      });

    return {
      closedCardCopyDisplay: activeCardCopy
        ? window.getComputedStyle(activeCardCopy).display
        : null,
      closedCardPlaceholderClientWidth: activeCardPlaceholder?.clientWidth ?? null,
      closedCardPlaceholderScrollWidth: activeCardPlaceholder?.scrollWidth ?? null,
      closedCardPlaceholderSquareHeight: activeCardPlaceholderBefore
        ? Number.parseFloat(activeCardPlaceholderBefore.height)
        : null,
      closedCardPlaceholderSquareWidth: activeCardPlaceholderBefore
        ? Number.parseFloat(activeCardPlaceholderBefore.width)
        : null,
      closedCardTop: activeCardRect ? Math.round(activeCardRect.top) : null,
      closedCardWidth: activeCardRect ? Math.round(activeCardRect.width) : null,
      closedHeaderBottom: headerRect ? Math.round(headerRect.bottom) : null,
      closedPreviewScrollTop: previewContainer ? Math.round(previewContainer.scrollTop) : null,
      closedTimelineContentOverflow:
        timelineScrollRect && timelineMusicRowRect
          ? Math.max(0, timelineMusicRowRect.bottom - timelineScrollRect.bottom)
          : null,
      closedTimelineLabelsValid: timelineLabelsValid,
    };
  });

  return { ...openedMetrics, ...closedMetrics };
};

const auditRoute = async ({ browser, browserName, baseUrl, route, surface, scenario, sampleState }) => {
  const effectiveWidth = Math.max(320, Math.round(scenario.width / scenario.zoom));
  const effectiveHeight = Math.max(320, Math.round(scenario.height / scenario.zoom));
  const page = await browser.newPage({
    viewport: { width: effectiveWidth, height: effectiveHeight },
    deviceScaleFactor: scenario.fontScale,
    reducedMotion: "reduce",
  });
  page.setDefaultTimeout(5_000);
  page.setDefaultNavigationTimeout(20_000);
  const runtimeErrors = [];
  page.on("pageerror", (error) => {
    runtimeErrors.push(error instanceof Error ? error.message : String(error));
  });

  if (surface === "app") {
    await installAppMocks(page, { hasLegacyProject: route.includes("audit=legacy-project") });
  }

  const label = `${browserName} ${surface}${route} viewport=${scenario.width}x${scenario.height} effective=${effectiveWidth}x${effectiveHeight} zoom=${Math.round(
    scenario.zoom * 100,
  )}% font=${Math.round(scenario.fontScale * 100)}%`;
  const url = new URL(route, baseUrl).toString();

  try {
    await page.goto(url, { waitUntil: "commit", timeout: 20_000 });
    await page.waitForFunction(() => document.readyState !== "loading", null, { timeout: 5_000 }).catch(() => undefined);
    await page.waitForSelector("body", { timeout: 5_000 }).catch(() => undefined);
    await page.addStyleTag({
      content: `
        html{font-size:${scenario.fontScale * 100}% !important;}
        body{max-width:100%;}
        *,*::before,*::after{animation-delay:0ms!important;animation-duration:0.01ms!important;transition-delay:0ms!important;transition-duration:0.01ms!important;}
        [data-reveal]{filter:none!important;opacity:1!important;transform:none!important;}
      `,
    });
    await page.waitForLoadState("load", { timeout: 3_000 }).catch(() => undefined);
    await page
      .evaluate(() =>
        Promise.race([
          document.fonts?.ready ?? Promise.resolve(),
          new Promise((resolve) => window.setTimeout(resolve, 2_000)),
        ]),
      )
      .catch(() => undefined);
    await page.waitForTimeout(180);

    const expectsScenesMode = surface === "app" && route.includes("mode=scenes");
    const usesSceneHeightContinuum =
      expectsScenesMode &&
      effectiveWidth >= 1181 &&
      effectiveHeight >= 400 &&
      effectiveHeight <= 861 &&
      effectiveWidth > effectiveHeight;
    const auditsLegacyLaptopProject =
      surface === "app" &&
      route.includes("audit=legacy-project") &&
      scenario.type === "laptop-125";
    const auditsCompactLegacyProject =
      surface === "app" &&
      route.includes("audit=legacy-project") &&
      (scenario.type === "idea-controls" ||
        scenario.type === "idea-compact" ||
        scenario.type === "scene-breakpoint-lower" ||
        scenario.type === "scene-breakpoint-upper");
    const auditsStandardIdeaControls =
      surface === "app" &&
      route.includes("audit=legacy-project") &&
      scenario.type === "idea-standard";
    const expectsCompactLandscapeSceneEditor =
      expectsScenesMode &&
      effectiveWidth >= 641 &&
      effectiveHeight >= 400 &&
      effectiveHeight <= 760 &&
      effectiveWidth > effectiveHeight;
    const minimumScenePreviewWidth = expectsCompactLandscapeSceneEditor ? 80 : 160;
    const minimumScenePreviewHeight = expectsCompactLandscapeSceneEditor ? 145 : 280;
    const auditsSceneVisualPanel =
      expectsScenesMode &&
      scenario.fontScale === 1 &&
      ((scenario.width === 1920 && scenario.zoom === 1.75) ||
        scenario.type === "scene-fit" ||
        scenario.type === "scene-embedded" ||
        scenario.type === "scene-breakpoint-lower" ||
        scenario.type === "scene-short-desktop" ||
        scenario.type === "scene-breakpoint-upper" ||
        scenario.type === "scene-height-continuum" ||
        scenario.type === "scene-compact-desktop" ||
        scenario.type === "scene-user-laptop" ||
        scenario.type === "laptop-125");
    const scenesModeReady = expectsScenesMode
      ? await page
          .waitForSelector(".studio-canvas-main.is-segment-editor", { state: "visible", timeout: 10_000 })
          .then(() => true)
          .catch(() => false)
      : true;

    if (surface === "app" && route.includes("audit=legacy-project")) {
      await page
        .waitForSelector(
          ".studio-canvas-preview.has-video-preview .studio-video-modal__player-controls",
          { state: "visible", timeout: 5_000 },
        )
        .catch(() => undefined);
      await page
        .waitForFunction(
          () => {
            const preview = document
              .querySelector(".studio-canvas-preview.has-video-preview")
              ?.getBoundingClientRect();
            const composer = document
              .querySelector(".studio-canvas-route:not(.is-segment-editor) .studio-canvas-prompt")
              ?.getBoundingClientRect();
            return Boolean(
              preview &&
                composer &&
                preview.width > 0 &&
                preview.height > 0 &&
                composer.width > 0 &&
                composer.height > 0 &&
                preview.bottom <= composer.top - 6,
            );
          },
          null,
          { timeout: 3_000 },
        )
        .catch(() => undefined);
      await page.waitForTimeout(80);
    }

    const metrics = await evaluateLayout(page);
    const failures = [];
    let legacyProjectSceneFeedback = null;
    if (auditsLegacyLaptopProject) {
      const scenesTabName = route.startsWith("/en/") ? "By scenes" : "По сценам";
      const scenesTab = page.getByRole("tab", { name: scenesTabName, exact: true });
      if ((await scenesTab.count()) === 1) {
        await scenesTab.click();
        const warningToast = page.locator(".studio-toast--warning");
        const warningVisible = await warningToast
          .waitFor({ state: "visible", timeout: 2_000 })
          .then(() => true)
          .catch(() => false);
        legacyProjectSceneFeedback = {
          isSegmentEditorOpen: Boolean(await page.locator(".studio-canvas-main.is-segment-editor").count()),
          message: warningVisible ? (await warningToast.textContent())?.trim() ?? "" : "",
          warningVisible,
        };
      }
    }

    if (auditsCompactLegacyProject) {
      if (
        !metrics.studioPreview ||
        !metrics.studioComposer ||
        !metrics.studioComposerInner ||
        !metrics.studioPreviewControls ||
        metrics.studioPreviewActions.length === 0 ||
        metrics.studioPreviewControlButtons.length === 0
      ) {
        failures.push("compact legacy project is missing preview, composer or player controls");
      } else {
        const auditsRegularIdeaControls = scenario.type === "idea-controls";
        const auditsTinyIdeaViewport = scenario.type === "idea-compact";
        const minimumCompactPreviewHeight = effectiveHeight <= 400 ? 130 : auditsTinyIdeaViewport ? 150 : 220;
        const expectedPreviewActionSize = auditsRegularIdeaControls
          ? Math.min(20, Math.max(17.33, metrics.studioPreview.width * 0.0867))
          : null;
        const expectedPreviewActionIconSize = auditsRegularIdeaControls
          ? Math.min(9.33, Math.max(7, metrics.studioPreview.width * 0.0333))
          : null;
        const expectedPlayerControlSize = auditsRegularIdeaControls
          ? Math.min(34, Math.max(30, metrics.studioPreview.width * 0.15))
          : null;
        const maximumPreviewActionSize = auditsRegularIdeaControls
          ? (expectedPreviewActionSize ?? 20) + 1
          : metrics.studioPreview.width <= 100 ? 21 : 32;
        const maximumPlayerControlSize = auditsRegularIdeaControls
          ? (expectedPlayerControlSize ?? 34) + 1
          : metrics.studioPreview.width <= 100 ? 18 : 28;
        const maximumPlayerPanelHeight = auditsRegularIdeaControls
          ? (expectedPlayerControlSize ?? 34) + 35
          : 48;

        if (metrics.studioPreview.bottom > metrics.studioComposer.top - 6) {
          failures.push(
            `compact legacy preview overlaps its composer: ` +
              `${metrics.studioPreview.bottom} > ${metrics.studioComposer.top - 6}`,
          );
        }

        if (metrics.studioComposer.height > 145) {
          failures.push(`compact legacy composer is too tall: ${metrics.studioComposer.height}px`);
        }

        if (metrics.studioPreview.height < minimumCompactPreviewHeight) {
          failures.push(`compact legacy preview is disproportionately small: ${metrics.studioPreview.height}px`);
        }

        if (
          metrics.studioComposer.left < 8 ||
          metrics.studioComposer.right > metrics.clientWidth - 8 ||
          metrics.studioComposerInner.left < metrics.studioComposer.left ||
          metrics.studioComposerInner.right > metrics.studioComposer.right
        ) {
          failures.push(
            `compact composer leaves its available width: outer ` +
              `${metrics.studioComposer.left}-${metrics.studioComposer.right}, inner ` +
              `${metrics.studioComposerInner.left}-${metrics.studioComposerInner.right}, viewport ${metrics.clientWidth}`,
          );
        }

        const outsidePreviewAction = metrics.studioPreviewActions.find(
          (rect) =>
            rect.left < metrics.studioPreview.left - 1 ||
            rect.right > metrics.studioPreview.right + 1 ||
            rect.top < metrics.studioPreview.top - 1 ||
            rect.width > maximumPreviewActionSize ||
            rect.height > maximumPreviewActionSize,
        );
        if (outsidePreviewAction) {
          failures.push(
            `compact preview action outgrows the video card: ` +
              `${outsidePreviewAction.width}x${outsidePreviewAction.height} at ` +
              `${outsidePreviewAction.left},${outsidePreviewAction.top}`,
          );
        }

        if (auditsRegularIdeaControls) {
          const mismatchedPreviewAction = metrics.studioPreviewActions.find(
            (rect) =>
              expectedPreviewActionSize !== null &&
              (Math.abs(rect.width - expectedPreviewActionSize) > 1.25 ||
                Math.abs(rect.height - expectedPreviewActionSize) > 1.25),
          );
          if (mismatchedPreviewAction) {
            failures.push(
              `regular preview action is not proportional: ` +
                `${mismatchedPreviewAction.width}x${mismatchedPreviewAction.height}`,
            );
          }

          const mismatchedPreviewActionIcon = metrics.studioPreviewActionIcons.find(
            (rect) =>
              expectedPreviewActionIconSize !== null &&
              (Math.abs(rect.width - expectedPreviewActionIconSize) > 1.25 ||
                Math.abs(rect.height - expectedPreviewActionIconSize) > 1.25),
          );
          if (
            metrics.studioPreviewActionIcons.length !== metrics.studioPreviewActions.length ||
            mismatchedPreviewActionIcon
          ) {
            failures.push(
              `regular preview action icons are not uniform: ` +
                `${mismatchedPreviewActionIcon?.width ?? metrics.studioPreviewActionIcons.length}x` +
                `${mismatchedPreviewActionIcon?.height ?? metrics.studioPreviewActions.length}`,
            );
          }
        }

        const oversizedPlayerControl = metrics.studioPreviewControlButtons.find(
          (rect) => rect.width > maximumPlayerControlSize || rect.height > maximumPlayerControlSize,
        );
        const outsidePlayerControl = metrics.studioPreviewControlButtons.find(
          (rect) =>
            rect.left < metrics.studioPreview.left - 1 ||
            rect.right > metrics.studioPreview.right + 1 ||
            rect.top < metrics.studioPreview.top - 1 ||
            rect.bottom > metrics.studioPreview.bottom + 1,
        );
        const mismatchedPlayerControl = auditsRegularIdeaControls && expectedPlayerControlSize !== null
          ? metrics.studioPreviewControlButtons.find(
              (rect) =>
                Math.abs(rect.width - expectedPlayerControlSize) > 1.25 ||
                Math.abs(rect.height - expectedPlayerControlSize) > 1.25,
            )
          : null;
        if (
          oversizedPlayerControl ||
          outsidePlayerControl ||
          mismatchedPlayerControl ||
          metrics.studioPreviewControls.height > maximumPlayerPanelHeight ||
          metrics.studioPreviewControls.left < metrics.studioPreview.left - 1 ||
          metrics.studioPreviewControls.right > metrics.studioPreview.right + 1 ||
          metrics.studioPreviewControls.bottom > metrics.studioPreview.bottom + 1
        ) {
          failures.push(
            `compact player controls do not scale with the video card: ` +
              `${oversizedPlayerControl?.width ?? mismatchedPlayerControl?.width ?? "panel"}x` +
              `${oversizedPlayerControl?.height ?? mismatchedPlayerControl?.height ?? metrics.studioPreviewControls.height}`,
          );
        }

        if (
          metrics.studioPreview.width <= 180 &&
          (metrics.studioPreviewPlayerRadius === null || metrics.studioPreviewPlayerRadius > 17)
        ) {
          failures.push(
            `compact video card radius is disproportionate: ${metrics.studioPreviewPlayerRadius ?? "missing"}px`,
          );
        }
      }
    }

    if (auditsStandardIdeaControls) {
      if (
        !metrics.studioPreview ||
        metrics.studioPreviewActions.length !== 4 ||
        metrics.studioPreviewActionIcons.length !== 4
      ) {
        failures.push("standard legacy preview is missing its four compact actions");
      } else {
        const outsideStandardAction = metrics.studioPreviewActions.find(
          (rect) =>
            rect.left < metrics.studioPreview.left - 1 ||
            rect.right > metrics.studioPreview.right + 1 ||
            rect.top < metrics.studioPreview.top - 1,
        );
        const mismatchedStandardAction = metrics.studioPreviewActions.find(
          (rect, index) =>
            Math.abs(rect.height - 24) > 1 ||
            (index < 3 ? rect.width <= 24 : Math.abs(rect.width - 24) > 1),
        );
        const mismatchedStandardActionIcon = metrics.studioPreviewActionIcons.find(
          (rect) => Math.abs(rect.width - 9) > 1 || Math.abs(rect.height - 9) > 1,
        );

        if (outsideStandardAction || mismatchedStandardAction || mismatchedStandardActionIcon) {
          failures.push(
            `standard preview actions do not fit the video card uniformly: ` +
              `${outsideStandardAction?.right ?? mismatchedStandardAction?.width ?? mismatchedStandardActionIcon?.width}x` +
              `${outsideStandardAction?.top ?? mismatchedStandardAction?.height ?? mismatchedStandardActionIcon?.height}`,
          );
        }
      }
    }

    let laptopIdeaMetrics = null;
    const auditsLaptopIdea =
      surface === "app" &&
      route.includes("/app/studio") &&
      !route.includes("audit=legacy-project") &&
      !expectsScenesMode &&
      scenario.type === "laptop-125";
    if (auditsLaptopIdea) {
      if (metrics.studioWelcome) {
        await page.locator(".studio-welcome-card__close").click();
        await page.waitForTimeout(80);
      }
      laptopIdeaMetrics = await evaluateLayout(page);
    }
    const sceneVisualPanel = auditsSceneVisualPanel ? await openAndMeasureSceneVisualPanel(page) : null;

    if (!scenesModeReady) {
      failures.push("scenes mode did not render");
    }

    if (runtimeErrors.length > 0) {
      failures.push(`runtime errors: ${runtimeErrors.slice(0, 3).join("; ")}`);
    }

    if (metrics.scrollWidth > metrics.clientWidth + 1) {
      failures.push(`document overflow ${metrics.scrollWidth} > ${metrics.clientWidth}`);
    }

    if (metrics.badControls.length > 0) {
      failures.push(`controls outside viewport: ${metrics.badControls.map((item) => item.selector).join(", ")}`);
    }

    if (metrics.clippedText.length > 0) {
      failures.push(`important text is clipped: ${metrics.clippedText.map((item) => item.selector).join(", ")}`);
    }

    if (metrics.smallTouchControls.length > 0) {
      failures.push(
        `touch targets below 44px: ${metrics.smallTouchControls
          .map((item) => `${item.selector} ${item.width}x${item.height}`)
          .join(", ")}`,
      );
    }

    if (
      surface === "app" &&
      !metrics.isStudioRoute &&
      metrics.clientWidth <= 960 &&
      typeof metrics.headerHeight === "number" &&
      metrics.headerHeight > 80
    ) {
      failures.push(`compact header is taller than one row: ${metrics.headerHeight}px`);
    }

    if (metrics.overlaps.length > 0) {
      failures.push(`header overlaps: ${metrics.overlaps.map((item) => `${item.a}/${item.b}`).join(", ")}`);
    }

    if (auditsLaptopIdea) {
      if (metrics.studioWelcome) {
        if (
          metrics.studioWelcome.top < (metrics.headerBottom ?? 0) + 8 ||
          metrics.studioWelcome.right > metrics.clientWidth - 8 ||
          metrics.studioWelcome.bottom > metrics.clientHeight - 8 ||
          metrics.studioWelcome.left < 8
        ) {
          failures.push(
            `welcome panel leaves the usable viewport at 1229x692: ` +
              `${metrics.studioWelcome.left},${metrics.studioWelcome.top} to ` +
              `${metrics.studioWelcome.right},${metrics.studioWelcome.bottom}`,
          );
        }
      }

      if (!laptopIdeaMetrics?.studioIdeaEmptyState || !laptopIdeaMetrics.studioComposer) {
        failures.push("idea mode did not expose its empty state and composer at 1229x692");
      } else if (
        laptopIdeaMetrics.studioIdeaEmptyState.bottom >
        laptopIdeaMetrics.studioComposer.top - 8
      ) {
        failures.push(
          `idea mode overlaps its composer at 1229x692: ` +
            `${laptopIdeaMetrics.studioIdeaEmptyState.bottom} > ` +
            `${laptopIdeaMetrics.studioComposer.top - 8}`,
        );
      }
    }

    if (auditsLegacyLaptopProject) {
      if (!metrics.studioPreview || !metrics.studioComposer || !metrics.studioPreviewClose) {
        failures.push("legacy project preview, composer or close action is missing at 1229x692");
      } else {
        const expectedLaptopCloseSize = Math.min(20, Math.max(17.33, metrics.studioPreview.width * 0.0867));
        if (metrics.studioPreview.bottom > metrics.studioComposer.top - 8) {
          failures.push(
            `legacy preview overlaps its composer at 1229x692: ` +
              `${metrics.studioPreview.bottom} > ${metrics.studioComposer.top - 8}`,
          );
        }
        if (
          metrics.studioPreview.top < 0 ||
          metrics.studioPreviewClose.top < 0 ||
          metrics.studioPreviewClose.right > metrics.clientWidth ||
          metrics.studioPreviewClose.left < metrics.studioPreview.left - 1 ||
          metrics.studioPreviewClose.right > metrics.studioPreview.right + 1 ||
          Math.abs(metrics.studioPreviewClose.width - expectedLaptopCloseSize) > 1.25 ||
          Math.abs(metrics.studioPreviewClose.height - expectedLaptopCloseSize) > 1.25
        ) {
          failures.push(
            `legacy preview close action is not safely reachable at 1229x692: ` +
              `${metrics.studioPreviewClose.width}x${metrics.studioPreviewClose.height} ` +
              `at ${metrics.studioPreviewClose.left},${metrics.studioPreviewClose.top}`,
          );
        }
      }

      if (
        !legacyProjectSceneFeedback?.warningVisible ||
        legacyProjectSceneFeedback.isSegmentEditorOpen ||
        !legacyProjectSceneFeedback.message
      ) {
        failures.push("legacy project does not explain why By scenes mode is unavailable");
      }
    }

    if (
      metrics.firstHeading &&
      typeof metrics.headerBottom === "number" &&
      metrics.firstHeading.top < metrics.headerBottom + 8
    ) {
      failures.push(
        `page heading overlaps header: ${metrics.firstHeading.top} < ${metrics.headerBottom + 8}`,
      );
    }

    if (
      expectsScenesMode &&
      scenario.type !== "scene-embedded" &&
      metrics.scenePreview &&
      (metrics.scenePreview.width < minimumScenePreviewWidth ||
        metrics.scenePreview.height < minimumScenePreviewHeight)
    ) {
      failures.push(
        `scene preview too small: ${metrics.scenePreview.width}x${metrics.scenePreview.height}`,
      );
    }

    if (
      expectsScenesMode &&
      metrics.scenePreview &&
      metrics.scenePreviewColumn &&
      (metrics.scenePreview.top < metrics.scenePreviewColumn.top - 1 ||
        metrics.scenePreview.bottom > metrics.scenePreviewColumn.bottom + 1)
    ) {
      failures.push(
        `scene preview escapes its grid row: preview ${metrics.scenePreview.top}-${metrics.scenePreview.bottom}, ` +
          `column ${metrics.scenePreviewColumn.top}-${metrics.scenePreviewColumn.bottom}`,
      );
    }

    if (
      expectsScenesMode &&
      metrics.scenePreview &&
      metrics.sceneTimeline &&
      metrics.scenePreview.bottom > metrics.sceneTimeline.top - 1
    ) {
      failures.push(
        `scene preview overlaps timeline: ${metrics.scenePreview.bottom} > ${metrics.sceneTimeline.top - 1}`,
      );
    }

    if (sceneVisualPanel?.error) {
      failures.push(`scene visual panel: ${sceneVisualPanel.error}`);
    } else if (
      sceneVisualPanel &&
      (sceneVisualPanel.panelHeight < 160 ||
        sceneVisualPanel.panelWidth < 320 ||
        sceneVisualPanel.visibleHeight < Math.min(160, sceneVisualPanel.panelHeight))
    ) {
      failures.push(
        `scene visual panel is not reachable: ${sceneVisualPanel.panelWidth}x${sceneVisualPanel.panelHeight}, ` +
          `${sceneVisualPanel.visibleHeight}px visible`,
      );
    }

    if (
      sceneVisualPanel &&
      (sceneVisualPanel.promptVisualWidth < sceneVisualPanel.panelWidth - 32 ||
        sceneVisualPanel.promptFieldWidth < sceneVisualPanel.panelWidth - 48 ||
        sceneVisualPanel.promptActionWidth < sceneVisualPanel.panelWidth - 48)
    ) {
      failures.push(
        `scene prompt controls collapse horizontally: panel ${sceneVisualPanel.panelWidth}px, ` +
          `workspace ${sceneVisualPanel.promptVisualWidth}px, field ${sceneVisualPanel.promptFieldWidth}px, ` +
          `actions ${sceneVisualPanel.promptActionWidth}px`,
      );
    }

    if (
      sceneVisualPanel &&
      (sceneVisualPanel.closedPreviewScrollTop !== 0 ||
        (typeof sceneVisualPanel.closedCardTop === "number" &&
          typeof sceneVisualPanel.closedHeaderBottom === "number" &&
          sceneVisualPanel.closedCardTop < sceneVisualPanel.closedHeaderBottom))
    ) {
      failures.push(
        `scene preview shifts after closing the visual panel: scroll ${sceneVisualPanel.closedPreviewScrollTop}, ` +
          `card/header ${sceneVisualPanel.closedCardTop}/${sceneVisualPanel.closedHeaderBottom}`,
      );
    }

    if (sceneVisualPanel && scenario.type === "scene-fit") {
      if (
        sceneVisualPanel.documentScrollHeight > sceneVisualPanel.documentClientHeight + 1 ||
        sceneVisualPanel.mainScrollHeight > sceneVisualPanel.mainClientHeight + 1
      ) {
        failures.push(
          `scene editor scrolls at 1920x980/125%: document ${sceneVisualPanel.documentScrollHeight}/${sceneVisualPanel.documentClientHeight}, ` +
            `workspace ${sceneVisualPanel.mainScrollHeight}/${sceneVisualPanel.mainClientHeight}`,
        );
      }

      if (
        sceneVisualPanel.panelRight > sceneVisualPanel.viewportWidth + 1 ||
        sceneVisualPanel.promptBottom > sceneVisualPanel.viewportHeight + 1 ||
        sceneVisualPanel.previewRight > sceneVisualPanel.viewportWidth + 1 ||
        sceneVisualPanel.timelineBottom > sceneVisualPanel.viewportHeight + 1
      ) {
        failures.push("scene editor content leaves the viewport at 1920x980/125%");
      }

      if (sceneVisualPanel.previewWidth < 200 || sceneVisualPanel.previewHeight < 350) {
        failures.push(
          `scene preview is undersized at 1920x980/125%: ${sceneVisualPanel.previewWidth}x${sceneVisualPanel.previewHeight}`,
        );
      }

      const timelineInset = sceneVisualPanel.viewportHeight - sceneVisualPanel.timelineBottom;
      if (!usesSceneHeightContinuum && (timelineInset < 5 || timelineInset > 10)) {
        failures.push(`scene editor timeline inset is unsafe at 1920x980/125%: ${timelineInset}px`);
      }

      if (sceneVisualPanel.promptTextEscapes.length > 0) {
        failures.push(
          `scene prompt text escapes its buttons at 1920x980/125%: ${sceneVisualPanel.promptTextEscapes.join(", ")}`,
        );
      }
    }

    if (sceneVisualPanel && scenario.type === "scene-user-laptop") {
      if (
        metrics.scrollHeight > metrics.clientHeight + 1 ||
        metrics.sceneMainScrollHeight > metrics.sceneMainClientHeight + 1
      ) {
        failures.push(
          `scene user-laptop layout scrolls at ${scenario.width}x${scenario.height}: document ` +
            `${metrics.scrollHeight}/${metrics.clientHeight}, workspace ` +
            `${metrics.sceneMainScrollHeight}/${metrics.sceneMainClientHeight}`,
        );
      }

      if (
        !metrics.sceneTimeline ||
        metrics.sceneTimeline.height < 178 ||
        metrics.sceneTimeline.bottom > metrics.clientHeight - 5
      ) {
        failures.push(
          `scene user-laptop timeline is squeezed at ${scenario.width}x${scenario.height}: ` +
            `${metrics.sceneTimeline?.height ?? "missing"}px, bottom ${metrics.sceneTimeline?.bottom ?? "missing"}`,
        );
      }

      if (
        metrics.sceneTimeline?.contentMaxBottom !== null &&
        metrics.sceneTimeline.contentMaxBottom > metrics.sceneTimeline.bottom
      ) {
        failures.push(
          `scene user-laptop tracks are clipped at ${scenario.width}x${scenario.height}: ` +
            `${metrics.sceneTimeline.contentMaxBottom}/${metrics.sceneTimeline.bottom}`,
        );
      }

      if (metrics.scenePreview && metrics.sceneBrandAdd) {
        const cardCenter = (metrics.scenePreview.left + metrics.scenePreview.right) / 2;
        const brandCenter = (metrics.sceneBrandAdd.left + metrics.sceneBrandAdd.right) / 2;
        if (Math.abs(cardCenter - brandCenter) > 2) {
          failures.push(
            `scene brand is off-center at ${scenario.width}x${scenario.height}: ` +
              `${Math.round(brandCenter)} vs ${Math.round(cardCenter)}`,
          );
        }
      }
    }

    if (sceneVisualPanel && scenario.type === "scene-short-desktop") {
      const minimumShortTimelineHeight = effectiveHeight <= 460 ? 148 : 164;
      if (
        metrics.scrollHeight > metrics.clientHeight + 1 ||
        metrics.sceneMainScrollHeight > metrics.sceneMainClientHeight + 1
      ) {
        failures.push(
          `short desktop scene editor scrolls: document ${metrics.scrollHeight}/${metrics.clientHeight}, ` +
            `workspace ${metrics.sceneMainScrollHeight}/${metrics.sceneMainClientHeight}`,
        );
      }

      if (metrics.headerHeight === null || metrics.headerHeight > 50) {
        failures.push(`short desktop header is too tall: ${metrics.headerHeight ?? "missing"}px`);
      }

      if (
        !metrics.sceneTimeline ||
        metrics.sceneTimeline.height < minimumShortTimelineHeight ||
        metrics.sceneTimeline.bottom > metrics.clientHeight - 5
      ) {
        failures.push(
          `short desktop timeline is squeezed: ${metrics.sceneTimeline?.height ?? "missing"}px, ` +
            `bottom ${metrics.sceneTimeline?.bottom ?? "missing"}`,
        );
      }

      if (
        !metrics.sceneVisualTrack ||
        !metrics.sceneActiveVisualCell ||
        metrics.sceneActiveVisualCell.pointerEvents === "none" ||
        metrics.sceneActiveVisualCell.height < metrics.sceneVisualTrack.height - 1
      ) {
        failures.push(
          `short desktop visual track is not fully clickable: track ` +
            `${metrics.sceneVisualTrack?.height ?? "missing"}px, cell ` +
            `${metrics.sceneActiveVisualCell?.height ?? "missing"}px, pointer-events ` +
            `${metrics.sceneActiveVisualCell?.pointerEvents ?? "missing"}`,
        );
      }

      if (
        !metrics.sceneSelectionFrame ||
        metrics.sceneSelectionFrame.outlineBoxSizing !== "border-box" ||
        metrics.sceneSelectionFrame.scrollHeight > metrics.sceneSelectionFrame.clientHeight + 1 ||
        metrics.sceneSelectionFrame.bottom > (metrics.sceneTimeline?.bottom ?? 0) - 2
      ) {
        failures.push(
          `short desktop selection outline is clipped: ` +
            `${metrics.sceneSelectionFrame?.clientHeight ?? "missing"}/` +
            `${metrics.sceneSelectionFrame?.scrollHeight ?? "missing"}px, ` +
            `bottom ${metrics.sceneSelectionFrame?.bottom ?? "missing"}, ` +
            `box-sizing ${metrics.sceneSelectionFrame?.outlineBoxSizing ?? "missing"}`,
        );
      }

      if (effectiveHeight <= 460 && metrics.sceneCardFooterVisible) {
        failures.push("short desktop preview footer should leave only the centered brand control");
      }

      if (
        !metrics.sceneSubmit ||
        metrics.sceneSubmit.width > 304 ||
        metrics.sceneSubmit.height > 36 ||
        metrics.sceneSubmit.right < metrics.clientWidth - 18 ||
        metrics.sceneSubmit.bottom > (metrics.sceneTimeline?.top ?? 0) - 6
      ) {
        failures.push(
          `short desktop actions are not in the lower-right safe zone: ` +
            `${metrics.sceneSubmit?.width ?? "missing"}x${metrics.sceneSubmit?.height ?? "missing"} at ` +
            `${metrics.sceneSubmit?.right ?? "missing"},${metrics.sceneSubmit?.bottom ?? "missing"}`,
        );
      }

      if (metrics.scenePreview && metrics.sceneBrandAdd) {
        const cardCenter = (metrics.scenePreview.left + metrics.scenePreview.right) / 2;
        const brandCenter = (metrics.sceneBrandAdd.left + metrics.sceneBrandAdd.right) / 2;
        if (
          Math.abs(cardCenter - brandCenter) > 2 ||
          metrics.sceneBrandAdd.right - metrics.sceneBrandAdd.left > 56 ||
          metrics.sceneBrandAdd.bottom - metrics.sceneBrandAdd.top > 22
        ) {
          failures.push(
            `short desktop brand control is disproportionate: ` +
              `${metrics.sceneBrandAdd.right - metrics.sceneBrandAdd.left}x` +
              `${metrics.sceneBrandAdd.bottom - metrics.sceneBrandAdd.top}px`,
          );
        }
      }

      if (metrics.sceneCardCopy && metrics.sceneBrandAdd) {
        const overlapWidth = Math.min(metrics.sceneCardCopy.right, metrics.sceneBrandAdd.right) -
          Math.max(metrics.sceneCardCopy.left, metrics.sceneBrandAdd.left);
        const overlapHeight = Math.min(metrics.sceneCardCopy.bottom, metrics.sceneBrandAdd.bottom) -
          Math.max(metrics.sceneCardCopy.top, metrics.sceneBrandAdd.top);
        if (overlapWidth > 0 && overlapHeight > 0) {
          failures.push(`short desktop preview footer overlaps branding: ${overlapWidth}x${overlapHeight}px`);
        }
      }

      if (
        sceneVisualPanel.headerHeight === null ||
        sceneVisualPanel.headerHeight > 46 ||
        sceneVisualPanel.panelRight > sceneVisualPanel.previewRight - sceneVisualPanel.previewWidth + 1 ||
        sceneVisualPanel.submitBottom > sceneVisualPanel.timelineTop - 6 ||
        sceneVisualPanel.submitRight > sceneVisualPanel.viewportWidth - 8
      ) {
        failures.push(
          `short desktop open visual panel leaves its composition: header ${sceneVisualPanel.headerHeight}px, ` +
            `panel right ${sceneVisualPanel.panelRight}, preview left ` +
            `${sceneVisualPanel.previewRight - sceneVisualPanel.previewWidth}, actions ` +
            `${sceneVisualPanel.submitRight}/${sceneVisualPanel.submitBottom}`,
        );
      }

      if (
        sceneVisualPanel.previewLabelClientWidth === null ||
        sceneVisualPanel.previewLabelScrollWidth === null ||
        sceneVisualPanel.previewLabelScrollWidth > sceneVisualPanel.previewLabelClientWidth + 1
      ) {
        failures.push(
          `short desktop preview label is clipped: ` +
            `${sceneVisualPanel.previewLabelClientWidth ?? "missing"}/` +
            `${sceneVisualPanel.previewLabelScrollWidth ?? "missing"}`,
        );
      }

      if (
        sceneVisualPanel.voicePlayRight === null ||
        sceneVisualPanel.voiceCopyLeft === null ||
        sceneVisualPanel.voiceCopyLeft < sceneVisualPanel.voicePlayRight + 2
      ) {
        failures.push(
          `short desktop voice text overlaps playback: ` +
            `${sceneVisualPanel.voiceCopyLeft ?? "missing"}/` +
            `${sceneVisualPanel.voicePlayRight ?? "missing"}`,
        );
      }

      if (
        sceneVisualPanel.timelineAddRailHeight === null ||
        sceneVisualPanel.timelineAddRailHeight < minimumShortTimelineHeight - 32 ||
        sceneVisualPanel.timelineAddRailBottom === null ||
        sceneVisualPanel.timelineAddRailBottom > sceneVisualPanel.timelineBottom - 3
      ) {
        failures.push(
          `short desktop add-scene rail does not span the tracks: ` +
            `${sceneVisualPanel.timelineAddRailHeight ?? "missing"}px, bottom ` +
            `${sceneVisualPanel.timelineAddRailBottom ?? "missing"}`,
        );
      }

      if (
        sceneVisualPanel.timelineEndTimecodeRight === null ||
        sceneVisualPanel.timelineScrollRight === null ||
        sceneVisualPanel.timelineEndTimecodeRight > sceneVisualPanel.timelineScrollRight + 1
      ) {
        failures.push(
          `short desktop final timecode is clipped: ` +
            `${sceneVisualPanel.timelineEndTimecodeRight ?? "missing"}/` +
            `${sceneVisualPanel.timelineScrollRight ?? "missing"}`,
        );
      }
    }

    if (sceneVisualPanel && scenario.type === "scene-embedded") {
      if (
        metrics.sceneMainScrollHeight > metrics.sceneMainClientHeight + 1 ||
        sceneVisualPanel.mainScrollHeight > sceneVisualPanel.mainClientHeight + 1
      ) {
        failures.push(
          `embedded scene editor scrolls: closed ${metrics.sceneMainScrollHeight}/${metrics.sceneMainClientHeight}, ` +
            `open ${sceneVisualPanel.mainScrollHeight}/${sceneVisualPanel.mainClientHeight}`,
        );
      }

      if (
        sceneVisualPanel.panelRight > sceneVisualPanel.viewportWidth + 1 ||
        sceneVisualPanel.promptBottom > sceneVisualPanel.viewportHeight + 1 ||
        sceneVisualPanel.previewRight > sceneVisualPanel.viewportWidth + 1 ||
        sceneVisualPanel.timelineBottom > sceneVisualPanel.viewportHeight + 1
      ) {
        failures.push("embedded scene editor content leaves the viewport");
      }

      if (sceneVisualPanel.previewWidth < 80 || sceneVisualPanel.previewHeight < 145) {
        failures.push(
          `embedded scene preview is undersized: ${sceneVisualPanel.previewWidth}x${sceneVisualPanel.previewHeight}`,
        );
      }

      if (
        sceneVisualPanel.headerHeight === null ||
        sceneVisualPanel.headerHeight > 44 ||
        sceneVisualPanel.promptVisualHeight < 125 ||
        sceneVisualPanel.promptFieldHeight < 80
      ) {
        failures.push(
          `embedded scene workspace is not using the compact composition: header ${sceneVisualPanel.headerHeight}px, ` +
            `prompt ${sceneVisualPanel.promptVisualHeight}px, field ${sceneVisualPanel.promptFieldHeight}px`,
        );
      }

      const embeddedActionsAreBelowPreview =
        sceneVisualPanel.submitTop >= sceneVisualPanel.previewBottom + 6;
      const embeddedActionsAreBesidePreview =
        sceneVisualPanel.submitLeft >= sceneVisualPanel.previewRight + 6;
      if (
        (!embeddedActionsAreBelowPreview && !embeddedActionsAreBesidePreview) ||
        sceneVisualPanel.submitBottom > sceneVisualPanel.timelineTop - 6 ||
        sceneVisualPanel.submitRight > sceneVisualPanel.viewportWidth - 8
      ) {
        failures.push(
          `embedded scene actions collide with the preview: preview x${sceneVisualPanel.previewRight}, ` +
            `y${sceneVisualPanel.previewTop}-${sceneVisualPanel.previewBottom}; actions x${sceneVisualPanel.submitLeft}-${sceneVisualPanel.submitRight}, ` +
            `y${sceneVisualPanel.submitTop}-${sceneVisualPanel.submitBottom}; timeline ${sceneVisualPanel.timelineTop}`,
        );
      }

      if (metrics.scenePreview && metrics.sceneSubmit) {
        const compositionGap = metrics.sceneSubmit.left - metrics.scenePreview.right;
        const compositionCenter = (metrics.scenePreview.left + metrics.sceneSubmit.right) / 2;
        if (compositionGap < 8 || compositionGap > 48) {
          failures.push(`embedded preview/actions gap is unbalanced: ${compositionGap}px`);
        }
        if (Math.abs(compositionCenter - metrics.clientWidth / 2) > 36) {
          failures.push(
            `embedded preview/actions group is off-center: ${Math.round(compositionCenter)} vs ${Math.round(metrics.clientWidth / 2)}`,
          );
        }
      }
    }

    if (sceneVisualPanel && usesSceneHeightContinuum) {
      const clampMetric = (minimum, value, maximum) =>
        Math.min(maximum, Math.max(minimum, value));
      const expectedHeaderHeight = clampMetric(40, effectiveHeight * 0.0744, 64);
      const expectedHeaderReserve = clampMetric(48, effectiveHeight * 0.0906, 78);
      const expectedBottomInset = clampMetric(12, effectiveHeight * 0.0348, 30);
      const expectedGap = clampMetric(5, effectiveHeight * 0.015, 13);
      const expectedPreviewInset = clampMetric(4, effectiveHeight * 0.008, 7);
      const expectedSubmitHeight = clampMetric(30, effectiveHeight * 0.0558, 48);
      const expectedTimelineHeight =
        clampMetric(31, effectiveHeight * 0.0534, 46) +
        clampMetric(30, effectiveHeight * 0.07, 72) +
        clampMetric(20, effectiveHeight * 0.045, 46) * 4;
      const expectedLayoutHeight =
        effectiveHeight - expectedHeaderReserve - expectedBottomInset;
      const expectedPreviewHeight = clampMetric(
        148,
        expectedLayoutHeight -
          expectedTimelineHeight -
          expectedGap -
          expectedPreviewInset * 2,
        480,
      );
      const expectedMinimumPromptFieldHeight = clampMetric(
        48,
        effectiveHeight * 0.125,
        70,
      );
      const previewSlack = metrics.scenePreview && metrics.scenePreviewColumn
        ? metrics.scenePreviewColumn.height - metrics.scenePreview.height
        : Number.POSITIVE_INFINITY;
      const actionsRightInset = metrics.sceneSubmit
        ? metrics.clientWidth - metrics.sceneSubmit.right
        : Number.POSITIVE_INFINITY;

      if (!metrics.sceneTimeline || metrics.sceneTimeline.bottom > metrics.clientHeight - 8) {
        failures.push(
          `scene height continuum leaves the viewport at ${scenario.width}x${scenario.height}: ` +
            `${metrics.sceneTimeline?.height ?? "missing"}px, bottom ${metrics.sceneTimeline?.bottom ?? "missing"}`,
        );
      }

      if (previewSlack < -1 || previewSlack > expectedPreviewInset * 2 + 2) {
        failures.push(
          `scene height continuum preview leaves unused vertical space: ${previewSlack}px`,
        );
      }

      if (
        !metrics.sceneSubmit ||
        actionsRightInset < 8 ||
        actionsRightInset > 40 ||
        metrics.sceneSubmit.bottom > (metrics.sceneTimeline?.top ?? 0) - expectedGap + 1
      ) {
        failures.push(
          `scene height continuum actions left the lower-right safe zone: ` +
            `${metrics.sceneSubmit?.right ?? "missing"},${metrics.sceneSubmit?.bottom ?? "missing"}; ` +
            `right inset ${actionsRightInset}`,
        );
      }

      if (
        metrics.scenePreview &&
        metrics.scenePreview.width <= 230 &&
        metrics.sceneSourceBadgeVisible
      ) {
        failures.push("scene source badge remains visible when the preview cannot fit it");
      }

      if (
        sceneVisualPanel.closedTimelineContentOverflow === null ||
        sceneVisualPanel.closedTimelineContentOverflow > 1
      ) {
        failures.push(
          `scene height continuum clips the bottom track: ` +
            `${sceneVisualPanel.closedTimelineContentOverflow ?? "missing"}px`,
        );
      }

      if (!sceneVisualPanel.closedTimelineLabelsValid) {
        failures.push("scene height continuum hides or clips the left timeline labels");
      }

      if (
        typeof sceneVisualPanel.closedCardWidth === "number" &&
        sceneVisualPanel.closedCardWidth <= 230 &&
        sceneVisualPanel.closedCardCopyDisplay !== "none"
      ) {
        failures.push("scene height continuum lets scene metadata overlap the brand control");
      }

      if (
        sceneVisualPanel.closedCardPlaceholderSquareWidth === null ||
        sceneVisualPanel.closedCardPlaceholderSquareHeight === null ||
        Math.abs(
          sceneVisualPanel.closedCardPlaceholderSquareWidth -
            sceneVisualPanel.closedCardPlaceholderSquareHeight,
        ) > 1 ||
        sceneVisualPanel.closedCardPlaceholderSquareWidth < 20 ||
        sceneVisualPanel.closedCardPlaceholderScrollWidth >
          sceneVisualPanel.closedCardPlaceholderClientWidth + 1
      ) {
        failures.push(
          `scene height continuum distorts the add-visual control: ` +
            `${sceneVisualPanel.closedCardPlaceholderSquareWidth ?? "missing"}x` +
            `${sceneVisualPanel.closedCardPlaceholderSquareHeight ?? "missing"}px`,
        );
      }

      if (
        sceneVisualPanel.headerHeight === null ||
        Math.abs(sceneVisualPanel.headerHeight - expectedHeaderHeight) > 2 ||
        Math.abs(sceneVisualPanel.previewHeight - expectedPreviewHeight) > 3 ||
        Math.abs(sceneVisualPanel.timelineBottom - sceneVisualPanel.timelineTop - expectedTimelineHeight) > 3 ||
        Math.abs(sceneVisualPanel.submitHeight - expectedSubmitHeight) > 3 ||
        sceneVisualPanel.promptBottom > sceneVisualPanel.timelineTop - expectedGap + 1 ||
        sceneVisualPanel.submitBottom > sceneVisualPanel.timelineTop - expectedGap + 1 ||
        sceneVisualPanel.promptFieldHeight < expectedMinimumPromptFieldHeight
      ) {
        failures.push(
          `scene height continuum is not proportional: header ${sceneVisualPanel.headerHeight}/${expectedHeaderHeight.toFixed(1)}px, ` +
            `preview ${sceneVisualPanel.previewHeight}px/${sceneVisualPanel.previewBottom}, ` +
            `prompt ${sceneVisualPanel.promptBottom}, actions ${sceneVisualPanel.submitHeight}/${sceneVisualPanel.submitBottom}, ` +
            `timeline ${sceneVisualPanel.timelineTop}-${sceneVisualPanel.timelineBottom}/${expectedTimelineHeight.toFixed(1)}, ` +
            `field ${sceneVisualPanel.promptFieldHeight}px`,
        );
      }

      if (
        sceneVisualPanel.previewLabelClientWidth !== null &&
        sceneVisualPanel.previewLabelScrollWidth !== null &&
        sceneVisualPanel.previewLabelScrollWidth > sceneVisualPanel.previewLabelClientWidth + 1
      ) {
        failures.push("scene height continuum clips the preview label");
      }

      if (
        sceneVisualPanel.timelineEndTimecodeRight !== null &&
        sceneVisualPanel.timelineScrollRight !== null &&
        sceneVisualPanel.timelineEndTimecodeRight > sceneVisualPanel.timelineScrollRight + 1
      ) {
        failures.push("scene height continuum clips the final timeline timecode");
      }

      if (
        sceneVisualPanel.voiceCopyLeft !== null &&
        sceneVisualPanel.voicePlayRight !== null &&
        sceneVisualPanel.voiceCopyLeft < sceneVisualPanel.voicePlayRight + 3
      ) {
        failures.push("scene height continuum lets voice text overlap its play control");
      }

      if (
        sceneVisualPanel.timelineAddRailTop === null ||
        sceneVisualPanel.timelineAddRailBottom === null ||
        sceneVisualPanel.timelineAddRailHeight === null ||
        sceneVisualPanel.timelineAddRailTop < sceneVisualPanel.timelineTop ||
        sceneVisualPanel.timelineAddRailBottom > sceneVisualPanel.timelineBottom + 1 ||
        sceneVisualPanel.timelineAddRailHeight < expectedTimelineHeight * 0.58
      ) {
        failures.push("scene height continuum does not keep the add rail at full track height");
      }

      if (sceneVisualPanel.promptTextEscapes.length > 0) {
        failures.push(
          `scene height continuum prompt text escapes its controls: ${sceneVisualPanel.promptTextEscapes.join(", ")}`,
        );
      }
    }

    if (
      sceneVisualPanel &&
      scenario.type === "scene-compact-desktop" &&
      !usesSceneHeightContinuum
    ) {
      const layoutInset = metrics.sceneLayout
        ? metrics.clientHeight - metrics.sceneLayout.bottom
        : Number.NaN;
      const timelineInset = metrics.sceneTimeline
        ? metrics.clientHeight - metrics.sceneTimeline.bottom
        : Number.NaN;
      if (
        !metrics.sceneLayout ||
        !metrics.sceneTimeline ||
        layoutInset < 5 ||
        layoutInset > 10 ||
        timelineInset < 5 ||
        timelineInset > 10
      ) {
        failures.push(
          `compact desktop timeline inset is unsafe: layout ${layoutInset}px, timeline ${timelineInset}px`,
        );
      }

      if (sceneVisualPanel.promptTextEscapes.length > 0) {
        failures.push(
          `compact prompt text escapes its buttons: ${sceneVisualPanel.promptTextEscapes.join(", ")}`,
        );
      }

      if (metrics.sceneCardCopy && metrics.sceneBrandAdd) {
        const overlapWidth = Math.min(metrics.sceneCardCopy.right, metrics.sceneBrandAdd.right) -
          Math.max(metrics.sceneCardCopy.left, metrics.sceneBrandAdd.left);
        const overlapHeight = Math.min(metrics.sceneCardCopy.bottom, metrics.sceneBrandAdd.bottom) -
          Math.max(metrics.sceneCardCopy.top, metrics.sceneBrandAdd.top);
        if (overlapWidth > 0 && overlapHeight > 0) {
          failures.push(
            `compact preview footer overlaps branding: ${overlapWidth}x${overlapHeight}px`,
          );
        }
      }
    }

    if (sceneVisualPanel && scenario.type === "laptop-125") {
      if (
        sceneVisualPanel.documentScrollHeight > sceneVisualPanel.documentClientHeight + 1 ||
        sceneVisualPanel.mainScrollHeight > sceneVisualPanel.mainClientHeight + 1
      ) {
        failures.push(
          `scene editor scrolls at 1229x692: document ` +
            `${sceneVisualPanel.documentScrollHeight}/${sceneVisualPanel.documentClientHeight}, workspace ` +
            `${sceneVisualPanel.mainScrollHeight}/${sceneVisualPanel.mainClientHeight}`,
        );
      }

      if (sceneVisualPanel.previewWidth < 165 || sceneVisualPanel.previewHeight < 295) {
        failures.push(
          `scene preview is undersized at 1229x692: ` +
            `${sceneVisualPanel.previewWidth}x${sceneVisualPanel.previewHeight}`,
        );
      }

      const previewLeft = sceneVisualPanel.previewRight - sceneVisualPanel.previewWidth;
      if (sceneVisualPanel.panelWidth < 540 || sceneVisualPanel.panelRight > previewLeft - 8) {
        failures.push(
          `scene tools and preview do not fit side by side at 1229x692: panel ` +
            `${sceneVisualPanel.panelWidth}px/right ${sceneVisualPanel.panelRight}, ` +
            `preview ${previewLeft}-${sceneVisualPanel.previewRight}`,
        );
      }

      if (
        sceneVisualPanel.promptBottom > sceneVisualPanel.timelineTop - 8 ||
        sceneVisualPanel.timelineBottom > sceneVisualPanel.viewportHeight - 5
      ) {
        failures.push(
          `scene compact surfaces leave their rows at 1229x692: prompt ${sceneVisualPanel.promptBottom}, ` +
            `timeline ${sceneVisualPanel.timelineTop}-${sceneVisualPanel.timelineBottom}`,
        );
      }
    }

    if (
      expectsScenesMode &&
      metrics.scenePreview &&
      metrics.sceneTimeline &&
      metrics.sceneTimeline.top < metrics.scenePreview.bottom
    ) {
      failures.push(
        `timeline overlaps scene preview: ${metrics.sceneTimeline.top} < ${metrics.scenePreview.bottom}`,
      );
    }

    if (
      expectsScenesMode &&
      metrics.scenePreview &&
      typeof metrics.headerBottom === "number" &&
      metrics.scenePreview.top < metrics.headerBottom
    ) {
      failures.push(
        `scene preview overlaps header: ${metrics.scenePreview.top} < ${metrics.headerBottom}`,
      );
    }

    const screenshotName = `${safeName(
      `${surface}-${route}-w${scenario.width}-h${scenario.height}-z${scenario.zoom}-f${scenario.fontScale}`,
    )}.png`;
    if (failures.length > 0) {
      const screenshotPath = path.join(artifactDir, browserName, "failures", screenshotName);
      await mkdir(path.dirname(screenshotPath), { recursive: true });
      await page.screenshot({ path: screenshotPath, fullPage: false });
      return {
        ok: false,
        label,
        failures,
        metrics: { ...metrics, sceneVisualPanel },
        screenshotPath,
      };
    }

    const isCanonicalSample =
      scenario.zoom === 1 &&
      scenario.fontScale === 1 &&
      ((scenario.width === 390 && scenario.height === 844) ||
        (scenario.width === 768 && scenario.height === 1024) ||
        (scenario.width === 1440 && scenario.height === 900) ||
        (scenario.width === 1920 && scenario.height === 1080));
    const shouldAlwaysCaptureScenesSample = surface === "app" && route.includes("mode=scenes");
    const shouldCaptureWorkspaceSample =
      surface === "app" && route.includes("/app") && scenario.width === 390 && scenario.height === 844;
    const isScenesStressSample =
      shouldAlwaysCaptureScenesSample &&
      scenario.fontScale === 1 &&
      ((scenario.width === 1280 && scenario.height === 720 && scenario.zoom === 1.5) ||
        (scenario.width === 1920 && scenario.height === 1080 && scenario.zoom === 2) ||
        scenario.type === "laptop-125");
    const isLaptop125Sample =
      surface === "app" && route.includes("/app/studio") && scenario.type === "laptop-125";
    if (
      (isCanonicalSample || isScenesStressSample || isLaptop125Sample) &&
      (shouldAlwaysCaptureScenesSample || shouldCaptureWorkspaceSample || sampleState.count < 24)
    ) {
      if (route === "/" || route === "/en") {
        await page.waitForTimeout(800);
      }
      const screenshotPath = path.join(artifactDir, browserName, "samples", screenshotName);
      await mkdir(path.dirname(screenshotPath), { recursive: true });
      await page.screenshot({ path: screenshotPath, fullPage: false });
      sampleState.count += 1;
    }

    return { ok: true, label, metrics: { ...metrics, sceneVisualPanel } };
  } catch (error) {
    const screenshotPath = path.join(
      artifactDir,
      browserName,
      "failures",
      `${safeName(
        `${surface}-${route}-w${scenario.width}-h${scenario.height}-z${scenario.zoom}-f${scenario.fontScale}-error`,
      )}.png`,
    );
    await mkdir(path.dirname(screenshotPath), { recursive: true });
    await page.screenshot({ path: screenshotPath, fullPage: false }).catch(() => undefined);
    return {
      ok: false,
      label,
      failures: [error instanceof Error ? error.message : String(error)],
      metrics: null,
      screenshotPath,
    };
  } finally {
    await page.close().catch(() => undefined);
  }
};

const run = async () => {
  await rm(artifactDir, { recursive: true, force: true });
  await mkdir(artifactDir, { recursive: true });

  const appPort = auditsApp ? await getFreePort() : null;
  const staticPort = auditsStatic ? await getFreePort() : null;
  const appBaseUrl = appPort === null ? null : `http://127.0.0.1:${appPort}`;
  const staticBaseUrl = staticPort === null ? null : `http://127.0.0.1:${staticPort}`;
  const appServer = appPort === null
    ? null
    : startProcess("npm", ["run", "dev:web", "--", "--port", String(appPort), "--strictPort"], appRoot, "vite");
  const staticServer = staticPort === null ? null : await startStaticServer(staticPort);
  const scenarios = buildScenarios();
  const failures = [];
  let checked = 0;
  let activeBrowser = null;

  const shutdown = async () => {
    await stopProcess(appServer);
    await stopStaticServer(staticServer);
  };

  let isShuttingDown = false;
  const handleSignal = (exitCode) => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    void (async () => {
      if (activeBrowser) await activeBrowser.close().catch(() => undefined);
      await shutdown();
    })().finally(() => process.exit(exitCode));
  };

  process.once("SIGINT", () => handleSignal(130));
  process.once("SIGTERM", () => handleSignal(143));

  let auditTimeout = null;
  const timeoutPromise = new Promise((_, reject) => {
    auditTimeout = setTimeout(() => {
      reject(new Error(`Responsive audit timed out after ${Math.round(auditTimeoutMs / 1000)} seconds.`));
    }, auditTimeoutMs);
  });

  const executeAudit = async () => {
    await Promise.all([
      ...(appBaseUrl ? [waitForUrl(appBaseUrl, "Vite")] : []),
      ...(staticBaseUrl ? [waitForUrl(staticBaseUrl, "static server")] : []),
    ]);
    const surfaces = [
      ...(appBaseUrl ? [{ surface: "app", baseUrl: appBaseUrl, routes: appRoutes }] : []),
      ...(staticBaseUrl ? [{ surface: "static", baseUrl: staticBaseUrl, routes: staticRoutes }] : []),
    ];
    const expectedChecks = requestedBrowserNames.length * scenarios.length * surfaces.reduce(
      (total, entry) => total + entry.routes.length,
      0,
    );
    console.log(
      `Responsive audit starting ${expectedChecks} checks with concurrency ${auditConcurrency} ` +
        `and timeout ${Math.round(auditTimeoutMs / 1000)}s.`,
    );

    for (const browserName of requestedBrowserNames) {
      const browserType = browserTypes[browserName];
      activeBrowser = await browserType.launch();
      const sampleState = { count: 0 };

      try {
        for (const entry of surfaces) {
          for (const route of entry.routes) {
            let scenarioIndex = 0;
            const workerCount = Math.min(auditConcurrency, scenarios.length);
            await Promise.all(
              Array.from({ length: workerCount }, async () => {
                while (scenarioIndex < scenarios.length) {
                  const scenario = scenarios[scenarioIndex];
                  scenarioIndex += 1;
                  const result = await auditRoute({
                    browser: activeBrowser,
                    browserName,
                    ...entry,
                    route,
                    scenario,
                    sampleState,
                  });
                  checked += 1;
                  if (checked % progressEvery === 0 || checked === expectedChecks) {
                    console.log(`Responsive audit progress: ${checked}/${expectedChecks} checks.`);
                  }

                  if (!result.ok) {
                    failures.push(result);
                    console.error(`FAIL ${result.label}`);
                    console.error(`  ${result.failures.join("; ")}`);
                    if (result.metrics?.offenders?.length) {
                      console.error(`  offenders: ${result.metrics.offenders.map((item) => item.selector).join(", ")}`);
                    }
                    if (result.metrics?.scenePreview) {
                      console.error(
                        `  scene geometry: ${JSON.stringify({
                          mainScrollTop: result.metrics.sceneMainScrollTop,
                          layout: result.metrics.sceneLayout,
                          previewColumn: result.metrics.scenePreviewColumn,
                          preview: result.metrics.scenePreview,
                          submit: result.metrics.sceneSubmit,
                          timeline: result.metrics.sceneTimeline,
                        })}`,
                      );
                    }
                    if (result.screenshotPath) console.error(`  screenshot: ${result.screenshotPath}`);
                  }
                }
              }),
            );
          }
        }
      } finally {
        await activeBrowser.close().catch(() => undefined);
        activeBrowser = null;
      }
    }

    const auditMode = scenesOnly ? "scenes" : quickMode ? "quick" : "full";
    console.log(`Responsive audit checked ${checked} scenarios (${auditMode} mode).`);
    console.log(`Scope: ${auditScope}.`);
    console.log(`Browsers: ${requestedBrowserNames.join(", ")}.`);
    console.log(`Screenshots: ${artifactDir}`);

    if (failures.length > 0) {
      console.error(`Responsive audit failed: ${failures.length} scenario(s).`);
      process.exitCode = 1;
      return;
    }

    console.log("Responsive audit passed.");
  };

  try {
    await Promise.race([executeAudit(), timeoutPromise]);
  } finally {
    if (auditTimeout) clearTimeout(auditTimeout);
    if (activeBrowser) await activeBrowser.close().catch(() => undefined);
    await shutdown();
  }
};

void run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
