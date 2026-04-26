#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { staticLandingContent as content } from "../static-landing.content.mjs";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const supportedLocalesPath = path.join(rootDir, "app/shared/locales.ts");
const shouldCheck = process.argv.includes("--check");

const htmlEscapeMap = new Map([
  ["&", "&amp;"],
  ["<", "&lt;"],
  [">", "&gt;"],
  ['"', "&quot;"],
]);

const escapeHtml = (value) => String(value).replace(/[&<>"]/g, (char) => htmlEscapeMap.get(char) ?? char);

const escapeAttr = escapeHtml;

const isRecord = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);

const readSupportedLocales = async () => {
  const source = await readFile(supportedLocalesPath, "utf8");
  const match = source.match(/SUPPORTED_LOCALES\s*=\s*\[([^\]]+)]/s);
  if (!match) {
    throw new Error("Could not read SUPPORTED_LOCALES from app/shared/locales.ts");
  }

  const locales = Array.from(match[1].matchAll(/"([^"]+)"/g), ([, locale]) => locale);
  if (locales.length === 0) {
    throw new Error("SUPPORTED_LOCALES is empty.");
  }

  return locales;
};

const isLocalizedLeaf = (value, supportedLocales) => {
  if (!isRecord(value)) return false;
  const keys = Object.keys(value);
  return keys.length === supportedLocales.length && supportedLocales.every((locale) => keys.includes(locale));
};

const validateLocalizedFields = (value, supportedLocales, label = "content") => {
  if (Array.isArray(value)) {
    value.forEach((item, index) => validateLocalizedFields(item, supportedLocales, `${label}[${index}]`));
    return;
  }

  if (!isRecord(value)) return;

  const keys = Object.keys(value);
  const localeKeys = keys.filter((key) => supportedLocales.includes(key));
  if (localeKeys.length > 0) {
    const missing = supportedLocales.filter((locale) => !keys.includes(locale));
    if (missing.length > 0) {
      throw new Error(`${label} is missing translations for: ${missing.join(", ")}`);
    }

    if (isLocalizedLeaf(value, supportedLocales)) return;
  }

  for (const [key, child] of Object.entries(value)) {
    validateLocalizedFields(child, supportedLocales, `${label}.${key}`);
  }
};

const localize = (value, locale, supportedLocales, label) => {
  if (!isLocalizedLeaf(value, supportedLocales)) {
    throw new Error(`${label} must define exactly these locale keys: ${supportedLocales.join(", ")}`);
  }

  return value[locale];
};

const text = (value, locale, supportedLocales, label) => {
  const localized = localize(value, locale, supportedLocales, label);
  return localized === null || typeof localized === "undefined" ? null : escapeHtml(localized);
};

const rawLocalized = (value, locale, supportedLocales, label) => {
  const localized = localize(value, locale, supportedLocales, label);
  return localized === null || typeof localized === "undefined" ? null : String(localized);
};

const asset = (localeConfig, assetPath) => `${localeConfig.assetPrefix}${assetPath}`;

const renderJsonLd = (data) => JSON.stringify(data, null, 2).replace(/^/gm, "    ");

const renderSoundButton = (label) => `                <button class="video-sound-btn muted" aria-label="${label}" title="${label}">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <!-- Sound on icon - modern speaker with waves -->
                    <g class="sound-on">
                      <path d="M11 5L6 9H2v6h4l5 4V5z"/>
                      <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
                      <path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
                    </g>
                    <!-- Sound off icon - speaker with X -->
                    <g class="sound-off">
                      <path d="M11 5L6 9H2v6h4l5 4V5z"/>
                      <line x1="23" y1="9" x2="17" y2="15"/>
                      <line x1="17" y1="9" x2="23" y2="15"/>
                    </g>
                  </svg>
                </button>`;

