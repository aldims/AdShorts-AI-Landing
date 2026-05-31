#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const siteOrigin = "https://adshortsai.com";
const lastmod = "2026-05-31";
const cssVersion = 55;
const scriptVersion = 8;
const supportEmail = "support@adshortsai.com";
const logoUrl = `${siteOrigin}/logo.png?v=2`;

const resolveAppCssHref = async () => {
  if (process.env.ADSHORTS_APP_CSS_HREF) {
    return process.env.ADSHORTS_APP_CSS_HREF;
  }

  try {
    const appIndexHtml = await readFile(path.join(rootDir, "app/dist/index.html"), "utf8");
    return /href="(\/assets\/index-[^"]+\.css)"/.exec(appIndexHtml)?.[1] ?? "";
  } catch {
    return "";
  }
};

const appCssHref = await resolveAppCssHref();

const escapeHtml = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

const escapeRegExp = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const renderJsonLd = (data) => JSON.stringify(data, null, 2).replace(/^/gm, "    ");

const pages = [
  {
    locale: "ru",
    lang: "ru",
    dir: "contacts",
    assetPrefix: "../",
    canonical: `${siteOrigin}/contacts/`,
    alternateRu: `${siteOrigin}/contacts/`,
    alternateEn: `${siteOrigin}/en/contact/`,
    title: "Контакты — AdShorts AI",
    description: "Контакты поддержки AdShorts AI: email для связи с командой сервиса.",
    ogTitle: "Контакты AdShorts AI",
    ogDescription: "Email поддержки AdShorts AI для связи с командой сервиса.",
    langHref: "../en/contact/",
    langLabel: "English",
    navLabel: "Основная навигация",
    nav: {
      home: "Главная",
      examples: "Примеры",
      studio: "Студия",
      pricing: "Тарифы",
      contacts: "Контакты",
      menu: "Меню",
      signIn: "Войти",
      currentLang: "Язык: Русский",
      langAria: "Выбор языка",
    },
    links: {
      home: "../",
      examples: "../examples/",
      pricing: "../pricing/",
      studio: "../app/studio?source=contacts_ru",
      privacy: "../privacy/",
      terms: "../terms/",
      termsOfUse: "../terms-of-use/",
      offer: "../offer/",
    },
    eyebrow: "Контакты",
    h1: "Контакты",
    lead: "Связь с поддержкой.",
    mailCta: "Написать в поддержку",
    studioCta: "Открыть студию",
    footerContact: "Контакты:",
  },
  {
    locale: "en",
    lang: "en",
    dir: "en/contact",
    assetPrefix: "../../",
    canonical: `${siteOrigin}/en/contact/`,
    alternateRu: `${siteOrigin}/contacts/`,
    alternateEn: `${siteOrigin}/en/contact/`,
    title: "Contact — AdShorts AI",
    description: "AdShorts AI support contact: email for contacting the service team.",
    ogTitle: "Contact AdShorts AI",
    ogDescription: "AdShorts AI support email for contacting the service team.",
    langHref: "../../contacts/",
    langLabel: "Русский",
    navLabel: "Primary navigation",
    nav: {
      home: "Home",
      examples: "Examples",
      studio: "Studio",
      pricing: "Pricing",
      contacts: "Contact",
      menu: "Menu",
      signIn: "Sign in",
      currentLang: "Language: English",
      langAria: "Language selection",
    },
    links: {
      home: "../../en/",
      examples: "../../en/examples/",
      pricing: "../../en/pricing/",
      studio: "../../en/app/studio?source=contact_en",
      privacy: "../../en/privacy/",
      terms: "../../en/terms/",
      termsOfUse: "../../en/terms-of-use/",
      offer: "../../offer/",
    },
    eyebrow: "Contact",
    h1: "Contact",
    lead: "Contact support.",
    mailCta: "Email support",
    studioCta: "Open studio",
    footerContact: "Contact:",
  },
];

