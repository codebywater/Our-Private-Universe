# Our Private Universe

A private, cinematic memory archive for exactly two people: photo memories, a timeline, and letters that stay sealed until a chosen date. Self-hosted on your own Supabase and Vercel accounts.

> The interface language is **Russian**. All texts live in the components and `lib/site-config.ts`; the README below is in English first, with the original Russian setup guide kept underneath.

**Stack:** Next.js (App Router) · React · TypeScript strict · Tailwind 4 · Framer Motion · Supabase (Auth, Postgres, Storage) · Zod.

## Features
- Home page with a live "time together" counter (calendar arithmetic in your timezone).
- Memories: multi-photo upload, private storage, signed URLs, filters by year/category, lightbox.
- Timeline of events, with optional photos.
- Letters with a **server-enforced time lock** (Postgres RLS + functions, not just UI).
- Two-user allowlist (a DB trigger caps it at two), no public sign-up, RLS on every table, no `service_role` in the app.

## Quick start
1. Create a Supabase project. Run `supabase/migrations/*.sql` in order (SQL Editor or `supabase db push`).
2. Auth → Providers → Email: enable, and **disable** "Allow new users to sign up". Create two users with a password (Auto Confirm).
3. Put their emails and display names into `supabase/add_allowed_users.sql` and run it once in the SQL Editor.
4. `cp .env.example .env.local`, fill in the Supabase URL and publishable key (never the `service_role` key).
5. Personalize `lib/site-config.ts`: names, monogram, the two dates, optional photos. Keep the seed date in `supabase/migrations/20261012000003_seed_timeline.sql` in sync with `meetingDate`.
6. `npm install && npm run dev`, then deploy to Vercel with the same env vars.

## Scripts
`npm run dev|build|start`, `npm run lint`, `npm run typecheck`, `npm test` (unit), `npm run test:db` (RLS tests on PGlite with a Supabase emulation, not a live project).

## Security notes
Access = valid session **and** a row in `allowed_users`, checked on the server for every private page and action. See "Как устроена защита" below. Please report vulnerabilities privately rather than in public issues. Known limits: the in-app login rate limit is per-process and approximate (rely on Supabase Auth limits); nothing here has been verified against a live Supabase project by the template author's automated tests.

## License
MIT. See `LICENSE`.

---

# Руководство на русском

## Что нужно настроить вручную



### 1. Supabase

1. Создайте проект на supabase.com.
2. **SQL Editor** → выполните по порядку файлы из `supabase/migrations/`:
   `20261012000001_core_schema.sql`, `20261012000002_storage.sql`, `20261012000003_seed_timeline.sql`
   (или `supabase db push`, если используете CLI).
3. **Authentication → Providers → Email**: включите Email, **выключите** «Allow new users to sign up».
4. **Authentication → URL Configuration**: Site URL = адрес сайта; Redirect URLs: `http://localhost:3000/**` и `https://ВАШ-ДОМЕН/**`.
5. **Authentication → Policies / Password**: задайте минимальную длину пароля 12+ символов и включите проверку утёкших паролей (если доступно в вашем тарифе).
6. **Authentication → Rate Limits**: оставьте низкие лимиты на вход. Это основная защита от подбора пароля; встроенный лимит приложения дополнительный и приблизительный (память процесса).
7. Storage: бакет `memories` создаётся миграцией (приватный, лимит 15 МБ, только изображения).

### 2. Два аккаунта

1. **Authentication → Users → Add user → Create new user**: создайте двух пользователей (email и пароль каждого из вас двоих, отметьте «Auto Confirm User»). Пароли задаёте только вы, в чат и в репозиторий их не вставляйте.
2. В `supabase/add_allowed_users.sql` подставьте их email и имена и выполните в SQL Editor. Больше двух записей триггер не позволит; клиент не может менять allowlist.

### 3. Переменные окружения

`cp .env.example .env.local` и заполните URL и publishable-ключ. `service_role` не используется и не должен попадать в `NEXT_PUBLIC_*`.

### 4. Запуск

```bash
npm install
npm run dev
```

### 5. Деплой на Vercel

Импортируйте репозиторий, добавьте переменные из `.env.example`, задеплойте. Обновите Site URL и Redirect URLs в Supabase на боевой домен.

## Команды

| Команда | Что делает |
| --- | --- |
| `npm run dev` / `build` / `start` | разработка / сборка / запуск |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | unit-тесты (счётчик, даты, редиректы, сигнатуры файлов, лимиты) |
| `npm run test:db` | тесты RLS/функций на PGlite с эмуляцией Supabase |

## Как устроена защита

- Доступ = сессия **и** запись в `allowed_users` (проверяется на сервере на каждой приватной странице и в каждом действии; `proxy.ts` лишь обновляет сессию).
- RLS на всех таблицах. Письмо до `open_at` не отдаётся получателю: политика SELECT требует `status='sent'` и наступившую дату; список запечатанных — функция, возвращающая только отправителя и дату; открытие — функция `open_letter` с проверкой времени БД.
- Автор, получатель и статус письма не принимаются от клиента (strict-схема Zod + триггер).
- Загрузки: подписанные URL, путь выбирает сервер, сервер проверяет сигнатуру, размер и превью, при ошибке удаляет файлы; бакет приватный, просмотр — только по временным ссылкам.
- Логи не содержат текстов писем, токенов и email.

## Безопасное обновление

1. Новые изменения схемы — только новым файлом в `supabase/migrations/` (старые не правьте).
2. Проверьте локально: `npm run lint && npm run typecheck && npm test && npm run test:db && npm run build`.
3. Сначала примените миграцию, затем деплойте код. Делайте бэкап (Supabase → Database → Backups) перед разрушающими изменениями.

## Известные ограничения

- Не проверено на живом Supabase: реальная отправка писем, загрузка в Storage, подписанные URL, поведение в браузере. Проверены логика и политики (unit- и PGlite-тесты) и сборка.
- Лимит запросов на вход в приложении хранится в памяти и на serverless приблизителен; опирайтесь на лимиты Supabase Auth.
- Типы БД (`types/database.ts`) написаны вручную; после изменения схемы обновите их (или сгенерируйте `supabase gen types`).
- HEIC не поддерживается (сохраните как JPEG).
