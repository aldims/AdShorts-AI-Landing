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
    manualTime: document.getElementById('manual-time'),
    manualCost: document.getElementById('manual-cost'),
    aiTime: document.getElementById('ai-time'),
    aiCost: document.getElementById('ai-cost'),
    savedTime: document.getElementById('saved-time'),
    savedCost: document.getElementById('saved-cost'),
    manualTimeLabel: document.getElementById('manual-time-label'),
    aiTimeLabel: document.getElementById('ai-time-label'),
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
    const maxTime = Math.max(manualTime, aiTime, 1);

    output.manualTime.textContent = formatHours(manualTime);
    output.manualCost.textContent = formatMoney(manualCost);
    output.aiTime.textContent = formatHours(aiTime);
    output.aiCost.textContent = formatMoney(aiCost);
    output.savedTime.textContent = savedTime >= 0 ? formatHours(savedTime) : `−${formatHours(Math.abs(savedTime))}`;
    output.savedCost.textContent = savedCost >= 0 ? formatMoney(savedCost) : `−${formatMoney(Math.abs(savedCost))}`;
    output.manualTimeLabel.textContent = formatHours(manualTime);
    output.aiTimeLabel.textContent = formatHours(aiTime);
    output.manualBar.style.width = `${manualTime / maxTime * 100}%`;
    output.aiBar.style.width = `${aiTime / maxTime * 100}%`;
    output.shareStatus.textContent = '';
    updateUrl(values);
  };

  const applyUrl = () => {
    const params = new URLSearchParams(window.location.search);
    for (const [key, field] of Object.entries(fields)) {
      if (!params.has(key)) continue;
      field.value = String(clamp(params.get(key), limits[key], defaults[key]));
    }
  };

  const shareButton = document.getElementById('share-result');
  shareButton?.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      output.shareStatus.textContent = 'Ссылка на расчёт скопирована.';
    } catch {
      output.shareStatus.textContent = 'Скопируйте адрес страницы из строки браузера.';
    }
  });

  form.addEventListener('input', calculate);
  applyUrl();
  calculate();
})();