const renderLanguageSwitcher = (page) => {
  const currentCode = page.locale === "ru" ? "RU" : "EN";
  const otherCode = page.locale === "ru" ? "EN" : "RU";
  const currentName = page.locale === "ru" ? "Русский" : "English";
  const otherName = page.locale === "ru" ? "English" : "Русский";

  return `<details class="lang-switcher"><summary class="lang-switcher__trigger" aria-label="${escapeHtml(page.nav.currentLang)}" title="${escapeHtml(page.nav.currentLang)}"><svg class="lang-switcher__icon" width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.8"/><path d="M3 12h18M12 3c2.2 2.35 3.4 5.35 3.4 9s-1.2 6.65-3.4 9M12 3c-2.2 2.35-3.4 5.35-3.4 9s1.2 6.65 3.4 9" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg><span>${currentCode}</span></summary><div class="lang-switcher__menu" role="menu" aria-label="${escapeHtml(page.nav.langAria)}"><a class="lang-switcher__option is-active" href="./" role="menuitem" aria-label="${currentCode} ${escapeHtml(currentName)}" aria-current="page"><span class="lang-switcher__code">${currentCode}</span><span class="lang-switcher__label">${escapeHtml(currentName)}</span></a><a class="lang-switcher__option" href="${escapeHtml(page.langHref)}" role="menuitem" aria-label="${otherCode} ${escapeHtml(otherName)}"><span class="lang-switcher__code">${otherCode}</span><span class="lang-switcher__label">${escapeHtml(otherName)}</span></a></div></details>`;
};

const renderStructuredData = (page) => [
  {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "AdShorts AI",
    url: siteOrigin,
    logo: logoUrl,
    areaServed: ["RU", "Worldwide"],
    contactPoint: {
      "@type": "ContactPoint",
      email: supportEmail,
      contactType: "customer support",
      availableLanguage: ["ru", "en"],
    },
  },
  {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: page.h1,
    url: page.canonical,
    inLanguage: page.lang,
    isPartOf: {
      "@type": "WebSite",
      name: "AdShorts AI",
      url: siteOrigin,
    },
    dateModified: lastmod,
  },
  {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: page.nav.home,
        item: page.locale === "ru" ? `${siteOrigin}/` : `${siteOrigin}/en/`,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: page.nav.contacts,
        item: page.canonical,
      },
    ],
  },
];

const renderHead = (page) => `  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="index, follow" />
    <link rel="canonical" href="${escapeHtml(page.canonical)}" />
    <link rel="alternate" hreflang="ru" href="${escapeHtml(page.alternateRu)}" />
    <link rel="alternate" hreflang="en" href="${escapeHtml(page.alternateEn)}" />
    <link rel="alternate" hreflang="x-default" href="${escapeHtml(page.alternateRu)}" />
    <title>${escapeHtml(page.title)}</title>
    <meta name="description" content="${escapeHtml(page.description)}" />
    <meta property="og:type" content="website" />
    <meta property="og:url" content="${escapeHtml(page.canonical)}" />
    <meta property="og:title" content="${escapeHtml(page.ogTitle)}" />
    <meta property="og:description" content="${escapeHtml(page.ogDescription)}" />
    <meta property="og:image" content="${logoUrl}" />
    <meta property="og:site_name" content="AdShorts AI" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(page.ogTitle)}" />
    <meta name="twitter:description" content="${escapeHtml(page.ogDescription)}" />
    <meta name="twitter:image" content="${logoUrl}" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=Sora:wght@600;700;800&display=swap" rel="stylesheet" />
    <link rel="stylesheet" href="${page.assetPrefix}styles.css?v=${cssVersion}" />
${appCssHref ? `    <link rel="stylesheet" href="${escapeHtml(appCssHref)}" />\n` : ""}    <link rel="preload" as="image" href="/background/bg.webp" type="image/webp" fetchpriority="high" />
    <link rel="preload" as="image" href="${page.assetPrefix}logo.png?v=2" />
    <link rel="icon" type="image/png" sizes="120x120" href="${page.assetPrefix}favicon.png" />
    <link rel="icon" type="image/png" sizes="32x32" href="${page.assetPrefix}favicon-32.png" />
    <link rel="icon" type="image/svg+xml" href="${page.assetPrefix}favicon.svg" />
    <link rel="shortcut icon" type="image/x-icon" href="${page.assetPrefix}favicon.ico" />
    <style>${renderInlineStyles()}</style>
    <script defer src="${page.assetPrefix}script.js?v=${scriptVersion}"></script>
    <script type="application/ld+json">
${renderJsonLd(renderStructuredData(page))}
    </script>
  </head>`;