const renderStaticLanguageSelector = (locale, supportedLocales) => {
  const languageLabel = locale === "en" ? "Language selection" : "Выбор языка";
  const currentLabel = locale === "en" ? "English" : "Русский";
  const triggerLabel = locale === "en" ? `Language: ${currentLabel}` : `Язык: ${currentLabel}`;
  const getHref = (targetLocale) => {
    if (targetLocale === locale) return "./";
    if (locale === "ru") return `./${targetLocale}/`;
    if (targetLocale === "ru") return "../";
    return `../${targetLocale}/`;
  };

  const options = supportedLocales
    .map((targetLocale) => {
      const isActive = targetLocale === locale;
      const shortLabel = targetLocale.toUpperCase();
      const label = targetLocale === "en" ? "English" : "Русский";

      return `<a class="lang-switcher__option${isActive ? " is-active" : ""}" href="${getHref(targetLocale)}" role="menuitem" aria-label="${shortLabel} ${label}"${isActive ? ' aria-current="page"' : ""}><span class="lang-switcher__code">${shortLabel}</span><span class="lang-switcher__label">${label}</span></a>`;
    })
    .join("");

  return `<details class="lang-switcher"><summary class="lang-switcher__trigger" aria-label="${triggerLabel}" title="${triggerLabel}"><svg class="lang-switcher__icon" width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.8"/><path d="M3 12h18M12 3c2.2 2.35 3.4 5.35 3.4 9s-1.2 6.65-3.4 9M12 3c-2.2 2.35-3.4 5.35-3.4 9s1.2 6.65 3.4 9" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg><span>${locale.toUpperCase()}</span></summary><div class="lang-switcher__menu" role="menu" aria-label="${languageLabel}">${options}</div></details>`;
};

const renderHead = (locale, localeConfig) => {
  const verificationTags = locale === "ru"
    ? content.yandexVerification
        .map((token) => `    <meta name="yandex-verification" content="${escapeAttr(token)}" />`)
        .join("\n")
    : "";
  const verificationBlock = verificationTags ? `${verificationTags}\n` : "";
  const alternates = Object.entries(content.alternates)
    .map(([hreflang, href]) => `    <link rel="alternate" hreflang="${escapeAttr(hreflang)}" href="${escapeAttr(href)}" />`)
    .join("\n");
  const icon = content.assets.favicon;
  const logoUrl = "https://adshortsai.com/logo.png?v=2";
  const softwareApplication = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "AdShorts AI",
    url: localeConfig.softwareUrl,
    image: logoUrl,
    logo: logoUrl,
    applicationCategory: "MultimediaApplication",
    operatingSystem: "Web, Telegram",
    description: localeConfig.softwareDescription,
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: localeConfig.priceCurrency,
    },
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: "5",
      ratingCount: "1",
    },
  };
  const organization = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "AdShorts AI",
    url: "https://adshortsai.com",
    logo: logoUrl,
    sameAs: ["https://t.me/AdShortsAIBot"],
    contactPoint: {
      "@type": "ContactPoint",
      email: "support@adshortsai.com",
      contactType: "customer support",
    },
  };

  return `  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
${verificationBlock}    <link rel="canonical" href="${escapeAttr(localeConfig.canonical)}" />
${alternates}
    <title>${escapeHtml(localeConfig.title)}</title>

    <meta
      name="description"
      content="${escapeAttr(localeConfig.description)}"
    />

    <meta property="og:type" content="website" />
    <meta property="og:url" content="${escapeAttr(localeConfig.ogUrl)}" />
    <meta property="og:title" content="${escapeAttr(localeConfig.ogTitle)}" />
    <meta
      property="og:description"
      content="${escapeAttr(localeConfig.ogDescription)}"
    />
    <meta property="og:image" content="${logoUrl}" />
    <meta property="og:image:width" content="512" />
    <meta property="og:image:height" content="512" />
    <meta property="og:site_name" content="AdShorts AI" />

    <!-- Logo for search engines -->
    <meta itemprop="image" content="${logoUrl}" />
    <link rel="image_src" href="${logoUrl}" />

    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeAttr(localeConfig.twitterTitle)}" />
    <meta
      name="twitter:description"
      content="${escapeAttr(localeConfig.twitterDescription)}"
    />
    <meta name="twitter:image" content="${logoUrl}" />

    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&display=swap"
      rel="stylesheet"
    />
    <link rel="stylesheet" href="${asset(localeConfig, content.assets.css)}" />
    <link rel="preload" as="image" href="${asset(localeConfig, content.assets.logo)}" />
    <link rel="icon" type="image/png" sizes="120x120" href="${asset(localeConfig, icon.png120)}" />
    <link rel="icon" type="image/png" sizes="48x48" href="${asset(localeConfig, icon.png48)}" />
    <link rel="icon" type="image/png" sizes="32x32" href="${asset(localeConfig, icon.png32)}" />
    <link rel="icon" type="image/png" sizes="16x16" href="${asset(localeConfig, icon.png16)}" />
    <link rel="icon" type="image/svg+xml" href="${asset(localeConfig, icon.svg)}" />
    <link rel="shortcut icon" type="image/x-icon" href="${asset(localeConfig, icon.ico)}" />
    <link rel="apple-touch-icon" href="${asset(localeConfig, content.assets.logo)}" />
    <style>
      /* Inline fallback for critical styles */
      .logo { display: inline-flex; align-items: center; gap: 12px; }
      .logo__icon { display: inline-block; }
    </style>
    <script defer src="${asset(localeConfig, content.assets.script)}"></script>

    <!-- Yandex.Metrika counter -->
    <script type="text/javascript">
      (function(m,e,t,r,i,k,a){
        m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};
        m[i].l=1*new Date();
        for (var j = 0; j < document.scripts.length; j++) {
          if (document.scripts[j].src === r) { return; }
        }
        k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)
      })(window, document, 'script', 'https://mc.yandex.ru/metrika/tag.js?id=104655292', 'ym');

      ym(104655292, 'init', {ssr:true, webvisor:true, clickmap:true, ecommerce:"dataLayer", referrer: document.referrer, url: location.href, accurateTrackBounce:true, trackLinks:true});
    </script>
    <noscript><div><img src="https://mc.yandex.ru/watch/104655292" style="position:absolute; left:-9999px;" alt="" /></div></noscript>
    <!-- /Yandex.Metrika counter -->

    <!-- Structured Data for SEO -->
    <script type="application/ld+json">
${renderJsonLd(softwareApplication)}
    </script>
    <script type="application/ld+json">
${renderJsonLd(organization)}
    </script>
  </head>`;
};

