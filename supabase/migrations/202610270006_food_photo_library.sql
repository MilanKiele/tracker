create table public.food_photo_library (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  storage_path text not null unique,
  label text not null default 'Essensfoto' check (char_length(label) <= 140),
  created_at timestamptz not null default now()
);

alter table public.food_photo_library enable row level security;
create policy food_photo_library_owner on public.food_photo_library
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create index food_photo_library_user_created_idx
  on public.food_photo_library(user_id, created_at desc);
grant select, insert, update, delete on public.food_photo_library to authenticated;

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('food-photo-library', 'food-photo-library', false, 5242880, array['image/jpeg'])
on conflict (id) do update set
  name = excluded.name,
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='food_photo_library_select') then
    execute 'create policy food_photo_library_select on storage.objects for select to authenticated using (bucket_id = ''food-photo-library'' and (storage.foldername(name))[1] = auth.uid()::text)';
  end if;
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='food_photo_library_insert') then
    execute 'create policy food_photo_library_insert on storage.objects for insert to authenticated with check (bucket_id = ''food-photo-library'' and (storage.foldername(name))[1] = auth.uid()::text)';
  end if;
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='food_photo_library_delete') then
    execute 'create policy food_photo_library_delete on storage.objects for delete to authenticated using (bucket_id = ''food-photo-library'' and (storage.foldername(name))[1] = auth.uid()::text)';
  end if;
end $$;
