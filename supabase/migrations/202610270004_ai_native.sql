-- Additive upgrade of the existing project; no existing records are removed.
alter table public.meal_entries add column if not exists fiber_g numeric(7,2) check(fiber_g >= 0);
alter table public.meal_entries add column if not exists sugar_g numeric(7,2) check(sugar_g >= 0);
alter table public.meal_entries add column if not exists salt_g numeric(7,2) check(salt_g >= 0);
alter table public.plan_exercises add column if not exists duration_seconds integer check (duration_seconds between 5 and 3600);
alter table public.workout_sets add column if not exists duration_seconds integer check (duration_seconds between 0 and 86400);

create table public.app_mutations (
  user_id uuid not null references auth.users(id) on delete cascade,
  mutation_id uuid not null,
  kind text not null,
  result jsonb not null,
  created_at timestamptz not null default now(),
  primary key (user_id, mutation_id)
);
alter table public.app_mutations enable row level security;
create policy mutation_owner on public.app_mutations for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
revoke all on public.app_mutations from anon, authenticated;
grant select, insert on public.app_mutations to authenticated;

create table public.ai_daily_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  usage_date date not null,
  requests integer not null default 0,
  last_request_at timestamptz not null default now(),
  primary key (user_id, usage_date)
);
alter table public.ai_daily_usage enable row level security;
create policy usage_owner on public.ai_daily_usage for select to authenticated using (user_id = auth.uid());
revoke all on public.ai_daily_usage from anon, authenticated;
grant select on public.ai_daily_usage to authenticated;
revoke insert, update, delete on public.ai_daily_usage from anon, authenticated;

-- Serialize the quota for the shared key across Vercel instances. Failed upstream
-- calls count too. Only this function can increment the counter.
create function public.claim_ai_request() returns boolean language plpgsql security definer set search_path = '' as $$
declare uid uuid := auth.uid(); today date := (now() at time zone 'UTC')::date; own public.ai_daily_usage%rowtype;
begin
  if uid is null then raise exception 'Nicht angemeldet'; end if;
  perform pg_advisory_xact_lock(hashtextextended('everwell-ai-quota', 0));
  select * into own from public.ai_daily_usage where user_id = uid and usage_date = today;
  if coalesce(own.requests, 0) >= 30 or (own.last_request_at is not null and own.last_request_at > now() - interval '8 seconds') then return false; end if;
  if (select coalesce(sum(requests),0) from public.ai_daily_usage where usage_date = today) >= 45 then return false; end if;
  insert into public.ai_daily_usage(user_id,usage_date,requests) values(uid,today,1)
  on conflict(user_id,usage_date) do update set requests = public.ai_daily_usage.requests + 1, last_request_at = now();
  return true;
end $$;
revoke all on function public.claim_ai_request() from public, anon;
grant execute on function public.claim_ai_request() to authenticated;

-- A draft import is one transaction and is safe to retry with the same UUID.
create function public.import_plan_draft(p_mutation_id uuid, p_plan jsonb) returns jsonb language plpgsql security invoker set search_path = '' as $$
declare uid uuid := auth.uid(); pid uuid; did uuid; eid uuid; d jsonb; e jsonb; di int := 0; ei int; previous jsonb; result jsonb;
begin
  if uid is null then raise exception 'Nicht angemeldet'; end if;
  perform pg_advisory_xact_lock(hashtextextended(uid::text || p_mutation_id::text, 0));
  select m.result into previous from public.app_mutations m where user_id = uid and mutation_id = p_mutation_id;
  if previous is not null then return previous; end if;
  if jsonb_array_length(p_plan->'days') not between 1 and 7 then raise exception 'Ungültiger Plan'; end if;
  insert into public.training_plans(user_id,name,description) values(uid,left(p_plan->>'name',100),left(p_plan->>'description',800)) returning id into pid;
  for d in select * from jsonb_array_elements(p_plan->'days') loop
    di := di + 1;
    if jsonb_array_length(d->'exercises') not between 1 and 12 then raise exception 'Ungültige Übungen'; end if;
    insert into public.plan_days(user_id,plan_id,name,day_order,weekday) values(uid,pid,left(d->>'name',80),di,(d->>'weekday')::int) returning id into did;
    ei := 0;
    for e in select * from jsonb_array_elements(d->'exercises') loop
      ei := ei + 1;
      insert into public.exercises(user_id,name,primary_muscle,equipment,movement_type,notes)
      values(uid,left(e->>'name',100),left(e->>'muscle',60),left(e->>'equipment',60),coalesce(e->>'movement_type','free_weight'),left(e->>'notes',600))
      on conflict(user_id,name) do update set archived_at = null returning id into eid;
      insert into public.plan_exercises(user_id,day_id,exercise_id,exercise_order,target_sets,rep_min,rep_max,rest_seconds,duration_seconds,notes)
      values(uid,did,eid,ei,(e->>'sets')::int,(e->>'reps')::int,(e->>'reps')::int,(e->>'rest_seconds')::int,(e->>'duration_seconds')::int,left(e->>'notes',600));
    end loop;
  end loop;
  result := jsonb_build_object('plan_id',pid);
  insert into public.app_mutations(user_id,mutation_id,kind,result) values(uid,p_mutation_id,'plan',result);
  return result;
