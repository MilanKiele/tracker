# Everwell

A mobile-first strength, nutrition and body-progress tracker built with Next.js 16 App Router, TypeScript, Tailwind CSS, Supabase, Zod, Recharts, date-fns and lucide-react. The default screens include Today, Train, Nutrition, Body and Insights, plus email/password auth and a two-minute profile onboarding flow. The visual screens are previewable before connecting Supabase; saving user data requires the Supabase setup below.

## Local setup

1. Use Node.js 20 or newer and install packages with `npm install`.
2. Create a Supabase project. In **Project Settings → API**, copy the project URL and publishable (or anon) key into `.env.local`:

   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-publishable-key
   NEXT_PUBLIC_SITE_URL=http://localhost:3000
   ```

   `.env.example` contains placeholders only. Never put a service-role key in a `NEXT_PUBLIC_` variable or client code.
3. Apply `supabase/migrations/202610270001_initial_schema.sql` from the Supabase SQL Editor, or with the Supabase CLI after linking the project (`supabase link`, then `supabase db push`). The migration adds private per-user tables, row-level security, indexes, a signup seed trigger, 50 machine/cable-first exercises, 10 USDA reference foods and two editable PPL plans.
4. In **Authentication → Providers → Email**, keep email/password enabled. To let friends start without confirming email, turn off **Confirm email**. If confirmation remains enabled, new users receive a confirmation email first. Set the app URL and redirect URLs to your local/deployed origin in **Authentication → URL Configuration**.
5. Run `npm run dev`. Use `/register` to create your account and complete onboarding. Add the same URL and anon/publishable key as deployment environment variables for production.

## Add a friend

Give your friend the deployed app URL. They register with their own email/password and get a separate profile, exercise library, foods and two starter plans. RLS enforces `user_id = auth.uid()` on every application table; accounts do not share training or health history. The project does not expose a service-role key or share-by-code flow.

## Data and privacy

- `profiles` stores onboarding details. The server action estimates a daily energy target with Mifflin–St Jeor, activity factor and goal adjustment, then stores the calculation and a baseline weigh-in.
- Training history, plans, foods, planned/actual meal entries, target history, measurements/goals, journal, water and private photo paths are represented in the migration.
- Profile, food and measurement mutations validate input with Zod and execute as authenticated Server Actions. The session proxy refreshes Supabase cookies and redirects signed-out traffic to `/login` when project credentials are configured.
- PWA support includes a web manifest, 192/512 icons, a registered service worker and a generic offline page. The worker caches static assets only; it does not keep private health pages in browser cache.
- Optional progress photo files should be stored in a private Supabase Storage bucket with a per-user path such as `<auth.uid()>/<uuid>.jpg`; signed URLs should be short-lived. The migration stores photo metadata and paths but does not create the Storage bucket policy.

## Nutrition reference values

Seed-food macros are per 100 g and based on USDA FoodData Central reference foods, including oats (FDC 173904) and raw bananas (FDC 173944). Food composition varies by brand, preparation and portion; users can edit personal entries. The reference rows are linked directly in the seed metadata by USDA FoodData Central IDs (including chicken 171477, quinoa 168917, blueberries 171711, egg 173424, brown rice 169704, oats 173904 and banana 173944). Browse [USDA FoodData Central](https://fdc.nal.usda.gov/) or verify selected records for [chicken](https://whatyoueat.io/foods/171477), [quinoa](https://youcal.app/calories-in/cooked-quinoa/), [oats](https://www.wtfgyms.com/nutrition/oats), [egg](https://nutritiondatahub.com/food/egg-whole-cooked-hard-boiled-173424) and [banana](https://whatyoueat.io/foods/173944-bananas).

## Current scope

The project is an initial full-stack foundation and interactive UI preview, not a finished hosted service. The schema and auth/profile/meal/measurement server actions are prepared. Several tracker controls currently use in-memory preview values and need to be wired to the listed tables before they persist across devices. The `database.types.ts` boundary is a placeholder until the project is linked; generate exact Supabase types after applying the migration:

```sh
npx supabase gen types typescript --project-id YOUR_PROJECT_REF > src/lib/supabase/database.types.ts
```

Run `npm run build` and `npm run lint` before deploying.
