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

## 3. Telegram sign-in (Telegram Login Widget)

Telegram не поддерживает стандартный OAuth — вместо него используется **Telegram Login Widget**, который:

- Встраивается как iframe на странице авторизации
- Возвращает подписанные данные: `id`, `first_name`, `last_name`, `username`, `photo_url`, `auth_date`, `hash`
- Сервер проверяет `hash` через HMAC-SHA256 (секрет = SHA256 от bot token)

### Настройка:

1. Создайте бота через `@BotFather`: `/newbot`
2. Скопируйте токен бота (формат: `123456789:ABCdefGHI...`)
3. В BotFather откройте `Bot Settings` → `Domain` → добавьте домен:
   - Для dev: `127.0.0.1` (без http://)
   - Для production: `adshortsai.com`
4. Добавьте в `app/.env`:

```env
TELEGRAM_BOT_USERNAME=YourBotName
TELEGRAM_BOT_TOKEN=123456789:ABCdefGHI...
```

5. Перезапустите сервер:

```bash
cd app
npm run dev
```

### Проверка:

- `GET http://127.0.0.1:4174/api/auth/status` — `telegramEnabled: true`
- `GET http://127.0.0.1:4174/api/auth/telegram/config` — `botUsername: "YourBotName"`

### Как это работает:

1. На странице авторизации появляется Telegram Login Widget
2. Пользователь нажимает кнопку и авторизуется в Telegram
3. Telegram возвращает подписанные данные в JavaScript callback
4. Frontend отправляет данные на `/api/auth/telegram/callback`
5. Сервер верифицирует `hash` и создаёт/связывает пользователя
6. Сервер устанавливает session cookie и возвращает успех

### Важно:

- Для localhost (`127.0.0.1`) Telegram widget работает, но домен должен быть добавлен в BotFather
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