const renderHeader = (locale, localeConfig, supportedLocales) => {
  const m = content.messages;

  return `    <header class="header header--app-static">
      <div class="container header__inner">
        <a class="logo" href="./" aria-label="AdShorts AI">
          <img class="logo__icon" src="${asset(localeConfig, content.assets.logo)}" alt="" role="presentation" width="46" height="46" />
          <span class="logo__wordmark">AdShorts<span>AI</span></span>
        </a>
        <nav class="nav" aria-label="${text(m.navAria, locale, supportedLocales, "messages.navAria")}">
          <button class="nav__toggle" aria-expanded="false" aria-controls="nav-menu">${text(m.navToggle, locale, supportedLocales, "messages.navToggle")}</button>
          <ul id="nav-menu" class="nav__list">
            <li><a class="nav__home-link" href="./">${text(m.navHome, locale, supportedLocales, "messages.navHome")}</a></li>
            <li><a href="examples">${text(m.navSamples, locale, supportedLocales, "messages.navSamples")}</a></li>
            <li><a href="app/studio">${text(m.navStudio, locale, supportedLocales, "messages.navStudio")}</a></li>
            <li><a href="pricing">${text(m.navPricing, locale, supportedLocales, "messages.navPricing")}</a></li>
          </ul>
        </nav>
        <div class="header__actions">
          ${renderStaticLanguageSelector(locale, supportedLocales)}
          <a class="header__signin-link" href="app/studio">${text(m.navSignin, locale, supportedLocales, "messages.navSignin")}</a>
        </div>
      </div>
    </header>`;
};

