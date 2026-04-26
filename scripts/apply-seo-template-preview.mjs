import { readdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const excludedDirs = new Set([".git", ".codex-tmp", "app", "logs", "node_modules", "tmp"]);
const excludedFiles = new Set(["index.html", "en/index.html", "404.html"]);

const labels = {
  ru: {
    home: "Главная",
    examples: "Примеры",
    pricing: "Тарифы",
    studio: "Студия",
    signin: "Войти",
    nav: "Главная навигация",
    menu: "Меню",
    ctaNote: "Откроется студия — ролик можно собрать за минуту и сразу протестировать правки.",
  },
  en: {
    home: "Home",
    examples: "Examples",
    pricing: "Pricing",
    studio: "Studio",
    signin: "Sign in",
    nav: "Main navigation",
    menu: "Menu",
    ctaNote: "Studio will open — build a video in a minute and instantly test edits.",
  },
};

const getLocale = (html) => (/^en/i.test(/<html\s+lang="([^"]+)"/i.exec(html)?.[1] ?? "") ? "en" : "ru");

const normalizePath = (relativeFilePath) => relativeFilePath.split(path.sep).join("/");

const getRootPrefix = (relativeFilePath) => {
  const depth = normalizePath(relativeFilePath).split("/").length - 1;
  return depth === 0 ? "./" : "../".repeat(depth);
};

const isLegalPage = (relativeFilePath) => /(?:^|\/)(privacy|terms|terms-of-use|data-deletion)(?:\/|\.html)/.test(normalizePath(relativeFilePath));

const shouldUpdateFile = (relativeFilePath, html) => {
  const normalized = normalizePath(relativeFilePath);
  if (excludedFiles.has(normalized)) return false;
  return /<header class="[^"]*\bheader\b[^"]*"/.test(html) && /<nav class="nav"/.test(html);
};

const localizedRoutes = (relativeFilePath, locale) => {
  const prefix = getRootPrefix(relativeFilePath);
  const localePrefix = locale === "en" ? `${prefix}en/` : prefix;

  return {
    home: localePrefix,
    examples: `${localePrefix}examples`,
    pricing: `${localePrefix}pricing`,
    studio: `${localePrefix}app/studio`,
  };
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

const removeClassToken = (html, tagName, token) =>
  html.replace(new RegExp(`<${tagName}([^>]*)\\sclass="([^"]*)"([^>]*)>`, "i"), (_match, before, className, after) => {
    const classes = className.split(/\s+/).filter((item) => item && item !== token);
    const classAttr = classes.length > 0 ? ` class="${classes.join(" ")}"` : "";
    return `<${tagName}${before}${classAttr}${after}>`;
  });

const setHeaderClass = (html) =>
  html.replace(/<header([^>]*)\sclass="([^"]*\bheader\b[^"]*)"([^>]*)>/i, (_match, before, className, after) => {
    const classes = className
      .split(/\s+/)
      .filter((item) => item && item !== "header--seo-v2" && item !== "header--app-static");
    classes.push("header--app-static");
    return `<header${before} class="${classes.join(" ")}"${after}>`;
  });

const extractLanguageSwitcher = (html) => {
  const match = /<details class="lang-switcher">[\s\S]*?<\/details>/.exec(html);
  return match?.[0] ?? "";
};

const renderNav = (html, relativeFilePath, locale) => {
  const text = labels[locale];
  const routes = localizedRoutes(relativeFilePath, locale);

  const navItems = [
    `<li><a class="nav__home-link" href="${routes.home}">${text.home}</a></li>`,
    `<li><a href="${routes.examples}">${text.examples}</a></li>`,
    `<li><a href="${routes.studio}">${text.studio}</a></li>`,
    `<li><a href="${routes.pricing}">${text.pricing}</a></li>`,
  ]
    .filter(Boolean)
    .join("\n            ");

  return html
    .replace(/<nav class="nav" aria-label="[^"]*">/, `<nav class="nav" aria-label="${text.nav}">`)
    .replace(/<button class="nav__toggle" aria-expanded="false" aria-controls="nav-menu">[\s\S]*?<\/button>/, `<button class="nav__toggle" aria-expanded="false" aria-controls="nav-menu">${text.menu}</button>`)
    .replace(/<ul id="nav-menu" class="nav__list">[\s\S]*?<\/ul>/, `<ul id="nav-menu" class="nav__list">\n            ${navItems}\n          </ul>`);
};

const renderHeaderActions = (html, relativeFilePath, locale) => {
  const text = labels[locale];
  const routes = localizedRoutes(relativeFilePath, locale);
  const languageSwitcher = extractLanguageSwitcher(html);
  const actionItems = [
    languageSwitcher,
    `<a class="header__signin-link" href="${routes.studio}">${text.signin}</a>`,
  ]
    .filter(Boolean)
    .join("\n          ");

  let next = html.replace(/\n\s*<div class="header__actions">[\s\S]*?<\/div>(?=\s*<\/div>\s*<\/header>)/, "");
  return next.replace(/(\s*)<\/nav>\s*<\/div>\s*<\/header>/, `$1</nav>\n        <div class="header__actions">\n          ${actionItems}\n        </div>\n      </div>\n    </header>`);
};

const updateLogoHref = (html, relativeFilePath, locale) => {
  const routes = localizedRoutes(relativeFilePath, locale);
  return html.replace(/<a class="logo" href="[^"]*" aria-label="AdShorts AI">/, `<a class="logo" href="${routes.home}" aria-label="AdShorts AI">`);
};

const restoreArticleLayout = (html, relativeFilePath) => {
  let next = html
    .replace(/<main class="seo-main-v2">/g, "<main>")
    .replace(/<section class="section seo-article-section">/g, '<section class="section">')
    .replace(/\s*<div class="seo-article-kicker">[\s\S]*?<\/div>\n/g, "\n");

  if (isLegalPage(relativeFilePath)) {
    next = next.replace(/<article class="container article seo-article-v2">/, '<div class="container" style="max-width: 800px;">');
  } else {
    next = next.replace(/<article class="container article seo-article-v2">/, '<div class="container article">');
  }

  next = next.replace(/(\s*)<\/article>\s*<\/section>\s*<\/main>/, `$1</div>\n      </section>\n    </main>`);
  return next;
};

const removeClassFromAttributes = (html, classToken) =>
  html.replace(/class="([^"]*)"/g, (_match, className) => {
    const classes = className.split(/\s+/).filter((item) => item && item !== classToken);
    return `class="${classes.join(" ")}"`;
  });

