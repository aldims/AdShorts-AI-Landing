// Language detection and auto-redirect
(function autoDetectLanguage() {
  // Check if user manually selected language (skip auto-redirect)
  const manualLang = localStorage.getItem('manual_lang');
  if (manualLang) return;

  // Get browser language
  const browserLang = navigator.language || navigator.userLanguage;
  const langCode = browserLang.toLowerCase().split('-')[0];
  
  // Get current path
  const currentPath = window.location.pathname;
  const isEnglishPage = currentPath.startsWith('/en/');
  const isRootPage = currentPath === '/' || currentPath === '/index.html';

  // Redirect logic
  if (langCode === 'en' && isRootPage) {
    // English browser on Russian page -> redirect to English
    window.location.href = '/en/';
  } else if (langCode === 'ru' && isEnglishPage) {
    // Russian browser on English page -> redirect to Russian
    window.location.href = '/';
  }
  // For other languages, default to Russian (no redirect)
})();

// Save manual language selection
(function initLanguageSwitcher() {
  const langLinks = document.querySelectorAll('.lang-switch');
  langLinks.forEach(link => {
    link.addEventListener('click', function() {
      const href = this.getAttribute('href');
      if (href.includes('/en/')) {
        localStorage.setItem('manual_lang', 'en');
      } else {
        localStorage.setItem('manual_lang', 'ru');
      }
    });
  });
})();

// Update year
const yearEl = document.getElementById('year');
if (yearEl) {
  yearEl.textContent = new Date().getFullYear().toString();
}

// Mobile nav toggle
const navToggle = document.querySelector('.nav__toggle');
const navMenu = document.getElementById('nav-menu');
if (navToggle && navMenu) {
  navToggle.addEventListener('click', () => {
    const isOpen = navMenu.classList.toggle('open');
    navToggle.setAttribute('aria-expanded', String(isOpen));
  });

  navMenu.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => {
      navMenu.classList.remove('open');
      navToggle.setAttribute('aria-expanded', 'false');
    });
  });
}

// Accordion behavior: allow multiple open, but close others if desired
const accordion = document.querySelector('[data-accordion]');
if (accordion) {
  accordion.addEventListener('click', (e) => {
    if (!(e.target instanceof Element)) return;
    const summary = e.target.closest('summary');
    if (!summary) return;
    const item = summary.parentElement;
    if (!item) return;
    // If holding Ctrl/Cmd, keep others open
    const keepOthers = e.metaKey || e.ctrlKey;
    if (!keepOthers) {
      accordion.querySelectorAll('details[open]').forEach((openItem) => {
        if (openItem !== item) openItem.removeAttribute('open');
      });
    }
  });
}

// Smart Telegram link: desktop -> Telegram Web A (new tab) with tgaddr, mobile -> try app deep link then t.me fallback
(function attachTelegramSmartLinks() {
  const links = document.querySelectorAll('a.tg-smart[data-tg-domain]');
  if (!links.length) return;

  const ua = navigator.userAgent || '';
  const isIOS = /iPhone|iPad|iPod/i.test(ua);
  const isAndroid = /Android/i.test(ua);
  const isMobile = isIOS || isAndroid;
  const isDesktop = !isMobile;

  links.forEach((link) => {
    const domain = link.getAttribute('data-tg-domain');
    if (!domain) return;

    // Get start parameter from data-tg-start attribute for bot tracking
    const startParam = link.getAttribute('data-tg-start') || '';
    const startQuery = startParam ? `?start=${encodeURIComponent(startParam)}` : '';
    
    const webUrl = `https://t.me/${domain}${startQuery}`;
    const appUrl = startParam 
      ? `tg://resolve?domain=${domain}&start=${encodeURIComponent(startParam)}`
      : `tg://resolve?domain=${domain}`;

    // Telegram Web A with tgaddr resolves username reliably
    const tgaddr = startParam
      ? `tg://resolve?domain=${domain}&start=${encodeURIComponent(startParam)}`
      : `tg://resolve?domain=${domain}`;
    const webAUrl = `https://web.telegram.org/a/#?tgaddr=${encodeURIComponent(tgaddr)}`;

    // Default href with start parameter for bot tracking
    link.setAttribute('href', webUrl);
    link.setAttribute('rel', 'noopener');

    if (isDesktop) {
      link.addEventListener('click', (ev) => {
        ev.preventDefault();
        window.open(webAUrl, '_blank', 'noopener');
      }, { passive: false });
      return;
    }

    // Mobile: try app first with fallback to t.me (same tab is fine on mobile)
    link.addEventListener('click', (ev) => {
      ev.preventDefault();

      const start = Date.now();
      const iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      iframe.src = appUrl;
      document.body.appendChild(iframe);

      const fallbackTimer = setTimeout(() => {
        const elapsed = Date.now() - start;
        if (elapsed < 1600) {
          window.location.href = webUrl;
        }
        try { iframe.remove(); } catch (_) {}
      }, 1200);

      const onVisibility = () => {
        if (document.hidden) {
          clearTimeout(fallbackTimer);
          try { iframe.remove(); } catch (_) {}
          document.removeEventListener('visibilitychange', onVisibility);
        }
      };
      document.addEventListener('visibilitychange', onVisibility);
    }, { passive: false });
  });
})();