const studioHref = () => "app/studio";

const renderHero = (locale, supportedLocales) => {
  const m = content.messages;
  const features = localize(content.heroFeatures, locale, supportedLocales, "heroFeatures")
    .map((feature) => `            <li>${escapeHtml(feature)}</li>`)
    .join("\n");

  return `      <section class="hero hero--centered">
        <div class="container">
          <h1><span class="brand">AdShorts AI</span><br><span class="highlight">Shorts / Reels / TikTok</span><br>${text(m.heroSuffix, locale, supportedLocales, "messages.heroSuffix")}</h1>
          <p class="lead">
            ${text(m.heroLead, locale, supportedLocales, "messages.heroLead")}
          </p>

          <div class="cta cta--center">
            <a
              class="btn btn--primary btn--lg"
              href="${studioHref()}"
            >${text(m.heroCta, locale, supportedLocales, "messages.heroCta")}</a>
            <p class="cta__note">${text(m.heroCtaNote, locale, supportedLocales, "messages.heroCtaNote")}</p>
          </div>

          <ul class="hero__features">
${features}
          </ul>
        </div>
      </section>`;
};

const renderHow = (locale, supportedLocales) => {
  const steps = content.howSteps
    .map((step, index) => {
      if (step.type === "optional") {
        return `            <div class="how-step how-step--optional">
              <div class="how-step__badge">${text(content.messages.optional, locale, supportedLocales, "messages.optional")}</div>
              <div class="how-step__content">
                <h3>${text(step.title, locale, supportedLocales, `howSteps[${index}].title`)}</h3>
                <p>${text(step.text, locale, supportedLocales, `howSteps[${index}].text`)}</p>
              </div>
            </div>`;
      }

      const note = step.note
        ? `
                <p class="how-step__note">${text(step.note, locale, supportedLocales, `howSteps[${index}].note`)}</p>`
        : "";
      return `            <div class="how-step how-step--main">
              <div class="how-step__number">${escapeHtml(step.number)}</div>
              <div class="how-step__content">
                <h3>${text(step.title, locale, supportedLocales, `howSteps[${index}].title`)}</h3>
                <p>${text(step.text, locale, supportedLocales, `howSteps[${index}].text`)}</p>${note}
              </div>
            </div>`;
    })
    .join("\n");

  return `      <!-- How it works -->
      <section class="section" id="how-it-works">
        <div class="container">
          <h2>${text(content.messages.howTitle, locale, supportedLocales, "messages.howTitle")}</h2>
          <div class="how-steps">
${steps}
          </div>
        </div>
      </section>`;
};

const renderSamples = (locale, localeConfig, supportedLocales) => {
  const soundLabel = text(content.messages.soundToggle, locale, supportedLocales, "messages.soundToggle");
  const samples = content.samples
    .map((sample, index) => `            <article class="sample">
              <div class="sample__media">
                <video src="${asset(localeConfig, rawLocalized(sample.video, locale, supportedLocales, `samples[${index}].video`))}" autoplay muted loop playsinline></video>
${renderSoundButton(soundLabel)}
              </div>
              <div class="sample__body">
                <h3 class="sample__title">${text(sample.title, locale, supportedLocales, `samples[${index}].title`)}</h3>
                <p class="sample__text">${text(sample.text, locale, supportedLocales, `samples[${index}].text`)}</p>
              </div>
            </article>`)
    .join("\n\n");

  return `      <!-- Samples -->
      <section class="section" id="samples">
        <div class="container">
          <h2>${text(content.messages.samplesTitle, locale, supportedLocales, "messages.samplesTitle")}</h2>
          <div class="samples">
${samples}
          </div>
        </div>
      </section>`;
};

const renderBenefits = (locale, supportedLocales) => {
  const benefits = content.benefits
    .map((benefit, index) => `            <div class="benefit">
              <h3>${text(benefit.title, locale, supportedLocales, `benefits[${index}].title`)}</h3>
              <p>${text(benefit.text, locale, supportedLocales, `benefits[${index}].text`)}</p>
            </div>`)
    .join("\n");

  return `      <section class="section" id="benefits">
        <div class="container">
          <h2>${text(content.messages.benefitsTitle, locale, supportedLocales, "messages.benefitsTitle")}</h2>
          <div class="benefits">
${benefits}
          </div>
        </div>
      </section>`;
};