const updateStudioCtas = (html, relativeFilePath, locale) => {
  const routes = localizedRoutes(relativeFilePath, locale);
  let next = html
    .replace(/\s+data-tg-domain="AdShortsAIBot"/g, "")
    .replace(/\s+data-tg-start="[^"]*"/g, "")
    .replace(/\s+target="_blank"/g, "")
    .replace(/\s+rel="noopener"/g, "")
    .replace(/href="https:\/\/t\.me\/AdShortsAIBot"/g, `href="${routes.studio}"`);

  next = removeClassFromAttributes(next, "tg-smart");

  return next
    .replace(/Откроется Telegram-бот — ролик можно собрать за минуту и сразу протестировать правки\./g, labels.ru.ctaNote)
    .replace(/Telegram bot will open — build a video in a minute and instantly test edits\./g, labels.en.ctaNote)
    .replace(/В Telegram-боте AdShorts AI/g, "В студии AdShorts AI")
    .replace(/In the AdShorts AI Telegram bot/g, "In AdShorts AI Studio");
};

const applyStaticSeoHeader = (html, relativeFilePath) => {
  const locale = getLocale(html);
  let next = html;
  next = removeClassToken(next, "body", "seo-template-page");
  next = removeClassToken(next, "footer", "footer--seo-v2");
  next = setHeaderClass(next);
  next = updateLogoHref(next, relativeFilePath, locale);
  next = renderHeaderActions(next, relativeFilePath, locale);
  next = renderNav(next, relativeFilePath, locale);
  next = restoreArticleLayout(next, relativeFilePath);
  next = updateStudioCtas(next, relativeFilePath, locale);
  return next;
};

const main = async () => {
  const htmlFiles = await walkHtmlFiles(rootDir);
  const changed = [];

  for (const filePath of htmlFiles) {
    const relativeFilePath = path.relative(rootDir, filePath);
    const current = await readFile(filePath, "utf8");
    if (!shouldUpdateFile(relativeFilePath, current)) continue;

    const next = applyStaticSeoHeader(current, relativeFilePath);

    if (next !== current) {
      await writeFile(filePath, next);
      changed.push(normalizePath(relativeFilePath));
    }
  }

  console.log(changed.length ? `Updated static SEO/legal header on ${changed.length} files.` : "Static SEO/legal header is already up to date.");
};

await main();
