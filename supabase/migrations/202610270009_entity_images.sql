-- Private images for user-owned food, meal, exercise, and training records.
alter table public.foods add column if not exists image_path text;
alter table public.recipes add column if not exists image_path text;
alter table public.meal_entries add column if not exists image_path text;
alter table public.meal_plan_templates add column if not exists image_path text;
alter table public.exercises add column if not exists image_path text;
alter table public.training_plans add column if not exists image_path text;
alter table public.plan_days add column if not exists image_path text;

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('entity-images', 'entity-images', false, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set
  name = excluded.name,
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='entity_images_select') then
    create policy entity_images_select on storage.objects for select to authenticated
      using (bucket_id = 'entity-images' and (storage.foldername(name))[1] = auth.uid()::text);
  end if;
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='entity_images_insert') then
    create policy entity_images_insert on storage.objects for insert to authenticated
      with check (bucket_id = 'entity-images' and (storage.foldername(name))[1] = auth.uid()::text);
  end if;
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='entity_images_update') then
    create policy entity_images_update on storage.objects for update to authenticated
      using (bucket_id = 'entity-images' and (storage.foldername(name))[1] = auth.uid()::text)
      with check (bucket_id = 'entity-images' and (storage.foldername(name))[1] = auth.uid()::text);
  end if;
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='entity_images_delete') then
    create policy entity_images_delete on storage.objects for delete to authenticated
      using (bucket_id = 'entity-images' and (storage.foldername(name))[1] = auth.uid()::text);
  end if;
end $$;