const renderPlan = (plan, index, locale, supportedLocales) => {
  const classes = ["plan"];
  if (plan.featured) classes.push("plan--featured");
  if (plan.bestValue) classes.push("plan--best-value");
  const badge = text(plan.badge, locale, supportedLocales, `plans[${index}].badge`);
  const usd = text(plan.usd ?? { ru: null, en: null }, locale, supportedLocales, `plans[${index}].usd`);
  const perVideo = text(plan.perVideo, locale, supportedLocales, `plans[${index}].perVideo`);
  const features = localize(plan.features, locale, supportedLocales, `plans[${index}].features`)
    .map((feature) => {
      const className = plan.neutralFeature ? "plan__feature plan__feature--neutral" : "plan__feature";
      return `                <li class="${className}">${escapeHtml(feature)}</li>`;
    })
    .join("\n");
  const ctaClass = plan.featured ? "btn btn--primary plan__cta tg-smart" : "btn btn--ghost plan__cta tg-smart";
  const badgeClass = plan.hotBadge ? "plan__badge plan__badge--hot" : "plan__badge";
  const price = text(plan.price, locale, supportedLocales, `plans[${index}].price`);

  return `            <div class="${classes.join(" ")}">
${badge ? `              <div class="${badgeClass}">${badge}</div>\n` : ""}              <h3>${escapeHtml(plan.name)}</h3>
              <p class="plan__desc">${text(plan.description, locale, supportedLocales, `plans[${index}].description`)}</p>
              <div class="plan__num">${text(plan.videos, locale, supportedLocales, `plans[${index}].videos`)}</div>
              <div class="plan__price">${usd ? `<span class="plan__amount">${price}</span> <span class="plan__usd">${usd}</span>` : plan.featured || plan.bestValue ? `<span class="plan__amount">${price}</span>` : price}</div>
${perVideo ? `              <p class="plan__per-video">${perVideo}</p>\n` : ""}              <ul class="plan__features">
${features}
              </ul>
              <a
                class="${ctaClass}"
                data-tg-domain="AdShortsAIBot"
                data-tg-start="${text(plan.dataStart, locale, supportedLocales, `plans[${index}].dataStart`)}"
                href="https://t.me/AdShortsAIBot"
                target="_blank"
                rel="noopener"
              >${text(plan.cta, locale, supportedLocales, `plans[${index}].cta`)}</a>
            </div>`;
};

const renderPacks = (locale, supportedLocales) => {
  const packs = content.packs
    .map((pack, index) => {
      const badge = text(pack.badge, locale, supportedLocales, `packs[${index}].badge`);
      const usd = text(pack.usd, locale, supportedLocales, `packs[${index}].usd`);
      return `              <div class="pack${badge ? " pack--best" : ""}">
${badge ? `                <div class="pack__badge">${badge}</div>\n` : ""}                <h4>${escapeHtml(pack.name)}</h4>
                <p class="pack__videos">${text(pack.videos, locale, supportedLocales, `packs[${index}].videos`)}</p>
                <p class="pack__price">${text(pack.price, locale, supportedLocales, `packs[${index}].price`)}${usd ? ` <span class="pack__usd">${usd}</span>` : ""}</p>
                <p class="pack__per-video">${text(pack.perVideo, locale, supportedLocales, `packs[${index}].perVideo`)}</p>
              </div>`;
    })
    .join("\n");

  return `          <!-- Packs -->
          <div class="packs">
            <div class="packs__header">
              <h3>${text(content.messages.packsTitle, locale, supportedLocales, "messages.packsTitle")}</h3>
              <p class="packs__subtitle">${text(content.messages.packsSubtitle, locale, supportedLocales, "messages.packsSubtitle")}</p>
            </div>
            <p class="packs__note">
              ${text(content.messages.packsNote, locale, supportedLocales, "messages.packsNote")}
            </p>

            <div class="packs__grid">
${packs}
            </div>
          </div>`;
};

