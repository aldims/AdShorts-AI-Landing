# Все метки перехода в Telegram бот

## Главная страница (index.html) - Русская версия

1. **`landing_hero`** - Главная кнопка в hero-секции
   - Текст: "Создать видео бесплатно"
   - URL: `https://t.me/AdShortsAIBot?start=landing_hero`

2. **`pricing_free`** - Кнопка Free тарифа
   - Текст: "Начать бесплатно"
   - URL: `https://t.me/AdShortsAIBot?start=pricing_free`

3. **`pricing_pro`** - Кнопка Pro тарифа
   - Текст: "Перейти на Pro"
   - URL: `https://t.me/AdShortsAIBot?start=pricing_pro`

4. **`pricing_ultra`** - Кнопка Ultra тарифа
   - Текст: "Выбрать Ultra"
   - URL: `https://t.me/AdShortsAIBot?start=pricing_ultra`

5. **`landing_cta`** - Кнопка в конце страницы (CTA блок)
   - Текст: "Начать бесплатно"
   - URL: `https://t.me/AdShortsAIBot?start=landing_cta`

---

## Главная страница (en/index.html) - Английская версия

1. **`landing_hero_en`** - Главная кнопка в hero-секции
   - Текст: "Create Video for Free"
   - URL: `https://t.me/AdShortsAIBot?start=landing_hero_en`

2. **`pricing_free_en`** - Кнопка Free тарифа
   - Текст: "Start Free"
   - URL: `https://t.me/AdShortsAIBot?start=pricing_free_en`

3. **`pricing_pro_en`** - Кнопка Pro тарифа
   - Текст: "Upgrade to Pro"
   - URL: `https://t.me/AdShortsAIBot?start=pricing_pro_en`

4. **`pricing_ultra_en`** - Кнопка Ultra тарифа
   - Текст: "Choose Ultra"
   - URL: `https://t.me/AdShortsAIBot?start=pricing_ultra_en`

5. **`landing_cta_en`** - Кнопка в конце страницы (CTA блок)
   - Текст: "Start Free"
   - URL: `https://t.me/AdShortsAIBot?start=landing_cta_en`

---

## Другие страницы

### Русская версия
- **`landing`** - Используется в футерах:
  - `terms-of-use/index.html`
  - `terms/index.html`
  - `privacy/index.html`
  - `data-deletion.html`
  - URL: `https://t.me/AdShortsAIBot?start=landing`

### Английская версия
- **`landing_en`** - Используется в футерах:
  - `en/terms-of-use/index.html`
  - `en/terms/index.html`
  - `en/privacy/index.html`
  - URL: `https://t.me/AdShortsAIBot?start=landing_en`

---

## Итого: 12 уникальных меток

### Русская версия (6 меток):
1. `landing_hero`
2. `pricing_free`
3. `pricing_pro`
4. `pricing_ultra`
5. `landing_cta`
6. `landing`

### Английская версия (6 меток):
1. `landing_hero_en`
2. `pricing_free_en`
3. `pricing_pro_en`
4. `pricing_ultra_en`
5. `landing_cta_en`
6. `landing_en`

---

## Формат использования в боте

Все метки передаются как параметр `start` в команде `/start`:

```
/start landing_hero
/start pricing_free
/start pricing_pro
/start pricing_ultra
/start landing_cta
/start landing

/start landing_hero_en
/start pricing_free_en
/start pricing_pro_en
/start pricing_ultra_en
/start landing_cta_en
/start landing_en
```

Бот должен обрабатывать эти параметры и показывать соответствующие сообщения (см. `bot-messages.md`).