end $$;
revoke all on function public.import_plan_draft(uuid,jsonb) from public,anon;
grant execute on function public.import_plan_draft(uuid,jsonb) to authenticated;

create function public.import_food_draft(p_mutation_id uuid, p_foods jsonb, p_date date, p_slot text, p_destination text) returns jsonb language plpgsql security invoker set search_path = '' as $$
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
    -- Preserve existing user-edited library values on a name match.
    insert into public.foods(user_id,name,category,kcal,protein_g,carbs_g,fat_g,fiber_g,sugar_g,salt_g,serving_grams,source)
    values(uid,left(f->>'name',140),'Gericht',(f->>'kcal')::numeric*100/g,(f->>'protein_g')::numeric*100/g,(f->>'carbs_g')::numeric*100/g,(f->>'fat_g')::numeric*100/g,(f->>'fiber_g')::numeric*100/g,(f->>'sugar_g')::numeric*100/g,(f->>'salt_g')::numeric*100/g,g,'KI-Schätzung · OpenRouter')
    on conflict(user_id,name) do update set archived_at=null returning id into fid;
    if p_destination <> 'library' then
      insert into public.meal_entries(user_id,entry_date,meal_slot,food_id,name,amount_grams,kcal,protein_g,carbs_g,fat_g,fiber_g,sugar_g,salt_g,is_planned,review_status,notes)
      values(uid,p_date,p_slot,fid,left(f->>'name',140),g,(f->>'kcal')::numeric,(f->>'protein_g')::numeric,(f->>'carbs_g')::numeric,(f->>'fat_g')::numeric,(f->>'fiber_g')::numeric,(f->>'sugar_g')::numeric,(f->>'salt_g')::numeric,p_destination='calendar','approved','KI-Schätzung · ' || coalesce(f->>'notes',''));
    end if;
  end loop;
  result:=jsonb_build_object('count',jsonb_array_length(p_foods));
  insert into public.app_mutations(user_id,mutation_id,kind,result) values(uid,p_mutation_id,'food',result);
  return result;
end $$;
revoke all on function public.import_food_draft(uuid,jsonb,date,text,text) from public,anon;
grant execute on function public.import_food_draft(uuid,jsonb,date,text,text) to authenticated;

create function public.begin_plan_workout(p_day_id uuid) returns uuid language plpgsql security invoker set search_path = '' as $$
declare uid uuid := auth.uid(); d public.plan_days%rowtype; sid uuid;
begin
  if uid is null then raise exception 'Nicht angemeldet'; end if;
  perform pg_advisory_xact_lock(hashtextextended(uid::text || 'workout',0));
  select id into sid from public.workout_sessions where user_id=uid and finished_at is null and archived_at is null order by started_at desc limit 1;
  if sid is not null then return sid; end if;
  select * into d from public.plan_days where id=p_day_id and user_id=uid;
  if d.id is null or d.is_rest_day then raise exception 'Trainingstag nicht gefunden'; end if;
  if not exists(select 1 from public.training_plans where id=d.plan_id and user_id=uid and archived_at is null) then raise exception 'Plan archiviert'; end if;
  insert into public.workout_sessions(user_id,title,plan_id,plan_day_id) values(uid,d.name,d.plan_id,d.id) returning id into sid;
  insert into public.workout_exercises(user_id,session_id,exercise_id,exercise_name,exercise_order)
  select uid,sid,e.id,e.name,p.exercise_order from public.plan_exercises p join public.exercises e on e.id=p.exercise_id and e.user_id=uid where p.day_id=d.id and p.user_id=uid order by p.exercise_order;
  return sid;
end $$;
revoke all on function public.begin_plan_workout(uuid) from public,anon;
grant execute on function public.begin_plan_workout(uuid) to authenticated;