// Ensure sample videos autoplay
(function initSampleVideos() {
  const videos = document.querySelectorAll('.sample__media video');
  if (!videos.length) return;

  const tryPlay = (video) => video.play().catch(() => {});

  videos.forEach((video) => {
    video.muted = true;
    video.playsInline = true;
    
    if (video.readyState >= 2) {
      tryPlay(video);
    } else {
      video.addEventListener('loadeddata', () => tryPlay(video), { once: true });
    }
  });

  // Resume videos when page becomes visible
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      videos.forEach((video) => {
        if (video.paused) tryPlay(video);
      });
    }
  });
})();

// Yandex.Metrika goals for key interactions
(function initYandexGoals() {
  const YM_ID = 104655292;

  // Queue to handle early clicks before ym is ready
  const goalQueue = [];
  let flushTimerStarted = false;

  const tryFlush = () => {
    if (typeof window.ym !== 'function') return;
    while (goalQueue.length) {
      const { goal, params } = goalQueue.shift();
      try { window.ym(YM_ID, 'reachGoal', goal, params || {}); } catch (_) {}
    }
  };

  const startFlushTimer = () => {
    if (flushTimerStarted) return;
    flushTimerStarted = true;
    const startedAt = Date.now();
    const interval = setInterval(() => {
      tryFlush();
      if (typeof window.ym === 'function' || Date.now() - startedAt > 5000) {
        clearInterval(interval);
        // Final flush attempt
        tryFlush();
      }
    }, 300);
  };

  const sendGoal = (goal, params) => {
    if (typeof window.ym === 'function') {
      try { window.ym(YM_ID, 'reachGoal', goal, params || {}); } catch (_) {}
      return;
    }
    // ym not ready yet — queue and start timer
    goalQueue.push({ goal, params });
    startFlushTimer();
  };

  // Telegram buttons (all CTA with class tg-smart)
  document.querySelectorAll('a.tg-smart').forEach((el) => {
    el.addEventListener('click', () => {
      // Include start payload if present to distinguish placements
      const start = el.getAttribute('data-tg-start') || '';
      sendGoal('telegram_click', start ? { start } : undefined);
    }, { passive: true });
  });

  // Pricing plan buttons with plan encoded in data-tg-start (pricing_free/pro/ultra)
  document.querySelectorAll('.plan__cta').forEach((el) => {
    el.addEventListener('click', () => {
      const start = el.getAttribute('data-tg-start') || '';
      // Derive plan name, e.g., pricing_pro -> pro
      const plan = start.replace(/^pricing_/, '') || 'unknown';
      sendGoal('pricing_click', { plan });
    }, { passive: true });
  });

  // Top nav anchors
  const navMap = new Map([
    ['a[href="#how-it-works"]', 'nav_how'],
    ['a[href="#benefits"]', 'nav_benefits'],
    ['a[href="#pricing"]', 'nav_pricing'],
    ['a[href="#faq"]', 'nav_faq'],
  ]);
  navMap.forEach((goal, selector) => {
    document.querySelectorAll(selector).forEach((el) => {
      el.addEventListener('click', () => sendGoal(goal), { passive: true });
    });
  });

  // Fallback: capture all clicks and detect anchors by href (in case elements render later)
  window.addEventListener('click', (e) => {
    const target = e.target instanceof Element ? e.target.closest('a[href^="#"]') : null;
    if (!target) return;
    const href = target.getAttribute('href');
    if (!href) return;
    if (href === '#how-it-works') sendGoal('nav_how');
    else if (href === '#benefits') sendGoal('nav_benefits');
    else if (href === '#pricing') sendGoal('nav_pricing');
    else if (href === '#faq') sendGoal('nav_faq');
  }, true);
})();