const renderPaymentInfo = (locale, supportedLocales) => {
  const title = text(content.messages.paymentTitle, locale, supportedLocales, "messages.paymentTitle");
  if (!title) return "";

  const steps = localize(content.paymentSteps, locale, supportedLocales, "paymentSteps")
    .map(([strong, rest]) => `              <li><strong>${escapeHtml(strong)}</strong> — ${escapeHtml(rest)}</li>`)
    .join("\n");

  return `

          <!-- How to pay -->
          <div class="payment-info">
            <h3>${title}</h3>
            <ol class="payment-steps">
${steps}
            </ol>
            <p class="payment-note">${text(content.messages.paymentNote, locale, supportedLocales, "messages.paymentNote")}</p>
          </div>`;
};

const renderPricing = (locale, supportedLocales) => {
  const intro = rawLocalized(content.messages.pricingIntro, locale, supportedLocales, "messages.pricingIntro");
  const plans = content.plans.map((plan, index) => renderPlan(plan, index, locale, supportedLocales)).join("\n\n");

  return `      <section class="section" id="pricing">
        <div class="container">
          <h2>${text(content.messages.pricingTitle, locale, supportedLocales, "messages.pricingTitle")}</h2>
${intro ? `          <p class="pricing-intro">${intro}</p>\n` : ""}
          <div class="plans">
${plans}
          </div>

${renderPacks(locale, supportedLocales)}${renderPaymentInfo(locale, supportedLocales)}
        </div>
      </section>`;
};

const renderGuides = (locale, supportedLocales) => {
  const topics = content.guideTopics
    .map((topic, index) => `            <a class="card card--link guide-topic" href="${escapeAttr(topic.href)}">
              <h3>
                <span class="guide-topic__emoji">${escapeHtml(topic.emoji)}</span>
                <span class="guide-topic__title">${text(topic.title, locale, supportedLocales, `guideTopics[${index}].title`)}</span>
                <span class="guide-topic__count">${text(topic.count, locale, supportedLocales, `guideTopics[${index}].count`)}</span>
              </h3>
              <p>${text(topic.text, locale, supportedLocales, `guideTopics[${index}].text`)}</p>
            </a>`)
    .join("\n\n");

  return `      <section class="section" id="shorts-guides">
        <div class="container">
          <h2>${text(content.messages.guidesTitle, locale, supportedLocales, "messages.guidesTitle")}</h2>
          <p style="color: var(--muted); margin: 0 0 24px;">
            ${text(content.messages.guidesIntro, locale, supportedLocales, "messages.guidesIntro")}
          </p>

          <div class="cards cards--2">
${topics}
          </div>

          <div style="margin-top: 18px; display: flex; justify-content: center;">
            <a class="btn btn--ghost btn--small" href="./shorts-guides/">${text(content.messages.guidesAll, locale, supportedLocales, "messages.guidesAll")}</a>
          </div>
        </div>
      </section>`;
};

const renderFaq = (locale, supportedLocales) => {
  const faqItems = content.faqs
    .map((faq, index) => {
      const answer = faq.answerHtml
        ? rawLocalized(faq.answerHtml, locale, supportedLocales, `faqs[${index}].answerHtml`)
        : text(faq.answer, locale, supportedLocales, `faqs[${index}].answer`);
      return `            <details class="accordion__item"${faq.open ? " open" : ""}>
              <summary>${text(faq.question, locale, supportedLocales, `faqs[${index}].question`)}</summary>
              <p>${answer}</p>
            </details>`;
    })
    .join("\n\n");

  return `      <section class="section" id="faq">
        <div class="container">
          <h2>${text(content.messages.faqTitle, locale, supportedLocales, "messages.faqTitle")}</h2>
          <div class="accordion" data-accordion>
${faqItems}
          </div>
        </div>
      </section>`;
};

