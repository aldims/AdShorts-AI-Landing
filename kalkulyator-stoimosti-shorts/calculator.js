(() => {
  const form = document.getElementById('shorts-calculator');
  if (!form) return;

  const fields = {
    videos: form.elements.videos,
    manualHours: form.elements.manualHours,
    hourlyRate: form.elements.hourlyRate,
    aiMinutes: form.elements.aiMinutes,
    subscription: form.elements.subscription,
  };
  const limits = {
    videos: [1, 200],
    manualHours: [0.25, 80],
    hourlyRate: [0, 100000],
    aiMinutes: [1, 480],
    subscription: [0, 1000000],
  };
  const defaults = {
    videos: 8,
    manualHours: 3,
    hourlyRate: 1000,
    aiMinutes: 20,
    subscription: 0,
  };
  const output = {
    resultScenario: document.getElementById('result-scenario'),
    savingsHighlight: document.getElementById('savings-highlight'),
    savingsCaption: document.getElementById('savings-caption'),
    manualTime: document.getElementById('manual-time'),
    manualCost: document.getElementById('manual-cost'),
    aiTime: document.getElementById('ai-time'),
    aiCost: document.getElementById('ai-cost'),
    manualUnitCost: document.getElementById('manual-unit-cost'),
    aiUnitCost: document.getElementById('ai-unit-cost'),
    savedTime: document.getElementById('saved-time'),
    savedTimeLabel: document.getElementById('saved-time-label'),
    savedCost: document.getElementById('saved-cost'),
    savedPercent: document.getElementById('saved-percent'),
    savedPercentLabel: document.getElementById('saved-percent-label'),
    manualCostLabel: document.getElementById('manual-cost-label'),
    aiCostLabel: document.getElementById('ai-cost-label'),
    manualBar: document.getElementById('manual-bar'),
    aiBar: document.getElementById('ai-bar'),
    shareStatus: document.getElementById('share-status'),
  };
  const currency = new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 });

  const clamp = (value, [min, max], fallback) => {
    const number = Number(value);
    if (!Number.isFinite(number)) return fallback;
    return Math.min(max, Math.max(min, number));
  };

  const readValues = () => Object.fromEntries(
    Object.entries(fields).map(([key, field]) => [key, clamp(field.value, limits[key], defaults[key])]),
  );

  const formatHours = (hours) => {
    const totalMinutes = Math.max(0, Math.round(hours * 60));
    const wholeHours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (!wholeHours) return `${minutes} мин`;
    return minutes ? `${wholeHours} ч ${minutes} мин` : `${wholeHours} ч`;
  };

  const formatMoney = (value) => `${currency.format(Math.round(value))} ₽`;

  const pluralizeVideos = (value) => {
    const integer = Math.round(value);
    const mod10 = integer % 10;
    const mod100 = integer % 100;
    if (mod10 === 1 && mod100 !== 11) return `${integer} ролик`;
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${integer} ролика`;
    return `${integer} роликов`;
  };

  const updateUrl = (values) => {
    const url = new URL(window.location.href);
    for (const [key, value] of Object.entries(values)) url.searchParams.set(key, String(value));
    window.history.replaceState(null, '', `${url.pathname}?${url.searchParams.toString()}`);
  };

  const calculate = () => {
    const values = readValues();
    const manualTime = values.videos * values.manualHours;
    const aiTime = values.videos * values.aiMinutes / 60;
    const manualCost = manualTime * values.hourlyRate;
    const aiCost = aiTime * values.hourlyRate + values.subscription;
    const savedTime = manualTime - aiTime;
    const savedCost = manualCost - aiCost;
    const savedPercent = manualCost > 0 ? savedCost / manualCost * 100 : 0;
    const maxCost = Math.max(manualCost, aiCost, 1);

    output.resultScenario.textContent = pluralizeVideos(values.videos);
    output.manualTime.textContent = formatHours(manualTime);
    output.manualCost.textContent = formatMoney(manualCost);
    output.aiTime.textContent = formatHours(aiTime);
    output.aiCost.textContent = formatMoney(aiCost);
    output.manualUnitCost.textContent = formatMoney(manualCost / values.videos);
    output.aiUnitCost.textContent = formatMoney(aiCost / values.videos);
    output.savedTime.textContent = formatHours(Math.abs(savedTime));
    output.savedTimeLabel.textContent = savedTime > 0
      ? 'меньше работы'
      : savedTime < 0 ? 'больше работы' : 'разницы по времени';
    output.savedPercent.textContent = manualCost > 0
      ? `${currency.format(Math.abs(Math.round(savedPercent)))}%`
      : '—';
    output.manualCostLabel.textContent = formatMoney(manualCost);
    output.aiCostLabel.textContent = formatMoney(aiCost);
    output.manualBar.style.width = `${manualCost / maxCost * 100}%`;
    output.aiBar.style.width = `${aiCost / maxCost * 100}%`;

    output.savingsHighlight.classList.remove('is-negative', 'is-neutral');
    if (savedCost > 0) {
      output.savingsCaption.textContent = 'Экономия бюджета';
      output.savedCost.textContent = formatMoney(savedCost);
      output.savedPercentLabel.textContent = 'экономии бюджета';
    } else if (savedCost < 0) {
      output.savingsHighlight.classList.add('is-negative');
      output.savingsCaption.textContent = 'AI дороже на';
      output.savedCost.textContent = formatMoney(Math.abs(savedCost));
      output.savedPercentLabel.textContent = manualCost > 0 ? 'выше ручного бюджета' : 'нет базы для сравнения';
    } else {
      output.savingsHighlight.classList.add('is-neutral');
      output.savingsCaption.textContent = 'Бюджет одинаковый';
      output.savedCost.textContent = formatMoney(0);
      output.savedPercentLabel.textContent = manualCost > 0 ? 'разницы в бюджете' : 'нет расходов';
    }

    output.shareStatus.textContent = '';
    updateUrl(values);
  };

  const normalizeFields = () => {
    const values = readValues();
    for (const [key, field] of Object.entries(fields)) field.value = String(values[key]);
    calculate();
  };

  const applyUrl = () => {
    const params = new URLSearchParams(window.location.search);
    for (const [key, field] of Object.entries(fields)) {
      if (!params.has(key)) continue;
      field.value = String(clamp(params.get(key), limits[key], defaults[key]));
    }
  };

  const shareButton = document.getElementById('share-result');
  const resetButton = document.getElementById('reset-calculator');
  shareButton?.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      output.shareStatus.textContent = 'Ссылка на расчёт скопирована.';
    } catch {
      output.shareStatus.textContent = 'Скопируйте адрес страницы из строки браузера.';
    }
  });

  resetButton?.addEventListener('click', () => {
    for (const [key, field] of Object.entries(fields)) field.value = String(defaults[key]);
    calculate();
    fields.videos.focus();
  });

  form.addEventListener('input', calculate);
  form.addEventListener('change', normalizeFields);
  applyUrl();
  calculate();
})();
