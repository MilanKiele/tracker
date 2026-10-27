alter table public.meal_entries
  add column if not exists meal_time time;

alter table public.meal_plan_templates
  add column if not exists meal_time time;

create or replace function public.import_food_draft(p_mutation_id uuid, p_foods jsonb, p_date date, p_slot text, p_destination text) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare uid uuid := auth.uid(); f jsonb; fid uuid; g numeric; previous jsonb; result jsonb;
begin
  if uid is null then raise exception 'Nicht angemeldet'; end if;
  if p_destination not in ('diary','calendar','library') or p_slot not in ('breakfast','lunch','dinner','snack') then raise exception 'Ungültiges Ziel'; end if;
  if jsonb_array_length(p_foods) not between 1 and 12 then raise exception 'Ungültige Speisen'; end if;
  perform pg_advisory_xact_lock(hashtextextended(uid::text || p_mutation_id::text,0));
  select m.result into previous from public.app_mutations m where user_id=uid and mutation_id=p_mutation_id;
  if previous is not null then return previous; end if;
  for f in select * from jsonb_array_elements(p_foods) loop
    g := (f->>'grams')::numeric;
    if g <= 0 or g > 5000 then raise exception 'Ungültige Portion'; end if;
    insert into public.foods(user_id,name,category,kcal,protein_g,carbs_g,fat_g,fiber_g,sugar_g,salt_g,serving_grams,source)
    values(uid,left(f->>'name',140),'Gericht',(f->>'kcal')::numeric*100/g,(f->>'protein_g')::numeric*100/g,(f->>'carbs_g')::numeric*100/g,(f->>'fat_g')::numeric*100/g,(f->>'fiber_g')::numeric*100/g,(f->>'sugar_g')::numeric*100/g,(f->>'salt_g')::numeric*100/g,g,'KI-Schätzung · OpenRouter')
    on conflict(user_id,name) do update set archived_at=null returning id into fid;
    if p_destination <> 'library' then
      insert into public.meal_entries(user_id,entry_date,meal_slot,meal_time,food_id,name,amount_grams,kcal,protein_g,carbs_g,fat_g,fiber_g,sugar_g,salt_g,is_planned,review_status,notes)
      values(uid,p_date,p_slot,nullif(f->>'meal_time','')::time,fid,left(f->>'name',140),g,(f->>'kcal')::numeric,(f->>'protein_g')::numeric,(f->>'carbs_g')::numeric,(f->>'fat_g')::numeric,(f->>'fiber_g')::numeric,(f->>'sugar_g')::numeric,(f->>'salt_g')::numeric,p_destination='calendar','approved','KI-Schätzung · ' || coalesce(f->>'notes',''));
    end if;
  end loop;
  result:=jsonb_build_object('count',jsonb_array_length(p_foods));
  insert into public.app_mutations(user_id,mutation_id,kind,result) values(uid,p_mutation_id,'food',result);
  return result;
end $$;
revoke all on function public.import_food_draft(uuid,jsonb,date,text,text) from public,anon;
grant execute on function public.import_food_draft(uuid,jsonb,date,text,text) to authenticated;