const renderFinalCta = (locale, supportedLocales) => {
  const lead = text(content.messages.finalCtaLead, locale, supportedLocales, "messages.finalCtaLead");

  if (lead) {
    return `      <section class="section cta-block">
        <div class="container cta-block__inner">
          <h2>${text(content.messages.finalCtaTitle, locale, supportedLocales, "messages.finalCtaTitle")}</h2>
          <p>${lead}</p>
          <a
            class="btn btn--primary btn--lg"
            href="${studioHref()}"
          >${text(content.messages.finalCtaButton, locale, supportedLocales, "messages.finalCtaButton")}</a>
        </div>
      </section>`;
  }

  return `      <section class="section cta-block">
        <div class="container cta-block__inner">
          <h2>${text(content.messages.finalCtaTitle, locale, supportedLocales, "messages.finalCtaTitle")}</h2>
          <div class="cta cta--center" style="margin: 18px 0 0;">
            <a
              class="btn btn--primary btn--lg"
              href="${studioHref()}"
            >${text(content.messages.finalCtaButton, locale, supportedLocales, "messages.finalCtaButton")}</a>
            <p class="cta__note">${text(content.messages.heroCtaNote, locale, supportedLocales, "messages.heroCtaNote")}</p>
          </div>
        </div>
      </section>`;
};

const renderFooter = (locale, localeConfig, supportedLocales) => {
  const legal = localeConfig.legalLinks;
  return `    <footer class="footer">
      <div class="container footer__inner">
        <a class="logo" href="#top">AdShorts<span>AI</span></a>
        <div class="footer__links">
          <span style="color: var(--muted);">${text(content.messages.contact, locale, supportedLocales, "messages.contact")} <a href="mailto:support@adshortsai.com" style="color: var(--muted);">support@adshortsai.com</a></span>
          <a href="${escapeAttr(legal.offer)}">${text(content.messages.offer, locale, supportedLocales, "messages.offer")}</a>
          <a href="${escapeAttr(legal.termsOfUse)}">${text(content.messages.termsOfUse, locale, supportedLocales, "messages.termsOfUse")}</a>
          <a href="${escapeAttr(legal.terms)}">${text(content.messages.terms, locale, supportedLocales, "messages.terms")}</a>
          <a href="${escapeAttr(legal.privacy)}">${text(content.messages.privacy, locale, supportedLocales, "messages.privacy")}</a>
          <a href="${escapeAttr(legal.dataDeletion)}">${text(content.messages.dataDeletion, locale, supportedLocales, "messages.dataDeletion")}</a>
          <a href="${escapeAttr(localeConfig.languageSwitch.footerHref)}" rel="alternate" hreflang="${escapeAttr(localeConfig.languageSwitch.footerHreflang)}">${escapeHtml(localeConfig.languageSwitch.footerLabel)}</a>
          <span style="color: var(--muted);">© <span id="year"></span> AdShorts AI</span>
        </div>
      </div>
    </footer>`;
};

const renderRevealScript = () => `    <!-- Scroll Reveal Animation -->
    <script>
    (function() {
      var elements = document.querySelectorAll('.section h2, .card, .benefit, .plan, .feature, .sample, .steps li, .accordion__item, .pack, .cta-block__inner, .how-step');
      
      // Add hidden class
      for (var i = 0; i < elements.length; i++) {
        elements[i].classList.add('will-reveal');
        // Stagger delay
        var parent = elements[i].parentElement;
        if (parent && parent.children.length > 1) {
          var idx = Array.prototype.indexOf.call(parent.children, elements[i]);
          if (idx > 0 && idx <= 5) {
            elements[i].setAttribute('data-delay', idx);
          }
        }
      }
      
      // Intersection Observer
      var observer = new IntersectionObserver(function(entries) {
        entries.forEach(function(entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        });
      }, { threshold: 0.1, rootMargin: '0px 0px -30px 0px' });
      
      // Observe
      var reveals = document.querySelectorAll('.will-reveal');
      for (var j = 0; j < reveals.length; j++) {
        observer.observe(reveals[j]);
      }
    })();
    </script>`;

