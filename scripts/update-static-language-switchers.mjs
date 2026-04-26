import { readdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const excludedDirs = new Set([".git", ".codex-tmp", "app", "logs", "node_modules", "tmp"]);
const localeOrder = ["ru", "en"];
const localeLabels = {
  ru: "Русский",
  en: "English",
};

const latestAssetVersions = {
  css: 53,
  script: 6,
};
const siteOrigin = "https://adshortsai.com";

const globeIcon =
  '<svg class="lang-switcher__icon" width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.8"/><path d="M3 12h18M12 3c2.2 2.35 3.4 5.35 3.4 9s-1.2 6.65-3.4 9M12 3c-2.2 2.35-3.4 5.35-3.4 9s1.2 6.65 3.4 9" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';

const escapeAttr = (value) =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

const getLocaleFromHtml = (html) => {
  const lang = /<html\s+lang="([^"]+)"/i.exec(html)?.[1]?.toLowerCase() ?? "ru";
  return lang.startsWith("en") ? "en" : "ru";
};

const getSelfHref = (relativeFilePath) => (path.basename(relativeFilePath) === "index.html" ? "./" : `./${path.basename(relativeFilePath)}`);

const localFileToSitePath = (relativeFilePath) => {
  const normalized = relativeFilePath.split(path.sep).join("/");
  if (normalized === "index.html") return "/";
  if (normalized.endsWith("/index.html")) return `/${normalized.slice(0, -"index.html".length)}`;
  return `/${normalized}`;
};

const getPageUrl = (relativeFilePath) => new URL(localFileToSitePath(relativeFilePath), siteOrigin);

const parseAlternates = (html) => {
  const alternates = new Map();
  const pattern = /<link\s+rel="alternate"\s+hreflang="([^"]+)"\s+href="([^"]+)"\s*\/?>/gi;
  let match;

  while ((match = pattern.exec(html))) {
    alternates.set(match[1], match[2]);
  }

  return alternates;
};

const parseSwitcherHrefs = (html) => {
  const hrefs = {};
  const pattern = /<a\s+class="lang-switcher__option[^"]*"\s+href="([^"]+)"[^>]*aria-label="(RU|EN)\s/gi;
  let match;

  while ((match = pattern.exec(html))) {
    hrefs[match[2].toLowerCase()] = match[1];
  }

  return hrefs;
};

const absoluteToRelativeHref = (absoluteHref, relativeFilePath) => {
  const pageUrl = getPageUrl(relativeFilePath);
  const targetUrl = new URL(absoluteHref);
  const fromSegments = pageUrl.pathname.endsWith("/")
    ? pageUrl.pathname.split("/").filter(Boolean)
    : pageUrl.pathname.split("/").filter(Boolean).slice(0, -1);
  const targetSegments = targetUrl.pathname.split("/").filter(Boolean);

  while (fromSegments.length > 0 && targetSegments.length > 0 && fromSegments[0] === targetSegments[0]) {
    fromSegments.shift();
    targetSegments.shift();
  }

  const prefix = fromSegments.map(() => "..");
  const suffix = targetUrl.pathname.endsWith("/") ? [...targetSegments, ""] : targetSegments;
  const relative = [...prefix, ...suffix].join("/") || ".";

  return relative.startsWith(".") ? relative : `./${relative}`;
};

const renderLanguageSwitcher = ({ currentLocale, hrefs }) => {
  const triggerLabel = currentLocale === "en" ? "Language: English" : "Язык: Русский";
  const menuLabel = currentLocale === "en" ? "Language selection" : "Выбор языка";
  const options = localeOrder
    .map((locale) => {
      const shortLabel = locale.toUpperCase();
      const isActive = locale === currentLocale;
      const href = hrefs[locale] ?? "./";

      return `<a class="lang-switcher__option${isActive ? " is-active" : ""}" href="${escapeAttr(href)}" role="menuitem" aria-label="${shortLabel} ${localeLabels[locale]}"${isActive ? ' aria-current="page"' : ""}><span class="lang-switcher__code">${shortLabel}</span><span class="lang-switcher__label">${localeLabels[locale]}</span></a>`;
    })
    .join("");

  return `<details class="lang-switcher"><summary class="lang-switcher__trigger" aria-label="${triggerLabel}" title="${triggerLabel}">${globeIcon}<span>${currentLocale.toUpperCase()}</span></summary><div class="lang-switcher__menu" role="menu" aria-label="${menuLabel}">${options}</div></details>`;
};

const walkHtmlFiles = async (dir) => {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    if (entry.name.startsWith(".") && entry.name !== ".well-known") continue;
    if (entry.isDirectory() && excludedDirs.has(entry.name)) continue;

    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walkHtmlFiles(entryPath)));
    } else if (entry.isFile() && entry.name.endsWith(".html")) {
      files.push(entryPath);
    }
  }

  return files;
};