const renderInlineStyles = () => `
      :root {
        --surface-0: #05060a;
        --contact-line: rgba(255, 255, 255, 0.1);
        --contact-muted: rgba(200, 210, 240, 0.64);
        --cta-premium-ink: #2b1900;
        --cta-premium-top: #fff7d6;
        --cta-premium-mid: #ffd766;
        --cta-premium-base: #f6b82d;
        --cta-premium-deep: #b86b00;
      }
      html, body { background: var(--surface-0); color: #fff; font-family: Manrope, system-ui, -apple-system, "system-ui", sans-serif; }
      body { min-width: 0; }
      .contact-route { min-height: 100vh; background: var(--surface-0); color: #fff; overflow: hidden; }
      .contact-route a { text-decoration: none; }
      .contact-route .container { width: min(1180px, calc(100% - 40px)); margin-inline: auto; }
      .contact-route .site-header { position: fixed; top: 0; left: 0; right: 0; z-index: 40; background: transparent; }
      .contact-route .site-header::before { content: ""; position: absolute; inset: 0; background: linear-gradient(180deg, rgba(7, 9, 12, .34), rgba(7, 9, 12, .16) 54%, rgba(7, 9, 12, 0)); pointer-events: none; }
      .contact-route .site-header::after { content: ""; position: absolute; inset: auto 0 0; height: 1px; background: linear-gradient(90deg, transparent, rgba(255,255,255,.08), transparent); opacity: .42; pointer-events: none; }
      .contact-route .site-header__inner { position: relative; z-index: 1; display: grid; grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr); align-items: center; gap: 20px; min-height: 88px; width: calc(100% - 32px); margin-inline: auto; }
      .contact-route .brand { display: inline-flex; align-items: center; gap: 12px; min-width: max-content; justify-self: start; transform: translateX(22px); color: #fff; font-family: Sora, Manrope, sans-serif; font-size: 1.12rem; font-weight: 700; letter-spacing: -0.04em; }
      .contact-route .brand img { width: 44px; height: 44px; border-radius: 14px; box-shadow: 0 16px 30px rgba(95, 102, 246, .18); }
      .contact-route .site-nav { display: flex; align-items: center; justify-content: center; justify-self: center; width: fit-content; max-width: 100%; gap: 6px; padding: 6px; border: 1px solid rgba(255,255,255,.12); border-radius: 999px; background: rgba(12,14,18,.62); box-shadow: inset 0 1px 0 rgba(255,255,255,.08), 0 18px 36px rgba(0,0,0,.24); }
      .contact-route .site-nav__compact-toggle { display: none; }
      .contact-route .site-nav__content { display: flex; align-items: center; justify-content: center; gap: 6px; min-width: 0; max-width: 100%; }
      .contact-route .site-nav__item { display: inline-flex; align-items: center; justify-content: center; min-height: 42px; padding: 0 20px; border-radius: 999px; border: 1px solid transparent; color: rgba(255,255,255,.68); font-size: .95rem; font-weight: 700; white-space: nowrap; transition: color .2s ease, background .2s ease, transform .16s ease; }
      .contact-route .site-nav__item:hover { color: #fff; background: rgba(255,255,255,.04); transform: translateY(-1px); }
      .contact-route .site-nav__item--active { color: #fff; background: linear-gradient(180deg, rgba(255,255,255,.075), rgba(255,255,255,.024)), rgba(255,255,255,.018); border-color: rgba(255,255,255,.1); box-shadow: inset 0 1px 0 rgba(255,255,255,.13), 0 8px 20px rgba(4,8,18,.14); }
      .contact-route .site-header__actions { justify-self: end; display: inline-flex; align-items: center; gap: 14px; transform: translateX(-22px); }
      .contact-route .site-header__signin { color: rgba(255,255,255,.72); font-size: .96rem; font-weight: 700; }
      .contact-route .site-header__signin:hover { color: #fff; }
      .contact-route .lang-switcher { position: relative; }
      .contact-route .lang-switcher__trigger { display: inline-flex; align-items: center; gap: 8px; min-height: 42px; padding: 0 14px; border: 1px solid rgba(255,255,255,.12); border-radius: 999px; background: rgba(12,14,18,.62); color: rgba(255,255,255,.78); font-weight: 800; cursor: pointer; list-style: none; }
      .contact-route .lang-switcher__trigger::-webkit-details-marker { display: none; }
      .contact-route .lang-switcher__menu { position: absolute; right: 0; top: calc(100% + 10px); display: grid; gap: 6px; min-width: 150px; padding: 8px; border: 1px solid rgba(255,255,255,.12); border-radius: 16px; background: rgba(12,14,18,.94); box-shadow: 0 18px 36px rgba(0,0,0,.28); }
      .contact-route .lang-switcher:not([open]) .lang-switcher__menu { display: none; }
      .contact-route .lang-switcher__option { display: flex; align-items: center; gap: 10px; min-height: 34px; padding: 0 10px; border-radius: 10px; color: rgba(255,255,255,.72); font-weight: 700; }
      .contact-route .lang-switcher__option:hover, .contact-route .lang-switcher__option.is-active { color: #fff; background: rgba(255,255,255,.06); }
      .contact-route .hero { position: relative; isolation: isolate; display: block; min-height: 100svh; padding: 154px 0 0; overflow: hidden; background: var(--surface-0); color: #fff; }
      .contact-route .hero__layered-background, .contact-route .hero__layered-background-media, .contact-route .hero__layered-background-media img { position: absolute; inset: 0; width: 100%; height: 100%; }
      .contact-route .hero__layered-background { z-index: 0; opacity: .92; }
      .contact-route .hero__layered-background-media img { object-fit: cover; object-position: center top; filter: brightness(.72) contrast(1.06) saturate(1.04); }
      .contact-route .hero::before { content: ""; position: absolute; inset: 0; z-index: 1; background: linear-gradient(180deg, rgba(4,6,12,.72), rgba(4,6,12,.34) 32%, rgba(4,6,12,.42) 58%, rgba(4,6,12,.96)), linear-gradient(90deg, rgba(4,6,12,.78), rgba(4,6,12,.38) 25%, rgba(4,6,12,.16) 50%, rgba(4,6,12,.58)); pointer-events: none; }
      .contact-route .hero::after { content: ""; position: absolute; inset: auto 0 0; z-index: 1; height: 360px; background: linear-gradient(180deg, rgba(5,6,10,0), rgba(5,6,10,.66) 54%, var(--surface-0)); pointer-events: none; }
      .contact-route .hero__scene { position: absolute; inset: -10% -8% 0; z-index: 1; pointer-events: none; opacity: .42; }
      .contact-route .hero__scene-stars { position: absolute; inset: 0; background: radial-gradient(circle at 5% 12%, rgba(255,255,255,1) 0 1.5px, transparent 2px), radial-gradient(circle at 25% 78%, rgba(167,139,250,.9) 0 1.2px, transparent 2px), radial-gradient(circle at 45% 55%, rgba(96,165,250,.85) 0 1.3px, transparent 2px), radial-gradient(circle at 65% 38%, rgba(244,114,182,.8) 0 1px, transparent 1.8px), radial-gradient(circle at 85% 18%, rgba(129,140,248,.9) 0 1.4px, transparent 2px), radial-gradient(circle at 92% 58%, rgba(255,255,255,.85) 0 1px, transparent 1.5px); opacity: .7; }
      .contact-route .hero__grid { position: relative; z-index: 2; display: flex; flex-direction: column; align-items: center; min-height: min(82vh, 780px); padding-bottom: 140px; }
      .contact-route .hero__copy { position: relative; z-index: 3; width: 100%; max-width: 860px; text-align: center; padding-top: 20px; }
      .contact-route .hero__copy::before { content: ""; position: absolute; inset: -72px -96px -56px; z-index: -1; background: radial-gradient(ellipse 58% 52% at 50% 46%, rgba(3,6,12,.5), rgba(3,6,12,.28) 42%, rgba(3,6,12,0) 72%); filter: blur(18px); pointer-events: none; }
      .contact-route .hero h1 { width: 100%; margin: 0 auto; font-family: Sora, Manrope, sans-serif; font-size: clamp(3rem, 5.2vw, 5.1rem); line-height: 1; letter-spacing: -0.065em; text-align: center; }
      .contact-route .hero__title-line1, .contact-route .hero__title-line2 { display: block; text-align: center; white-space: nowrap; }
      .contact-route .hero__title-line2 { margin-top: .12em; color: #fff; font-size: clamp(2.25rem, 3.8vw, 4rem); line-height: 1.06; letter-spacing: -0.055em; text-shadow: 0 2px 22px rgba(0,0,0,.78); }
      .contact-route .hero__title-highlight { background: linear-gradient(110deg, #a78bfa, #818cf8 22%, #38bdf8 44%, #c084fc 66%, #f472b6 88%, #a78bfa); background-size: 300% 100%; -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
      .contact-route .hero__lead { max-width: 540px; margin: 32px auto 0; color: rgba(236,242,255,.78); font-size: clamp(1.05rem, 1.7vw, 1.2rem); line-height: 1.7; text-shadow: 0 2px 22px rgba(0,0,0,.78); }
      .contact-email-link {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        max-width: 100%;
        margin: 24px auto 0;
        color: #fff;
        font-family: Sora, Manrope, sans-serif;
        font-size: clamp(1.45rem, 3vw, 2.35rem);
        font-weight: 700;
        letter-spacing: -0.04em;
        text-decoration: underline;
        text-decoration-color: rgba(56, 189, 248, .55);
        text-decoration-thickness: 2px;
        text-underline-offset: .22em;
        text-shadow: 0 2px 22px rgba(0, 0, 0, .7);
        overflow-wrap: anywhere;
      }
      .contact-email-link:hover { color: #f8fbff; text-decoration-color: #38bdf8; }
      .contact-route .hero__actions { display: flex; flex-wrap: wrap; justify-content: center; gap: 14px; margin-top: 36px; }
      .contact-route .btn { display: inline-flex; align-items: center; justify-content: center; gap: 10px; min-height: 48px; padding: 0 22px; border: 0; border-radius: 14px; font-family: Manrope, system-ui, sans-serif; font-weight: 800; cursor: pointer; }
      .contact-route .btn--premium-cta { position: relative; isolation: isolate; min-height: 62px; min-width: min(100%, 300px); padding: 0 30px; border: 1px solid rgba(255,245,214,.72); border-radius: 20px; font-family: Sora, Manrope, sans-serif; font-size: .98rem; font-weight: 700; color: var(--cta-premium-ink); background: linear-gradient(140deg, var(--cta-premium-top), #fff5ce 14%, var(--cta-premium-mid) 40%, var(--cta-premium-base) 70%, var(--cta-premium-deep)); box-shadow: inset 0 1px 0 rgba(255,255,255,.82), inset 0 -14px 24px rgba(114,73,0,.18), 0 28px 56px rgba(194,138,16,.28); overflow: hidden; }
      .contact-route .btn--premium-cta:hover { transform: translateY(-3px) scale(1.015); box-shadow: inset 0 1px 0 rgba(255,255,255,.9), inset 0 -16px 26px rgba(114,73,0,.22), 0 36px 68px rgba(204,149,21,.36); }
      .contact-route .btn--ghost-light { min-height: 62px; padding: 0 28px; border: 1px solid rgba(255,255,255,.14); border-radius: 20px; color: rgba(255,255,255,.86); background: rgba(255,255,255,.06); box-shadow: inset 0 1px 0 rgba(255,255,255,.08); }
      .contact-route .btn--ghost-light:hover { color: #fff; border-color: rgba(255,255,255,.26); background: rgba(255,255,255,.1); transform: translateY(-2px); }
      .contact-footer { padding: 36px 0 44px; border-top: 1px solid rgba(255,255,255,.08); background: var(--surface-0); }
      .contact-footer__inner { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 18px; }
      .contact-footer .brand { transform: none; }
      .contact-footer__links { display: flex; flex-wrap: wrap; gap: 14px; color: rgba(255,255,255,.54); font-size: .92rem; }
      .contact-footer__links a { color: rgba(255,255,255,.62); }
      .contact-footer__links a:hover { color: #fff; }
      @media (max-width: 980px) {
        .contact-route .site-header__inner { display: grid; width: calc(100% - 28px); grid-template-columns: 1fr; justify-items: center; gap: 12px; padding: 14px 0; }
        .contact-route .brand, .contact-route .site-header__actions { transform: none; justify-self: center; }
        .contact-route .site-nav__content { overflow-x: auto; max-width: calc(100vw - 40px); padding-bottom: 2px; }
        .contact-route .hero { padding-top: 210px; }
      }
      @media (max-width: 720px) {
        .contact-route .site-nav { width: min(100%, calc(100vw - 32px)); overflow: hidden; }
        .contact-route .site-nav__item { min-height: 38px; padding: 0 14px; font-size: .86rem; }
        .contact-route .site-header__signin { display: none; }
        .contact-route .hero { padding-top: 188px; }
        .contact-route .hero__grid { min-height: 0; padding-bottom: 126px; }
        .contact-route .hero h1 { font-size: clamp(2.45rem, 12vw, 3.5rem); letter-spacing: -0.055em; }
        .contact-route .hero__title-line1, .contact-route .hero__title-line2 { white-space: normal; }
        .contact-email-link { width: 100%; font-size: clamp(1.28rem, 7vw, 1.8rem); }
        .contact-route .hero__actions .btn { width: 100%; }
        .contact-footer__inner { align-items: flex-start; flex-direction: column; }
      }
`;

