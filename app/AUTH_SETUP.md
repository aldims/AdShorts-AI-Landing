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

## 3. Telegram sign-in (OIDC)

Текущий код открывает Telegram OIDC popup и получает `id_token`, который:

- Запускается из кнопки в модальном окне авторизации
- Возвращает `id_token` с данными пользователя
- Сервер проверяет JWT через Telegram JWKS, `iss`, `aud`, `exp`, `iat` и `nonce`

### Настройка:

1. Создайте бота через `@BotFather`: `/newbot`
2. Откройте настройки Web Login и скопируйте Client ID
3. В BotFather откройте `Bot Settings` → `Web Login` и добавьте:
   - Redirect URI для dev: `http://127.0.0.1:4174/api/auth/telegram/oidc/callback`
   - Trusted Origin для dev: `http://127.0.0.1:4174`
   - Для production: production origin и callback/redirect URL
4. Добавьте в `app/.env`:

```env
TELEGRAM_BOT_ID=123456789
TELEGRAM_CLIENT_SECRET=client-secret-from-botfather
TELEGRAM_BOT_USERNAME=YourBotName
```

Client Secret хранится только на backend и нужен для стандартного OIDC Authorization Code Flow с обменом `code` на токены через `/token`. В браузер он не отправляется.

5. Перезапустите сервер:

```bash
cd app
npm run dev
```

### Проверка:

- `GET http://127.0.0.1:4174/api/auth/status` — `telegramEnabled: true`
- `GET http://127.0.0.1:4174/api/auth/telegram/config` — `botId: "123456789"`, `botUsername: "YourBotName"`, `authorizationUrl` содержит `redirect_uri`

`telegramEnabled` становится `true` только когда заданы оба значения: `TELEGRAM_BOT_ID` и `TELEGRAM_CLIENT_SECRET`. Если задан только bot id, кнопка Telegram не включается, потому что OIDC code flow не сможет корректно передать `redirect_uri`.

### Как это работает:

1. В модальном окне авторизации появляется кнопка Telegram
2. Пользователь нажимает кнопку и авторизуется в Telegram
3. Telegram возвращает `code` на `/api/auth/telegram/oidc/callback`
4. Сервер обменивает `code` на `id_token`, верифицирует JWT и создаёт/связывает пользователя
5. Сервер устанавливает session cookie и возвращает успех в popup

### Важно:

- Для localhost (`127.0.0.1`) Telegram OIDC работает, но домен должен быть добавлен в BotFather
- `id` из Telegram — это уникальный числовой идентификатор пользователя
- Email генерируется как `telegram-{id}@users.adshorts.local` (фейковый, для внутреннего использования)

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