const replaceLegacySwitcher = (html, relativeFilePath) => {
  const currentLocale = getLocaleFromHtml(html);
  const targetLocale = currentLocale === "en" ? "ru" : "en";
  const selfHref = getSelfHref(relativeFilePath);

  return html.replace(
    /<li>\s*<a\b(?=[^>]*\bclass="lang-switch\b[^"]*")(?=[^>]*\bhref="([^"]+)")(?=[^>]*\btitle="([^"]*)")[^>]*>[\s\S]*?<\/a>\s*<\/li>/,
    (_match, targetHref) =>
      `<li>${renderLanguageSwitcher({
        currentLocale,
        hrefs: {
          [currentLocale]: selfHref,
          [targetLocale]: targetHref,
        },
      })}</li>`,
  );
};

const ensureLanguageSwitcher = (html, relativeFilePath) => {
  if (/class="lang-switcher"/.test(html)) return html;

  const currentLocale = getLocaleFromHtml(html);
  const alternates = parseAlternates(html);
  const hrefs = {
    [currentLocale]: getSelfHref(relativeFilePath),
  };

  for (const locale of localeOrder) {
    if (locale === currentLocale) continue;
    const alternateHref = alternates.get(locale);
    if (alternateHref?.startsWith(siteOrigin)) {
      hrefs[locale] = absoluteToRelativeHref(alternateHref, relativeFilePath);
    }
  }

  if (!hrefs.ru || !hrefs.en || !/<ul[^>]*id="nav-menu"[^>]*>/i.test(html)) return html;

  return html.replace(
    /(\s*)<\/ul>\s*<\/nav>/,
    `$1  <li>${renderLanguageSwitcher({ currentLocale, hrefs })}</li>$1</ul>\n        </nav>`,
  );
};

const ensureAlternateLinks = (html, relativeFilePath) => {
  const alternates = parseAlternates(html);
  const switcherHrefs = parseSwitcherHrefs(html);
  const currentLocale = getLocaleFromHtml(html);
  const pageUrl = getPageUrl(relativeFilePath);
  const nextAlternates = new Map(alternates);

  if (!nextAlternates.has(currentLocale)) {
    nextAlternates.set(currentLocale, pageUrl.href);
  }

  for (const locale of localeOrder) {
    if (nextAlternates.has(locale)) continue;

    const href = switcherHrefs[locale];
    if (href) {
      nextAlternates.set(locale, new URL(href, pageUrl).href);
    }
  }

  const missing = localeOrder.filter((locale) => !alternates.has(locale) && nextAlternates.has(locale));
  if (missing.length === 0) return html;

  const linesToInsert = missing
    .map((locale) => `    <link rel="alternate" hreflang="${locale}" href="${nextAlternates.get(locale)}" />`)
    .join("\n");

  const lastAlternatePattern = /(\s*<link\s+rel="alternate"\s+hreflang="[^"]+"\s+href="[^"]+"\s*\/>)(?![\s\S]*<link\s+rel="alternate"\s+hreflang="[^"]+"\s+href="[^"]+"\s*\/>)/i;
  if (lastAlternatePattern.test(html)) {
    return html.replace(lastAlternatePattern, `$1\n${linesToInsert}`);
  }

  return html.replace(/(\s*<link\s+rel="canonical"\s+href="[^"]+"\s*\/>)/i, `$1\n${linesToInsert}`);
};

const updateAssetVersions = (html) =>
  html
    .replace(/styles\.css\?v=\d+/g, `styles.css?v=${latestAssetVersions.css}`)
    .replace(/script\.js\?v=\d+/g, `script.js?v=${latestAssetVersions.script}`);

const main = async () => {
  const htmlFiles = await walkHtmlFiles(rootDir);
  const changedFiles = [];

  for (const filePath of htmlFiles) {
    const relativeFilePath = path.relative(rootDir, filePath);
    const current = await readFile(filePath, "utf8");
    let next = updateAssetVersions(current);
    next = replaceLegacySwitcher(next, relativeFilePath);
    next = ensureLanguageSwitcher(next, relativeFilePath);
    next = ensureAlternateLinks(next, relativeFilePath);

    if (next !== current) {
      await writeFile(filePath, next);
      changedFiles.push(relativeFilePath);
    }
  }

  console.log(
    changedFiles.length > 0
      ? `Updated static language switchers: ${changedFiles.length} files`
      : "Static language switchers are already up to date.",
  );
};

await main();
