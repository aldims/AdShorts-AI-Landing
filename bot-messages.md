# Сообщения бота после /start для всех точек входа

## Русская версия (RU)

### landing_hero (Главная кнопка в hero-секции)
```
🎬 Добро пожаловать в AdShorts AI!

Создавайте вертикальные видео для Shorts, Reels и TikTok за 1 минуту — автоматически.

✨ Что вы получите:
• Сценарий с цепляющим хуком
• Субтитры с подсветкой слов
• Озвучка (мужской/женский голос)
• Музыка под настроение
• Видеофон по теме

🚀 Начните прямо сейчас — у вас есть 1 бесплатный Shorts!

Просто напишите тему вашего ролика, и я создам готовое видео.
```

### pricing_free (Кнопка Free тарифа)
```
🎁 Бесплатный тариф

У вас есть 1 Shorts для знакомства с платформой.

📝 Особенности:
• С водяным знаком
• Все функции доступны
• Готово к публикации

💡 После использования бесплатного Shorts вы сможете выбрать тариф Pro или Ultra для создания видео без водяного знака.

Напишите тему вашего первого видео, и я создам его прямо сейчас!
```

### pricing_pro (Кнопка Pro тарифа)
```
⭐ Тариф Pro — для регулярного контента

25 видео в месяц за 1 490 ₽
~60 ₽ за видео

✅ Преимущества:
• Без водяного знака
• Все функции платформы
• Идеально для регулярного контента

💳 Чтобы активировать тариф, выберите его в меню "Тарифы" и оплатите через Telegram Stars.

После активации вы сможете создавать до 25 видео в месяц!

Напишите тему вашего видео, чтобы начать.
```

### pricing_ultra (Кнопка Ultra тарифа)
```
🔥 Тариф Ultra — максимум видео по лучшей цене

100 видео в месяц за 4 990 ₽
~50 ₽ за видео

✅ Преимущества:
• Без водяного знака
• Лучшая цена за видео
• Максимум возможностей

💳 Чтобы активировать тариф, выберите его в меню "Тарифы" и оплатите через Telegram Stars.

После активации вы сможете создавать до 100 видео в месяц!

Напишите тему вашего видео, чтобы начать.
```

### landing_cta (Кнопка в конце страницы)
```
🎬 Готовы создать свой первый ролик?

AdShorts AI создаст для вас готовое вертикальное видео за 1 минуту:

✨ Сценарий с сильным хуком
✨ Субтитры с подсветкой слов
✨ Профессиональная озвучка
✨ Музыка и видеофон

🚀 У вас есть 1 бесплатный Shorts для старта!

Просто напишите тему вашего ролика, и я создам готовое видео прямо сейчас.
```

---

## Английская версия (EN)

### landing_hero_en (Main button in hero section)
```
🎬 Welcome to AdShorts AI!

Create vertical videos for Shorts, Reels, and TikTok in 1 minute — automatically.

✨ What you'll get:
• Script with a strong hook
• Subtitles with word highlighting
• Voiceover (male/female voice)
• Music matching the mood
• Video background by topic

🚀 Start right now — you have 1 free Short!

Just write the topic of your video, and I'll create a ready video for you.
```

### pricing_free_en (Free plan button)
```
🎁 Free Plan

You have 1 Short to try the platform.

📝 Features:
• With watermark
• All features available
• Ready to publish

💡 After using your free Short, you can choose Pro or Ultra plan to create videos without watermark.

Write the topic of your first video, and I'll create it right now!
```

### pricing_pro_en (Pro plan button)
```
⭐ Pro Plan — for regular content

25 videos/month for 1,200 ⭐ (~$24)
~$0.96 per video

✅ Benefits:
• No watermark
• All platform features
• Perfect for regular content

💳 To activate the plan, select it in the "Pricing" menu and pay with Telegram Stars.

After activation, you'll be able to create up to 25 videos per month!

Write the topic of your video to get started.
```

### pricing_ultra_en (Ultra plan button)
```
🔥 Ultra Plan — maximum videos, best price

100 videos/month for 3,500 ⭐ (~$70)
~$0.70 per video

✅ Benefits:
• No watermark
• Best price per video
• Maximum possibilities

💳 To activate the plan, select it in the "Pricing" menu and pay with Telegram Stars.

After activation, you'll be able to create up to 100 videos per month!

Write the topic of your video to get started.
```

### landing_cta_en (CTA button at the end of page)
```
🎬 Ready to create your first video?

AdShorts AI will create a ready vertical video for you in 1 minute:

✨ Script with a strong hook
✨ Subtitles with word highlighting
✨ Professional voiceover
✨ Music and video background

🚀 You have 1 free Short to start!

Just write the topic of your video, and I'll create a ready video right now.
```

---

## Примечания

- Все сообщения должны быть настроены в боте для обработки параметров `start` из `data-tg-start`
- Параметры передаются как: `/start landing_hero`, `/start pricing_free`, и т.д.
- Бот должен определять язык пользователя и показывать соответствующее сообщение
- После приветственного сообщения бот должен быть готов к приему темы видео
