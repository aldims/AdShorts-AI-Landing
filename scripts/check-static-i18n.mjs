import { access, readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const excludedDirs = new Set([".git", ".codex-tmp", "app", "logs", "node_modules", "tmp"]);
const siteOrigin = "https://adshortsai.com";
const requiredLocales = ["ru", "en"];
const allowedSingleLocaleFiles = new Set(["offer/index.html"]);
const latestAssetVersions = {
  css: 53,
  script: 6,
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

const parseAlternates = (html) => {
  const alternates = new Map();
  const pattern = /<link\s+rel="alternate"\s+hreflang="([^"]+)"\s+href="([^"]+)"\s*\/?>/gi;
  let match;

  while ((match = pattern.exec(html))) {
    alternates.set(match[1], match[2]);
  }

  return alternates;
};

const urlToLocalFile = (href) => {
  if (!href.startsWith(siteOrigin)) return null;

  const url = new URL(href);
  const pathname = decodeURIComponent(url.pathname);
  if (pathname === "/") return "index.html";
  if (pathname.endsWith("/")) return `${pathname.slice(1)}index.html`;
  return pathname.slice(1);
};

const fileExists = async (relativePath) => {
  if (!relativePath) return false;

  try {
    await access(path.join(rootDir, relativePath));
    return true;
  } catch {
    return false;
  }
};

const checkFile = async (filePath) => {
  const relativeFilePath = path.relative(rootDir, filePath);
  const html = await readFile(filePath, "utf8");
  const errors = [];
  const alternates = parseAlternates(html);
  const hasLocaleAlternates = requiredLocales.some((locale) => alternates.has(locale));
  const hasAllRequiredAlternates = requiredLocales.every((locale) => alternates.has(locale));

  if (!hasLocaleAlternates) return errors;

  if (!hasAllRequiredAlternates && allowedSingleLocaleFiles.has(relativeFilePath)) {
    if (/class="lang-switch\b/.test(html)) {
      errors.push(`${relativeFilePath}: still uses legacy language switch`);
    }
    if (!new RegExp(`styles\\.css\\?v=${latestAssetVersions.css}`).test(html)) {
      errors.push(`${relativeFilePath}: stale styles.css version`);
    }
    if (!new RegExp(`script\\.js\\?v=${latestAssetVersions.script}`).test(html)) {
      errors.push(`${relativeFilePath}: stale script.js version`);
    }
    return errors;
  }

  const lang = /<html\s+lang="([^"]+)"/i.exec(html)?.[1];
  if (!requiredLocales.includes(lang)) {
    errors.push(`${relativeFilePath}: missing or unsupported html lang`);
  }

  for (const locale of requiredLocales) {
    const href = alternates.get(locale);
    if (!href) {
      errors.push(`${relativeFilePath}: missing hreflang="${locale}"`);
      continue;
    }

    const localFile = urlToLocalFile(href);
    if (!(await fileExists(localFile))) {
      errors.push(`${relativeFilePath}: hreflang="${locale}" points to missing file ${href}`);
    }
  }

  if (!/<link\s+rel="canonical"\s+href="https:\/\/adshortsai\.com\/[^"]*"\s*\/?>/i.test(html)) {
    errors.push(`${relativeFilePath}: missing canonical`);
  }

  if (/class="lang-switch\b/.test(html)) {
    errors.push(`${relativeFilePath}: still uses legacy language switch`);
  }

  if (!/class="lang-switcher"/.test(html)) {
    errors.push(`${relativeFilePath}: missing globe language switcher`);
  }

  for (const locale of requiredLocales) {
    const shortLabel = locale.toUpperCase();
    if (!new RegExp(`aria-label="${shortLabel} `).test(html)) {
      errors.push(`${relativeFilePath}: missing ${shortLabel} option in language switcher`);
    }
  }

  if (!new RegExp(`styles\\.css\\?v=${latestAssetVersions.css}`).test(html)) {
    errors.push(`${relativeFilePath}: stale styles.css version`);
  }

  if (!new RegExp(`script\\.js\\?v=${latestAssetVersions.script}`).test(html)) {
    errors.push(`${relativeFilePath}: stale script.js version`);
  }

  return errors;
};

const main = async () => {
  const htmlFiles = await walkHtmlFiles(rootDir);
  const errors = [];

  for (const filePath of htmlFiles) {
    errors.push(...(await checkFile(filePath)));
  }

  if (errors.length > 0) {
    console.error(errors.join("\n"));
    process.exit(1);
  }

  console.log(`Static i18n check passed for ${htmlFiles.length} HTML files.`);
};

await main();