const renderHeader = (page) => `      <header class="site-header" id="top">
        <div class="container site-header__inner">
        <a class="brand" href="${page.links.home}" aria-label="AdShorts AI">
          <img src="${page.assetPrefix}logo.png?v=2" alt="" width="44" height="44" />
          <span>AdShorts AI</span>
        </a>
        <nav class="site-nav" aria-label="${escapeHtml(page.navLabel)}">
          <button class="site-nav__compact-toggle route-button" type="button" aria-controls="contact-nav-menu" aria-expanded="false"><span>${escapeHtml(page.nav.contacts)}</span></button>
          <div id="contact-nav-menu" class="site-nav__content">
            <a class="site-nav__item" href="${page.links.home}">${escapeHtml(page.nav.home)}</a>
            <a class="site-nav__item" href="${page.links.examples}">${escapeHtml(page.nav.examples)}</a>
            <a class="site-nav__item" href="${page.links.studio}">${escapeHtml(page.nav.studio)}</a>
            <a class="site-nav__item" href="${page.links.pricing}">${escapeHtml(page.nav.pricing)}</a>
            <a class="site-nav__item site-nav__item--active" href="./" aria-current="page">${escapeHtml(page.nav.contacts)}</a>
          </div>
        </nav>
        <div class="site-header__actions">
          ${renderLanguageSwitcher(page)}
          <a class="site-header__signin route-button" href="${page.links.studio}">${escapeHtml(page.nav.signIn)}</a>
        </div>
      </div>
    </header>`;

