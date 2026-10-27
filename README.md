# Everwell

A private, mobile-friendly wellness tracker built with Next.js 16, Supabase Auth and Postgres. The Today, Train, Nutrition, Body, Insights, and Account pages read the signed-in user's own records. New accounts start with empty libraries and history; the app does not populate example meals, workouts, or measurements.

## Local setup

1. Install Node.js dependencies with `npm install`.
2. Copy `.env.example` to `.env.local` and set `NEXT_PUBLIC_SUPABASE_URL` plus `NEXT_PUBLIC_SUPABASE_ANON_KEY` (a Supabase publishable key also works as `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`). These are the browser-safe Auth credentials. Never put a service-role key in a `NEXT_PUBLIC_` variable.
3. Apply every SQL migration in `supabase/migrations/` in order, from the Supabase SQL Editor or with the Supabase CLI (`supabase link` then `supabase db push`). Migrations create the per-user schema and RLS policies, review/notification tables, and disable the old signup template seeder. Migration 003 removes untouched default plans and unused sample food/exercise catalog rows while preserving diary and workout history.
4. Start the app with `npm run dev` and open `http://localhost:3000`.

## Vercel and Supabase

Set the same `NEXT_PUBLIC_SUPABASE_URL` and either `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` or `NEXT_PUBLIC_SUPABASE_ANON_KEY` in Vercel's Production, Preview, and Development environments, then redeploy. If the Vercel project is linked locally, `vercel env pull .env.local` can sync configured variables. Keep Supabase's service-role key server-only; the regular app and user actions run with the user's authenticated session and RLS.

## Push reminders

The app is a PWA: it has a web manifest, install icons, an offline fallback, a service worker, and a mobile install prompt. Push reminders require a secure origin (HTTPS in production; localhost is allowed during development), the SQL migrations, and VAPID keys.

1. Generate a VAPID key pair using `npx web-push generate-vapid-keys`.
2. Set `NEXT_PUBLIC_VAPID_PUBLIC_KEY` and `VAPID_PUBLIC_KEY` to the public key, `VAPID_PRIVATE_KEY` to the private key, and `VAPID_SUBJECT` to a `mailto:` contact. Only the `NEXT_PUBLIC_` public key goes to the browser.
3. Set a random `CRON_SECRET` and `SUPABASE_SERVICE_ROLE_KEY` in Vercel. The service-role key is used only by the scheduled reminder route; it bypasses RLS and must remain secret.
4. The included Vercel Cron calls `/api/notifications/reminders` once per day at 07:00 UTC in production. It sends opted-in daily check-ins and missed planned-workout reminders, respects quiet hours, and records notification history. On Hobby, Vercel may invoke the job within the scheduled hour (±59 minutes); the saved per-user reminder time is a preference but cannot be honored exactly with one daily run. Use Pro or an external scheduler for more frequent or precise per-user delivery. Cron runs on production deployments; preview/local environments do not run the schedule automatically.
5. Users must install the app where required by their mobile browser, grant notification permission, and enable reminders in **Account → Push notifications**. Browser and operating-system notification settings can still block delivery.

## What is stored

- Today: selected week/day, training-plan day, actual/planned meals, pending manual food approvals, measurements, journal notes, and water entries.
- Train: personal exercise library, editable plans and plan days, session/set logs, volume, and estimated one-rep-max records.
- Nutrition: per-100 g food library, dated meals, approval state, targets, and diary export.
- Body: profile values, dated measurements, editable goals, and milestones.
- Insights: session consistency, completed training volume, approved nutrition, target history, sleep, mood, hydration, and body measurements over a selected date range.
- Account: editable profile and target history, push preferences/devices, notification history, sign out, and CSV export.

All app data is scoped to the signed-in user, with server-side ownership checks and Supabase row-level security. Nutrition targets are estimates based on the profile and the Mifflin–St Jeor formula; users can set manual targets.
