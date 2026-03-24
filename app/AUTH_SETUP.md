# AdShorts AI Auth Setup

Локальная app-версия уже поддерживает:

- email/password sign up
- email verification
- sign in / sign out
- route protection для `/app`
- Google auth hook
- dev preview писем через Ethereal, если SMTP не настроен

Рабочие URL:

- app: `http://127.0.0.1:4174/`
- auth backend: `http://127.0.0.1:4175/`
- Google callback: `http://127.0.0.1:4174/api/auth/callback/google`

## 1. Email verification через SMTP

Если нужен реальный email, а не Ethereal preview, заполни в `app/.env`:

```env
SMTP_HOST=
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASS=
SMTP_FROM=AdShorts AI <no-reply@adshorts.ai>
```

После этого перезапусти:

```bash
cd app
npm run dev
```

Пока SMTP пустой, письма приходят в dev preview:

- `GET /api/auth/dev/last-email`

## 2. Google sign-in

Что уже готово в коде:

- backend provider config: `app/server/auth.ts`
- frontend button и flow: `app/src/components/AuthModal.tsx`

Что нужно сделать в Google Cloud:

1. Открыть Google Cloud Console.
2. Создать или выбрать project.
3. Открыть `Google Auth Platform` / `Branding`.
4. Заполнить app name, support email и основные branding fields.
5. Открыть `Clients`.
6. Нажать `Create client`.
7. Выбрать `Web application`.
8. В `Authorized JavaScript origins` добавить:
   - `http://127.0.0.1:4174`
9. В `Authorized redirect URIs` добавить:
   - `http://127.0.0.1:4174/api/auth/callback/google`
10. Скопировать `Client ID` и `Client Secret`.

Добавить в `app/.env`:

```env
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
```

Потом перезапустить:

```bash
cd app
npm run dev
```

Проверка:

- `GET http://127.0.0.1:4174/api/auth/status`
- там `googleEnabled` должен стать `true`

## 3. Telegram sign-in

Здесь важная граница:

- официальный Telegram doc, который удалось подтвердить, описывает `Telegram Login Widget`
- он работает через bot + `/setdomain` в `@BotFather`
- Telegram возвращает `id`, `first_name`, `last_name`, `username`, `photo_url`, `auth_date`, `hash`
- сервер должен проверять `hash` через HMAC-SHA256 с секретом на основе bot token

Это **не выглядит как обычный Google-style OAuth setup с понятными client ID / client secret в официальной документации**.

Поэтому:

- email verification и Google можно довести до production уже сейчас
- Telegram лучше делать отдельным следующим шагом через **официальный Telegram Login Widget flow**

Что потребуется для Telegram:

1. Создать bot через `@BotFather`
2. Настроить bot name / avatar
3. Выполнить `/setdomain`
4. Привязать production domain сайта
5. Реализовать серверную проверку `hash` из Telegram login payload
6. После верификации payload создавать или находить пользователя и открывать app session

Для localhost Telegram-логин обычно неудобен, потому что он завязан на domain linking.

## 4. Полезные env поля

Минимум для auth-системы, если Better Auth должен жить в той же БД, что и бот/FastAPI:

```env
APP_URL=http://127.0.0.1:4174
BETTER_AUTH_URL=http://127.0.0.1:4174
BETTER_AUTH_SECRET=...
AUTH_SERVER_PORT=4175
AUTH_DATABASE_PATH=../../AdsFlow AI/adsflow.db
AUTH_LEGACY_DATABASE_PATH=./data/auth.sqlite
```

Если у бота на сервере не SQLite, а PostgreSQL, вместо `AUTH_DATABASE_PATH` используйте `AUTH_DATABASE_URL=postgresql://...`.

## 5. Команды

Поднять web + auth:

```bash
cd app
npm run dev
```

Сборка:

```bash
cd app
npm run build
```

Миграции Better Auth:

```bash
cd app
npm run auth:migrate
```

Перенос старых веб-пользователей из локального `auth.sqlite` в shared DB:

```bash
cd app
npm run auth:sync-legacy
```

## 6. Что уже проверено локально

- signup создает пользователя в SQLite
- verification email генерируется
- до подтверждения вход блокируется с `EMAIL_NOT_VERIFIED`
- `/app` защищен сессией