const renderPage = (page) => `<!doctype html>
<html lang="${page.lang}">
${renderHead(page)}
  <body>
    <div class="route-page route-page--layered-hero contact-route">
${renderHeader(page)}
      <main id="top">
        <section class="hero">
          <div class="hero__layered-background" aria-hidden="true">
            <picture class="hero__layered-background-media">
              <source srcset="${page.assetPrefix}background/bg.webp" type="image/webp" />
              <img alt="" decoding="async" fetchpriority="high" loading="eager" src="${page.assetPrefix}background/bg.png" />
            </picture>
          </div>
          <div class="hero__scene" aria-hidden="true">
            <span class="hero__scene-stars"></span>
            <span class="hero__scene-glow hero__scene-glow--left"></span>
            <span class="hero__scene-glow hero__scene-glow--center"></span>
            <span class="hero__scene-glow hero__scene-glow--right"></span>
            <span class="hero__scene-orbit hero__scene-orbit--one"></span>
            <span class="hero__scene-orbit hero__scene-orbit--two"></span>
            <span class="hero__scene-beam"></span>
          </div>
          <div class="container hero__grid">
            <div class="hero__copy">
              <h1 aria-label="${escapeHtml(page.h1)} AdShorts AI">
                <span class="hero__title-line1"><span class="hero__title-highlight">${escapeHtml(page.h1)}</span></span>
                <span class="hero__title-line2">AdShorts AI</span>
              </h1>
              <p class="hero__lead">${escapeHtml(page.lead)}</p>
              <a class="contact-email-link" href="mailto:${supportEmail}">${supportEmail}</a>
              <div class="hero__actions">
                <a class="btn btn--primary btn--hero btn--premium-cta route-button" href="mailto:${supportEmail}">
                  <span class="btn--premium-cta__label">${escapeHtml(page.mailCta)}</span>
                </a>
                <a class="btn btn--ghost-light route-button" href="${page.links.studio}">${escapeHtml(page.studioCta)}</a>
              </div>
            </div>
          </div>
        </section>
    </main>
    <footer class="contact-footer">
      <div class="container contact-footer__inner">
        <a class="brand" href="${page.links.home}">
          <img src="${page.assetPrefix}logo.png?v=2" alt="" width="44" height="44" />
          <span>AdShorts AI</span>
        </a>
        <div class="contact-footer__links">
          <span style="color: var(--muted);">${escapeHtml(page.footerContact)} <a href="mailto:${supportEmail}" style="color: var(--muted);">${supportEmail}</a></span>
          <a href="${page.links.privacy}">${page.locale === "ru" ? "Политика конфиденциальности" : "Privacy Policy"}</a>
          <a href="${page.links.terms}">${page.locale === "ru" ? "Пользовательское соглашение" : "User Agreement"}</a>
          <a href="${escapeHtml(page.langHref)}" rel="alternate" hreflang="${page.locale === "ru" ? "en" : "ru"}">${escapeHtml(page.langLabel)}</a>
          <span style="color: var(--muted);">© <span id="year"></span> AdShorts AI</span>
        </div>
      </div>
    </footer>
    </div>
  </body>
</html>
`;