create function public.record_training_set(p_exercise_id uuid,p_number int,p_weight numeric,p_reps int,p_duration int) returns void language plpgsql security invoker set search_path = '' as $$
declare uid uuid:=auth.uid(); sid uuid;
begin
  if uid is null then raise exception 'Nicht angemeldet'; end if;
  if p_exercise_id is null or p_number is null or p_weight is null or p_reps is null or p_duration is null then raise exception 'Ungültiger Satz'; end if;
  if p_reps=0 and p_duration=0 then raise exception 'Wiederholungen oder Zeit erfassen'; end if;
  if p_number not between 1 and 50 or p_weight not between 0 and 2000 or p_reps not between 0 and 1000 or p_duration not between 0 and 86400 then raise exception 'Ungültiger Satz'; end if;
  select session_id into sid from public.workout_exercises where id=p_exercise_id and user_id=uid;
  perform 1 from public.workout_sessions where id=sid and user_id=uid and finished_at is null for update;
  if not found then raise exception 'Training ist nicht mehr aktiv'; end if;
  update public.workout_sets set weight_kg=p_weight,reps=p_reps,duration_seconds=p_duration,completed_at=now() where workout_exercise_id=p_exercise_id and user_id=uid and set_number=p_number;
  if not found then
    insert into public.workout_sets(user_id,workout_exercise_id,set_number,weight_kg,reps,duration_seconds,completed_at) values(uid,p_exercise_id,p_number,p_weight,p_reps,p_duration,now());
  end if;
end $$;
revoke all on function public.record_training_set(uuid,int,numeric,int,int) from public,anon;
grant execute on function public.record_training_set(uuid,int,numeric,int,int) to authenticated;

create function public.activate_training_plan(p_plan_id uuid) returns void language plpgsql security invoker set search_path = '' as $$
declare uid uuid:=auth.uid();
begin
  if uid is null then raise exception 'Nicht angemeldet'; end if;
  perform pg_advisory_xact_lock(hashtextextended(uid::text || 'active-plan',0));
  if not exists(select 1 from public.training_plans where id=p_plan_id and user_id=uid and archived_at is null) then raise exception 'Plan nicht gefunden'; end if;
  update public.training_plans set is_active=false where user_id=uid and is_active;
  update public.training_plans set is_active=true where id=p_plan_id and user_id=uid;
end $$;
revoke all on function public.activate_training_plan(uuid) from public,anon;
grant execute on function public.activate_training_plan(uuid) to authenticated;

create function public.finish_training_session(p_session_id uuid,p_duration int) returns void language plpgsql security invoker set search_path = '' as $$
declare uid uuid:=auth.uid(); current_session public.workout_sessions%rowtype; volume numeric; r record;
begin
  if uid is null then raise exception 'Nicht angemeldet'; end if;
  if p_duration is null or p_duration not between 0 and 86400 then raise exception 'Ungültige Dauer'; end if;
  select * into current_session from public.workout_sessions where id=p_session_id and user_id=uid for update;
  if current_session.id is null then raise exception 'Einheit nicht gefunden'; end if;
  if current_session.finished_at is not null then return; end if;
  select coalesce(sum(s.weight_kg*s.reps),0) into volume from public.workout_sets s join public.workout_exercises e on e.id=s.workout_exercise_id and e.user_id=uid where e.session_id=p_session_id and s.user_id=uid and not s.is_warmup;
  update public.workout_sessions set finished_at=now(),duration_seconds=p_duration,total_volume=volume where id=p_session_id and user_id=uid;
  for r in select e.exercise_id,max(s.weight_kg*(1+s.reps/30.0)) as e1rm from public.workout_exercises e join public.workout_sets s on s.workout_exercise_id=e.id and s.user_id=uid where e.user_id=uid and e.session_id=p_session_id and e.exercise_id is not null and not s.is_warmup and s.weight_kg>0 and s.reps>0 group by e.exercise_id loop
    if r.e1rm > (select coalesce(max(value),0) from public.personal_records where user_id=uid and exercise_id=r.exercise_id and record_type='estimated_1rm') then
      insert into public.personal_records(user_id,exercise_id,record_type,value,session_id) values(uid,r.exercise_id,'estimated_1rm',r.e1rm,p_session_id);
    end if;
  end loop;
end $$;
revoke all on function public.finish_training_session(uuid,int) from public,anon;
grant execute on function public.finish_training_session(uuid,int) to authenticated;