const renderBody = (locale, localeConfig, supportedLocales) => `  <body>
    <!-- Decorative elements -->
    <div class="orb orb--cyan" aria-hidden="true"></div>
    <div class="orb orb--purple" aria-hidden="true"></div>
    <div class="orb orb--pink" aria-hidden="true"></div>
    <div class="noise" aria-hidden="true"></div>

${renderHeader(locale, localeConfig, supportedLocales)}

    <main id="top">
${renderHero(locale, supportedLocales)}

${renderHow(locale, supportedLocales)}

${renderSamples(locale, localeConfig, supportedLocales)}

${renderBenefits(locale, supportedLocales)}

${renderPricing(locale, supportedLocales)}

${renderGuides(locale, supportedLocales)}

${renderFaq(locale, supportedLocales)}

${renderFinalCta(locale, supportedLocales)}
    </main>

${renderFooter(locale, localeConfig, supportedLocales)}

${renderRevealScript()}
  </body>`;

const renderLanding = (locale, localeConfig, supportedLocales) => `<!doctype html>
<html lang="${escapeAttr(localeConfig.lang)}">
${renderHead(locale, localeConfig)}

${renderBody(locale, localeConfig, supportedLocales)}
</html>
`;

const validateLocaleConfig = (locale, localeConfig) => {
  const requiredFields = ["path", "lang", "canonical", "assetPrefix", "title", "description", "languageSwitch", "legalLinks"];
  const missing = requiredFields.filter((field) => !localeConfig[field]);
  if (missing.length > 0) {
    throw new Error(`Locale ${locale} is missing config fields: ${missing.join(", ")}`);
  }
};

const validateRenderedLanding = (locale, localeConfig, html) => {
  const requiredSnippets = [
    `<html lang="${localeConfig.lang}">`,
    `<link rel="canonical" href="${localeConfig.canonical}" />`,
    `hreflang="${locale}"`,
    `hreflang="x-default"`,
    `class="lang-switcher__option is-active"`,
    `rel="alternate" hreflang="${localeConfig.languageSwitch.footerHreflang}"`,
    '<script type="application/ld+json">',
  ];

  for (const snippet of requiredSnippets) {
    if (!html.includes(snippet)) {
      throw new Error(`${localeConfig.path} is missing required static landing snippet: ${snippet}`);
    }
  }
};

const main = async () => {
  const supportedLocales = await readSupportedLocales();
  const configuredLocales = Object.keys(content.locales ?? {});
  const missingLocales = supportedLocales.filter((locale) => !configuredLocales.includes(locale));
  const extraLocales = configuredLocales.filter((locale) => !supportedLocales.includes(locale));

  if (missingLocales.length > 0 || extraLocales.length > 0) {
    throw new Error(
      `static-landing.content.mjs locales must match SUPPORTED_LOCALES. Missing: ${missingLocales.join(", ") || "none"}; extra: ${extraLocales.join(", ") || "none"}`,
    );
  }

  validateLocalizedFields(content, supportedLocales);

  const changedFiles = [];

  for (const locale of supportedLocales) {
    const localeConfig = content.locales[locale];
    validateLocaleConfig(locale, localeConfig);

    const filePath = path.join(rootDir, localeConfig.path);
    const current = await readFile(filePath, "utf8");
    const next = renderLanding(locale, localeConfig, supportedLocales);

    validateRenderedLanding(locale, localeConfig, next);

    if (next !== current) {
      changedFiles.push(localeConfig.path);
      if (!shouldCheck) {
        await writeFile(filePath, next, "utf8");
      }
    }
  }

  if (shouldCheck && changedFiles.length > 0) {
    throw new Error(`Static landing is out of sync: ${changedFiles.join(", ")}`);
  }

  console.log(
    changedFiles.length > 0
      ? `Updated static landing files: ${changedFiles.join(", ")}`
      : "Static landing files are in sync.",
  );
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