const renderSitemapBlock = () => `  <url>
    <loc>${siteOrigin}/contacts/</loc>
    <xhtml:link rel="alternate" hreflang="ru" href="${siteOrigin}/contacts/" />
    <xhtml:link rel="alternate" hreflang="en" href="${siteOrigin}/en/contact/" />
    <xhtml:link rel="alternate" hreflang="x-default" href="${siteOrigin}/contacts/" />
    <lastmod>${lastmod}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.62</priority>
  </url>
  <url>
    <loc>${siteOrigin}/en/contact/</loc>
    <xhtml:link rel="alternate" hreflang="ru" href="${siteOrigin}/contacts/" />
    <xhtml:link rel="alternate" hreflang="en" href="${siteOrigin}/en/contact/" />
    <xhtml:link rel="alternate" hreflang="x-default" href="${siteOrigin}/contacts/" />
    <lastmod>${lastmod}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.56</priority>
  </url>
`;

const upsertSitemap = async () => {
  const sitemapPath = path.join(rootDir, "sitemap.xml");
  let sitemap = await readFile(sitemapPath, "utf8");

  for (const url of [`${siteOrigin}/contacts/`, `${siteOrigin}/en/contact/`]) {
    sitemap = sitemap.replace(new RegExp(`\\s*<url>\\s*<loc>${escapeRegExp(url)}<\\/loc>[\\s\\S]*?<\\/url>`, "g"), "");
  }

  if (!sitemap.includes("</urlset>")) {
    throw new Error("sitemap.xml is missing </urlset>.");
  }

  sitemap = sitemap.replace(/\n<\/urlset>\s*$/, `\n${renderSitemapBlock()}</urlset>\n`);
  await writeFile(sitemapPath, sitemap, "utf8");
};

for (const page of pages) {
  const dir = path.join(rootDir, page.dir);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, "index.html"), renderPage(page), "utf8");
  console.log(`Generated ${page.dir}/index.html`);
}

await upsertSitemap();
console.log("Updated sitemap.xml with contact pages.");
