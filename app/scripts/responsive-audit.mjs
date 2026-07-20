import { spawn } from "node:child_process";
import { createReadStream } from "node:fs";
import { createServer } from "node:http";
import { mkdir, rm, stat } from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(scriptDir, "..");
const repoRoot = path.resolve(appRoot, "..");
const artifactDir = path.join(repoRoot, ".codex-tmp", "responsive-audit");
const quickMode = process.env.RESPONSIVE_AUDIT_QUICK === "1";
const scenesOnly = process.env.RESPONSIVE_AUDIT_SCENES_ONLY === "1";

const widths = quickMode
  ? [320, 390, 768, 1280, 1920]
  : [320, 360, 390, 480, 640, 768, 1024, 1280, 1440, 1920];
const zooms = quickMode ? [1, 1.5, 2] : [1, 1.25, 1.5, 1.75, 2];
const fontScales = quickMode ? [1, 1.5] : [1, 1.25, 1.5];
const defaultViewportHeight = 900;

const appRoutes = scenesOnly
  ? ["/app/studio?mode=scenes", "/en/app/studio?mode=scenes"]
  : quickMode
    ? ["/", "/pricing", "/examples", "/app/studio", "/app/studio?mode=scenes", "/app/projects"]
    : [
      "/",
      "/pricing",
      "/examples",
      "/en",
      "/en/pricing",
      "/en/examples",
      "/app/studio",
      "/app/studio?mode=scenes",
      "/en/app/studio?mode=scenes",
      "/app/projects",
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
  child.kill("SIGTERM");
  await new Promise((resolve) => {
    const timeout = setTimeout(resolve, 2_000);
    child.once("exit", () => {
      clearTimeout(timeout);
      resolve();
    });
  });
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

const installAppMocks = async (page) => {
  await page.route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const resourceType = request.resourceType();

    if (resourceType === "media") {
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
      await fulfillJson(route, { data: { latestGeneration: null, profile: workspaceProfile, studioOptions } });
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
  const scenarios = [];

  for (const width of widths) {
    for (const zoom of zooms) {
      scenarios.push({ width, height: defaultViewportHeight, zoom, fontScale: 1, type: "zoom" });
    }

    for (const fontScale of fontScales.filter((value) => value !== 1)) {
      scenarios.push({ width, height: defaultViewportHeight, zoom: 1, fontScale, type: "font" });
    }
  }

  scenarios.push(
    { width: 1280, height: 600, zoom: 1, fontScale: 1, type: "height" },
    { width: 1440, height: 720, zoom: 1, fontScale: 1, type: "height" },
    { width: 1920, height: 800, zoom: 1, fontScale: 1, type: "height" },
  );

  if (quickMode) {
    scenarios.push({ width: 1920, height: defaultViewportHeight, zoom: 1.75, fontScale: 1, type: "zoom" });
  }

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
    const sceneTimelineRect = document
      .querySelector(".studio-segment-editor__timeline")
      ?.getBoundingClientRect();
    const sceneSubmitRect = document
      .querySelector(".studio-segment-editor__timeline-submit-row")
      ?.getBoundingClientRect();
    const sceneMain = document.querySelector(".studio-canvas-main.is-segment-editor");
    const sceneLayout = document.querySelector(".studio-segment-editor__layout");
    const sceneLayoutRect = sceneLayout?.getBoundingClientRect();
    const sceneLayoutStyle = sceneLayout ? window.getComputedStyle(sceneLayout) : null;
    const scenePreviewColumnRect = document
      .querySelector(".studio-segment-editor__preview-column")
      ?.getBoundingClientRect();
    const headerRect = document.querySelector("header")?.getBoundingClientRect();
    const firstHeadingRect = document.querySelector("main h1")?.getBoundingClientRect();

    return {
      clientWidth: viewportWidth,
      clientHeight: viewportHeight,
      scrollWidth,
      scrollHeight,
      offenders,
      badControls,
      overlaps: overlaps.slice(0, 6),
      scenePreview: activeSceneCardRect
        ? {
            width: Math.round(activeSceneCardRect.width),
            height: Math.round(activeSceneCardRect.height),
            top: Math.round(activeSceneCardRect.top),
            bottom: Math.round(activeSceneCardRect.bottom),
          }
        : null,
      sceneTimeline: sceneTimelineRect
        ? {
            top: Math.round(sceneTimelineRect.top),
            bottom: Math.round(sceneTimelineRect.bottom),
          }
        : null,
      sceneSubmit: sceneSubmitRect
        ? {
            top: Math.round(sceneSubmitRect.top),
            bottom: Math.round(sceneSubmitRect.bottom),
          }
        : null,
      sceneMainScrollTop: sceneMain ? Math.round(sceneMain.scrollTop) : null,
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

  return page.evaluate(() => {
    const main = document.querySelector(".studio-canvas-main.is-segment-editor");
    const promptColumn = document.querySelector(
      ".studio-segment-editor__layout.is-visual-panel-open .studio-segment-editor__prompt-column",
    );
    const promptPanel = promptColumn?.querySelector(".studio-segment-editor__prompt-panel");
    if (!main || !promptColumn || !promptPanel) {
      return { error: "opened visual panel is missing from the scene editor" };
    }

    const mainRect = main.getBoundingClientRect();
    const promptColumnRect = promptColumn.getBoundingClientRect();
    const promptPanelRect = promptPanel.getBoundingClientRect();
    const mainStyle = window.getComputedStyle(main);
    const contentTop = mainRect.top + (Number.parseFloat(mainStyle.paddingTop) || 0);
    const visibleHeight = Math.max(
      0,
      Math.min(promptColumnRect.bottom, mainRect.bottom) - Math.max(promptColumnRect.top, contentTop),
    );

    return {
      error: null,
      mainScrollTop: Math.round(main.scrollTop),
      panelHeight: Math.round(promptPanelRect.height),
      panelWidth: Math.round(promptPanelRect.width),
      promptBottom: Math.round(promptColumnRect.bottom),
      promptTop: Math.round(promptColumnRect.top),
      visibleHeight: Math.round(visibleHeight),
    };
  });
};

const auditRoute = async ({ browser, baseUrl, route, surface, scenario, sampleState }) => {
  const effectiveWidth = Math.max(320, Math.round(scenario.width / scenario.zoom));
  const effectiveHeight = Math.max(320, Math.round(scenario.height / scenario.zoom));
  const page = await browser.newPage({
    viewport: { width: effectiveWidth, height: effectiveHeight },
    deviceScaleFactor: scenario.fontScale,
  });
  const runtimeErrors = [];
  page.on("pageerror", (error) => {
    runtimeErrors.push(error instanceof Error ? error.message : String(error));
  });

  if (surface === "app") {
    await installAppMocks(page);
  }

  const label = `${surface}${route} viewport=${scenario.width}x${scenario.height} effective=${effectiveWidth}x${effectiveHeight} zoom=${Math.round(
    scenario.zoom * 100,
  )}% font=${Math.round(scenario.fontScale * 100)}%`;
  const url = new URL(route, baseUrl).toString();

  try {
    await page.goto(url, { waitUntil: "commit", timeout: 20_000 });
    await page.waitForFunction(() => document.readyState !== "loading", null, { timeout: 5_000 }).catch(() => undefined);
    await page.waitForSelector("body", { timeout: 5_000 }).catch(() => undefined);
    await page.addStyleTag({
      content: `html{font-size:${scenario.fontScale * 100}% !important;} body{max-width:100%;}`,
    });
    await page.waitForLoadState("load", { timeout: 3_000 }).catch(() => undefined);
    await page.waitForTimeout(180);

    const expectsScenesMode = surface === "app" && route.includes("mode=scenes");
    const auditsSceneVisualPanel =
      expectsScenesMode &&
      scenario.fontScale === 1 &&
      scenario.height === defaultViewportHeight &&
      scenario.width === 1920 &&
      scenario.zoom === 1.75;
    const scenesModeReady = expectsScenesMode
      ? await page
          .waitForSelector(".studio-canvas-main.is-segment-editor", { state: "visible", timeout: 5_000 })
          .then(() => true)
          .catch(() => false)
      : true;

    const metrics = await evaluateLayout(page);
    const failures = [];
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

    if (metrics.overlaps.length > 0) {
      failures.push(`header overlaps: ${metrics.overlaps.map((item) => `${item.a}/${item.b}`).join(", ")}`);
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
      metrics.scenePreview &&
      (metrics.scenePreview.width < 160 || metrics.scenePreview.height < 280)
    ) {
      failures.push(
        `scene preview too small: ${metrics.scenePreview.width}x${metrics.scenePreview.height}`,
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
      const screenshotPath = path.join(artifactDir, "failures", screenshotName);
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
      scenario.height === defaultViewportHeight &&
      (scenario.width === 320 || scenario.width === 768 || scenario.width === 1920);
    const shouldAlwaysCaptureScenesSample = surface === "app" && route.includes("mode=scenes");
    const isScenesStressSample =
      shouldAlwaysCaptureScenesSample &&
      scenario.fontScale === 1 &&
      scenario.height === defaultViewportHeight &&
      ((scenario.width === 1280 && scenario.zoom === 1.5) ||
        (scenario.width === 1920 && scenario.zoom === 2));
    if (
      (isCanonicalSample || isScenesStressSample) &&
      (shouldAlwaysCaptureScenesSample || sampleState.count < 8)
    ) {
      if (route === "/" || route === "/en") {
        await page.waitForTimeout(800);
      }
      const screenshotPath = path.join(artifactDir, "samples", screenshotName);
      await mkdir(path.dirname(screenshotPath), { recursive: true });
      await page.screenshot({ path: screenshotPath, fullPage: false });
      sampleState.count += 1;
    }

    return { ok: true, label, metrics: { ...metrics, sceneVisualPanel } };
  } catch (error) {
    const screenshotPath = path.join(
      artifactDir,
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

  const appPort = await getFreePort();
  const staticPort = await getFreePort();
  const appBaseUrl = `http://127.0.0.1:${appPort}`;
  const staticBaseUrl = `http://127.0.0.1:${staticPort}`;
  const appServer = startProcess("npm", ["run", "dev:web", "--", "--port", String(appPort), "--strictPort"], appRoot, "vite");
  const staticServer = await startStaticServer(staticPort);
  const scenarios = buildScenarios();
  const sampleState = { count: 0 };
  const failures = [];
  let checked = 0;
  let browser = null;

  const shutdown = async () => {
    await stopProcess(appServer);
    await stopStaticServer(staticServer);
  };

  process.once("SIGINT", () => {
    void shutdown().finally(() => process.exit(130));
  });

  try {
    await Promise.all([waitForUrl(appBaseUrl, "Vite"), waitForUrl(staticBaseUrl, "static server")]);
    browser = await chromium.launch();

    const surfaces = [
      { surface: "app", baseUrl: appBaseUrl, routes: appRoutes },
      { surface: "static", baseUrl: staticBaseUrl, routes: staticRoutes },
    ];

    for (const entry of surfaces) {
      for (const route of entry.routes) {
        for (const scenario of scenarios) {
          const result = await auditRoute({ browser, ...entry, route, scenario, sampleState });
          checked += 1;

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
      }
    }

    const auditMode = scenesOnly ? "scenes" : quickMode ? "quick" : "full";
    console.log(`Responsive audit checked ${checked} scenarios (${auditMode} mode).`);
    console.log(`Screenshots: ${artifactDir}`);

    if (failures.length > 0) {
      console.error(`Responsive audit failed: ${failures.length} scenario(s).`);
      process.exitCode = 1;
      return;
    }

    console.log("Responsive audit passed.");
  } finally {
    if (browser) await browser.close().catch(() => undefined);
    await shutdown();
  }
};

void run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
