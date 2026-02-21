# Дупките на Ловеч

Публична гражданска платформа за сигнализиране на дупки по пътищата в Ловеч. Сигналите стават видими на картата след потвърждение по имейл.

## Tech stack

- **Next.js 14** (App Router)
- **TypeScript**
- **TailwindCSS**
- **Leaflet** (карта)
- **Supabase** (база данни + хранилище за снимки)

## Локално пускане

1. Клонирайте репото и инсталирайте зависимости:

   ```bash
   npm install
   ```

2. Копирайте `.env.example` като `.env.local` и попълнете:

   - `NEXT_PUBLIC_SUPABASE_URL` – URL на Supabase проекта
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` – anon key
   - `SUPABASE_SERVICE_ROLE_KEY` – service role key (за сървърни заявки)
   - `NEXT_PUBLIC_APP_URL` – например `http://localhost:3000`
   - По избор: `RESEND_API_KEY` и `RESEND_FROM` за изпращане на имейли за потвърждение

3. В Supabase:

   - Създайте таблиците: в **SQL Editor** изпълнете `supabase/schema.sql`. След това в **Storage** създайте bucket `pothole-photos`.
   - В **Storage** създайте bucket `pothole-photos` с политика за публично четене (за показване на снимки) и upload чрез service role.

4. Стартирайте сървъра:

   ```bash
   npm run dev
   ```

5. Отворете [http://localhost:3000](http://localhost:3000).

## Деплой на Vercel

1. Качете проекта в GitHub и свържете го с Vercel.
2. В настройките на проекта добавете **Environment Variables** от `.env.example` (без да комитвате самите стойности).
3. За production задайте `NEXT_PUBLIC_APP_URL` на реалния домейн (напр. `https://dupkite-na-lovech.vercel.app`).
4. За автоматично изтриване на непотвърдени сигнали след 48 часа:
   - Добавете променлива `CRON_SECRET` (произволен таен низ).
   - В корена на проекта създайте `vercel.json`:

   ```json
   {
     "crons": [{ "path": "/api/cron/cleanup", "schedule": "0 * * * *" }]
   }
   ```

   Vercel ще извиква `/api/cron/cleanup` на всеки час. Ако сте задали `CRON_SECRET`, endpoint-ът очаква заглавка `Authorization: Bearer <CRON_SECRET>` (Vercel Cron го подава автоматично ако го конфигурирате).

## Структура на проекта

- `app/` – страници и API routes (App Router)
- `components/` – Map, ReportModal, MarkerPopup
- `app/verify/` – страница за потвърждение по линк от имейл
- `lib/` – Supabase клиент, типове, хеширане, SQL схема в коментари

## Важно

- Показват се **само потвърдени** сигнали (`verified = true`).
- Имейлът и токенът за потвърждение се съхраняват само като хеш.
- Лимит: 1 подаване на 5 минути на IP.
- Непотвърдени сигнали по-стари от 48 часа се изтриват от cron job-а.
