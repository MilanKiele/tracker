alter table public.meal_entries
  add column if not exists review_status text not null default 'approved'
    check (review_status in ('pending','approved','denied')),
  add column if not exists archived_at timestamptz;

create table if not exists public.notification_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  push_enabled boolean not null default false,
  missed_workout_enabled boolean not null default false,
  reminder_enabled boolean not null default false,
  reminder_time time not null default '08:00',
  timezone text not null default 'UTC',
  quiet_hours_start time,
  quiet_hours_end time,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth_secret text not null,
  device_label text,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique(user_id, endpoint)
);

create table if not exists public.notification_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_key text not null,
  title text not null,
  body text not null,
  url text not null default '/',
  scheduled_for timestamptz,
  sent_at timestamptz,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  unique(user_id, event_key)
);

alter table public.notification_settings enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.notification_events enable row level security;
create policy notification_settings_owner on public.notification_settings for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy push_subscriptions_owner on public.push_subscriptions for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy notification_events_owner on public.notification_events for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create index if not exists notification_events_user_date_idx on public.notification_events(user_id, created_at desc);
create index if not exists push_subscriptions_user_seen_idx on public.push_subscriptions(user_id, last_seen_at desc);
create index if not exists meals_user_review_idx on public.meal_entries(user_id, review_status, entry_date);
