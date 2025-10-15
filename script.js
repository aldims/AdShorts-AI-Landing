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

    const startParam = (link.getAttribute('data-tg-start') || '').trim();
    const startQuery = startParam ? `?start=${encodeURIComponent(startParam)}` : '';

    const webUrl = `https://t.me/${domain}${startQuery}`;
    const appUrl = `tg://resolve?domain=${domain}${startParam ? `&start=${encodeURIComponent(startParam)}` : ''}`;

    // Telegram Web A with tgaddr resolves username reliably
    const tgaddr = `tg://resolve?domain=${domain}${startParam ? `&start=${encodeURIComponent(startParam)}` : ''}`;
    const webAUrl = `https://web.telegram.org/a/#?tgaddr=${encodeURIComponent(tgaddr)}`;

    // Default href stays t.me; target set in markup
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

// Ensure autoplay of demo video. Unmute after first user interaction to comply with browser policies.
(function initAutoplayDemo() {
  const video = document.querySelector('.screen-video video');
  const toggle = document.querySelector('.sound-toggle');
  if (!video) return;

  video.muted = true;
  video.playsInline = true;

  const tryPlay = () => video.play().catch(() => {});

  // Retry logic for stubborn autoplay
  const ensurePlaying = () => {
    if (video.paused || video.readyState < 2) {
      tryPlay();
      setTimeout(() => {
        if (video.paused) tryPlay();
      }, 400);
      setTimeout(() => {
        if (video.paused) tryPlay();
      }, 1200);
    }
  };

  if (video.readyState >= 2) ensurePlaying();
  else video.addEventListener('loadeddata', ensurePlaying, { once: true });

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) ensurePlaying();
  });

  video.addEventListener('pause', () => {
    // If user не ставил на паузу через controls (мы их не показываем), пытаемся возобновить
    ensurePlaying();
  });

  const enableSound = () => {
    video.muted = false;
    ensurePlaying();
    if (toggle) {
      toggle.setAttribute('aria-pressed', 'true');
      toggle.textContent = 'Звук включён';
    }
    window.removeEventListener('click', onFirstInteraction, true);
    window.removeEventListener('touchstart', onFirstInteraction, true);
    window.removeEventListener('scroll', onFirstInteraction, true);
  };

  const onFirstInteraction = () => enableSound();

  // Enable on first interaction anywhere
  window.addEventListener('click', onFirstInteraction, true);
  window.addEventListener('touchstart', onFirstInteraction, true);
  window.addEventListener('scroll', onFirstInteraction, true);

  // Manual toggle
  if (toggle) {
    toggle.addEventListener('click', (e) => {
      e.preventDefault();
      if (video.muted) {
        enableSound();
      } else {
        video.muted = true;
        if (toggle) {
          toggle.setAttribute('aria-pressed', 'false');
          toggle.textContent = 'Включить звук';
        }
      }
    });
  }
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
    ['a[href="#value"]', 'nav_how'],
    ['a[href="#benefits"]', 'nav_benefits'],
    ['a[href="#pricing"]', 'nav_pricing'],
    ['a[href="#faq"]', 'nav_faq'],
  ]);
  navMap.forEach((goal, selector) => {
    document.querySelectorAll(selector).forEach((el) => {
      el.addEventListener('click', () => sendGoal(goal), { passive: true });
    });
  });
})();
