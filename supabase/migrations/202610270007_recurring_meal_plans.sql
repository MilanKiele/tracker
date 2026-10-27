create table if not exists public.meal_plan_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  weekday integer not null check (weekday between 0 and 6),
  meal_slot text not null check (meal_slot in ('breakfast','lunch','dinner','snack')),
  name text not null check (char_length(name) between 1 and 140),
  amount_grams numeric(8,2) not null check (amount_grams > 0),
  kcal numeric(8,2) not null default 0 check (kcal >= 0),
  protein_g numeric(7,2) not null default 0 check (protein_g >= 0),
  carbs_g numeric(7,2) not null default 0 check (carbs_g >= 0),
  fat_g numeric(7,2) not null default 0 check (fat_g >= 0),
  active_from date not null default current_date,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.meal_plan_templates enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='meal_plan_templates' and policyname='meal_plan_templates_owner') then
    create policy meal_plan_templates_owner on public.meal_plan_templates
      for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
  end if;
end $$;
create index if not exists meal_plan_templates_user_weekday_idx
  on public.meal_plan_templates(user_id, weekday) where is_active;

create table if not exists public.meal_plan_template_skips (
  user_id uuid not null references auth.users(id) on delete cascade,
  template_id uuid not null references public.meal_plan_templates(id) on delete cascade,
  entry_date date not null,
  created_at timestamptz not null default now(),
  primary key (user_id, template_id, entry_date)
);
alter table public.meal_plan_template_skips enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='meal_plan_template_skips' and policyname='meal_plan_template_skips_owner') then
    create policy meal_plan_template_skips_owner on public.meal_plan_template_skips
      for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
  end if;
end $$;
grant select, insert, update, delete on public.meal_plan_template_skips to authenticated;

alter table public.meal_entries
  add column if not exists source_template_id uuid references public.meal_plan_templates(id) on delete set null;
create unique index if not exists meal_entries_template_date_idx
  on public.meal_entries(user_id, source_template_id, entry_date)
  where source_template_id is not null;

grant select, insert, update, delete on public.meal_plan_templates to authenticated;
