create extension if not exists pgcrypto;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  user_id uuid not null unique references auth.users(id) on delete cascade,
  full_name text, sex text check (sex in ('female','male','intersex','prefer_not_to_say')),
  birth_date date, height_cm numeric(5,2) check (height_cm between 80 and 250),
  weight_kg numeric(5,2) check (weight_kg between 25 and 400),
  activity_level text not null default 'moderate' check (activity_level in ('sedentary','light','moderate','active','very_active')),
  goal text not null default 'maintain' check (goal in ('cut','maintain','bulk')),
  unit_system text not null default 'metric' check (unit_system in ('metric','imperial')),
  onboarding_complete boolean not null default false,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.exercises (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  name text not null, primary_muscle text not null, secondary_muscles text[] not null default '{}', equipment text not null,
  movement_type text not null default 'machine' check (movement_type in ('machine','cable','free_weight','bodyweight')),
  notes text, archived_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(user_id,name)
);
create table public.training_plans (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  name text not null, description text, is_active boolean not null default false, archived_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create unique index one_active_plan_per_user on public.training_plans(user_id) where is_active and archived_at is null;
create table public.plan_days (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  plan_id uuid not null references public.training_plans(id) on delete cascade, name text not null, day_order int not null check(day_order > 0), weekday int check(weekday between 0 and 6), is_rest_day boolean not null default false, created_at timestamptz not null default now(), unique(plan_id,day_order)
);
create table public.plan_exercises (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  day_id uuid not null references public.plan_days(id) on delete cascade, exercise_id uuid not null references public.exercises(id), exercise_order int not null,
  target_sets int not null default 3 check(target_sets between 1 and 20), rep_min int not null default 8, rep_max int not null default 12 check(rep_max >= rep_min), rest_seconds int not null default 90, notes text, created_at timestamptz not null default now()
);
create table public.workout_sessions (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  plan_id uuid references public.training_plans(id) on delete set null, plan_day_id uuid references public.plan_days(id) on delete set null,
  title text not null, started_at timestamptz not null default now(), finished_at timestamptz, duration_seconds int check(duration_seconds >= 0), total_volume numeric(12,2) not null default 0, notes text, is_deload boolean not null default false, archived_at timestamptz
);
create table public.workout_exercises (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid not null references public.workout_sessions(id) on delete cascade, exercise_id uuid references public.exercises(id) on delete set null,
  exercise_name text not null, exercise_order int not null, created_at timestamptz not null default now()
);
create table public.workout_sets (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  workout_exercise_id uuid not null references public.workout_exercises(id) on delete cascade, set_number int not null,
  weight_kg numeric(7,2) check(weight_kg >= 0), reps int check(reps between 0 and 1000), rpe numeric(3,1) check(rpe between 1 and 10), is_warmup boolean not null default false,
  notes text, completed_at timestamptz, created_at timestamptz not null default now()
);
create table public.personal_records (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  exercise_id uuid references public.exercises(id) on delete set null, record_type text not null check(record_type in ('weight','reps','estimated_1rm','volume')),
  value numeric(12,2) not null, achieved_at timestamptz not null default now(), session_id uuid references public.workout_sessions(id) on delete set null
);
create table public.foods (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  name text not null, brand text, category text not null default 'Other', kcal numeric(8,2) not null check(kcal >= 0), protein_g numeric(7,2) not null default 0 check(protein_g >= 0), carbs_g numeric(7,2) not null default 0 check(carbs_g >= 0), fat_g numeric(7,2) not null default 0 check(fat_g >= 0), fiber_g numeric(7,2), sugar_g numeric(7,2), salt_g numeric(7,2), serving_grams numeric(7,2) not null default 100,
  is_favorite boolean not null default false, source text, archived_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(user_id,name)
);
create table public.recipes (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  name text not null, description text, portions numeric(6,2) not null default 1 check(portions > 0), is_favorite boolean not null default false, archived_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.recipe_ingredients (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  recipe_id uuid not null references public.recipes(id) on delete cascade, food_id uuid not null references public.foods(id) on delete restrict, amount_grams numeric(8,2) not null check(amount_grams > 0), created_at timestamptz not null default now()
);
create table public.meal_entries (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, entry_date date not null,
  meal_slot text not null check(meal_slot in ('breakfast','lunch','dinner','snack')), food_id uuid references public.foods(id) on delete set null, recipe_id uuid references public.recipes(id) on delete set null,
  name text not null, amount_grams numeric(8,2), kcal numeric(8,2) not null default 0 check(kcal >= 0), protein_g numeric(7,2) not null default 0 check(protein_g >= 0), carbs_g numeric(7,2) not null default 0 check(carbs_g >= 0), fat_g numeric(7,2) not null default 0 check(fat_g >= 0), is_planned boolean not null default false, notes text, created_at timestamptz not null default now()
);
create table public.nutrition_targets (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  kcal int not null check(kcal between 500 and 10000), protein_g numeric(7,2) not null, carbs_g numeric(7,2) not null, fat_g numeric(7,2) not null,
  effective_from date not null default current_date, calculation jsonb not null default '{}', is_manual boolean not null default false, created_at timestamptz not null default now()
);
create table public.measurements (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  measured_at date not null default current_date, weight_kg numeric(6,2) check(weight_kg between 25 and 400), body_fat_pct numeric(5,2) check(body_fat_pct between 1 and 70),
  neck_cm numeric(6,2) check(neck_cm between 10 and 100), shoulders_cm numeric(6,2) check(shoulders_cm between 20 and 250), chest_cm numeric(6,2) check(chest_cm between 20 and 250), upper_arm_left_cm numeric(6,2) check(upper_arm_left_cm between 10 and 100), upper_arm_right_cm numeric(6,2) check(upper_arm_right_cm between 10 and 100), forearm_left_cm numeric(6,2) check(forearm_left_cm between 10 and 100), forearm_right_cm numeric(6,2) check(forearm_right_cm between 10 and 100), waist_cm numeric(6,2) check(waist_cm between 20 and 250), hips_cm numeric(6,2) check(hips_cm between 20 and 250), thigh_left_cm numeric(6,2) check(thigh_left_cm between 20 and 150), thigh_right_cm numeric(6,2) check(thigh_right_cm between 20 and 150), calf_left_cm numeric(6,2) check(calf_left_cm between 10 and 100), calf_right_cm numeric(6,2) check(calf_right_cm between 10 and 100), notes text, created_at timestamptz not null default now()
);
create table public.measurement_goals (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  metric text not null, start_value numeric(8,2), target_value numeric(8,2) not null, starts_on date not null default current_date, target_date date,
  archived_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.goal_milestones (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  goal_id uuid not null references public.measurement_goals(id) on delete cascade, value numeric(8,2) not null, due_on date, completed_at timestamptz, created_at timestamptz not null default now()
);
create table public.daily_journal (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, entry_date date not null,
  sleep_hours numeric(4,2), mood smallint check(mood between 1 and 5), energy smallint check(energy between 1 and 5), notes text, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(user_id,entry_date)
);
create table public.progress_photos (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, storage_path text not null, taken_on date not null default current_date, notes text, archived_at timestamptz, created_at timestamptz not null default now()
);
create table public.water_entries (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, entry_date date not null default current_date, amount_ml int not null check(amount_ml between 1 and 5000), created_at timestamptz not null default now()
);

-- Every user-owned table is private by default; policies enforce ownership for every operation.
do $$ declare t text; begin
  foreach t in array array['profiles','exercises','training_plans','plan_days','plan_exercises','workout_sessions','workout_exercises','workout_sets','personal_records','foods','recipes','recipe_ingredients','meal_entries','nutrition_targets','measurements','measurement_goals','goal_milestones','daily_journal','progress_photos','water_entries'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %I on public.%I for all using (user_id = auth.uid()) with check (user_id = auth.uid())', t || '_owner', t);
  end loop;
end $$;

create index workout_sessions_user_started_idx on public.workout_sessions(user_id, started_at desc);
create index meals_user_date_idx on public.meal_entries(user_id, entry_date desc);
create index measurements_user_date_idx on public.measurements(user_id, measured_at desc);
create index journal_user_date_idx on public.daily_journal(user_id, entry_date desc);
create index water_user_date_idx on public.water_entries(user_id, entry_date desc);
create index targets_user_date_idx on public.nutrition_targets(user_id, effective_from desc);
create index sets_user_exercise_idx on public.workout_sets(user_id, workout_exercise_id, set_number);
create index records_user_date_idx on public.personal_records(user_id, achieved_at desc);

create or replace function public.seed_new_user() returns trigger language plpgsql security definer set search_path = '' as $$
declare uid uuid := new.id; plan_a uuid; plan_b uuid; day_id uuid; ex record;
begin
  insert into public.profiles(id,user_id,full_name) values(uid,uid,new.raw_user_meta_data->>'full_name');
  -- Each account gets its own editable copy of these defaults.
  insert into public.exercises(user_id,name,primary_muscle,secondary_muscles,equipment,movement_type) values
  (uid,'Chest press machine','Chest',array['Triceps','Front delts'],'Machine','machine'),(uid,'Incline chest press machine','Chest',array['Triceps','Front delts'],'Machine','machine'),(uid,'Pec deck','Chest',array['Front delts'],'Machine','machine'),(uid,'Cable chest fly','Chest',array['Front delts'],'Cable','cable'),
  (uid,'Lat pulldown','Back',array['Biceps'],'Cable machine','machine'),(uid,'Seated cable row','Back',array['Biceps','Rear delts'],'Cable','cable'),(uid,'Chest-supported row','Back',array['Biceps'],'Machine','machine'),(uid,'Assisted pull-up','Back',array['Biceps'],'Machine','machine'),(uid,'Face pull','Rear delts',array['Back'],'Cable','cable'),
  (uid,'Shoulder press machine','Shoulders',array['Triceps'],'Machine','machine'),(uid,'Lateral raise machine','Shoulders',array[]::text[],'Machine','machine'),(uid,'Cable lateral raise','Shoulders',array[]::text[],'Cable','cable'),
  (uid,'Leg press','Quadriceps',array['Glutes','Hamstrings'],'Machine','machine'),(uid,'Leg extension','Quadriceps',array[]::text[],'Machine','machine'),(uid,'Seated leg curl','Hamstrings',array[]::text[],'Machine','machine'),(uid,'Lying leg curl','Hamstrings',array[]::text[],'Machine','machine'),(uid,'Hip abduction','Glutes',array[]::text[],'Machine','machine'),(uid,'Hip adduction','Adductors',array[]::text[],'Machine','machine'),(uid,'Calf raise machine','Calves',array[]::text[],'Machine','machine'),
  (uid,'Cable biceps curl','Biceps',array['Forearms'],'Cable','cable'),(uid,'Preacher curl machine','Biceps',array[]::text[],'Machine','machine'),(uid,'Triceps pushdown','Triceps',array[]::text[],'Cable','cable'),(uid,'Overhead cable extension','Triceps',array[]::text[],'Cable','cable'),(uid,'Back extension','Lower back',array['Glutes'],'Machine','machine'),
  (uid,'Dumbbell bench press','Chest',array['Triceps','Front delts'],'Dumbbell','free_weight'),(uid,'Dumbbell Romanian deadlift','Hamstrings',array['Glutes','Lower back'],'Dumbbell','free_weight'),(uid,'Goblet squat','Quadriceps',array['Glutes'],'Dumbbell','free_weight'),(uid,'Dumbbell row','Back',array['Biceps'],'Dumbbell','free_weight'),(uid,'Plank','Core',array[]::text[],'Bodyweight','bodyweight'),
  (uid,'Converging chest press','Chest',array['Triceps','Front delts'],'Machine','machine'),(uid,'Smith machine incline press','Chest',array['Triceps','Front delts'],'Smith machine','free_weight'),(uid,'Cable fly, high to low','Chest',array['Front delts'],'Cable','cable'),
  (uid,'Wide-grip lat pulldown','Back',array['Biceps'],'Cable machine','machine'),(uid,'Single-arm lat pulldown','Back',array['Biceps'],'Cable','cable'),(uid,'High row machine','Back',array['Biceps','Rear delts'],'Machine','machine'),(uid,'Pullover machine','Back',array['Triceps'],'Machine','machine'),(uid,'Reverse pec deck','Rear delts',array['Back'],'Machine','machine'),(uid,'Cable rear-delt fly','Rear delts',array['Back'],'Cable','cable'),(uid,'Machine shrug','Traps',array['Forearms'],'Machine','machine'),
  (uid,'Hack squat','Quadriceps',array['Glutes'],'Machine','machine'),(uid,'Smith machine squat','Quadriceps',array['Glutes','Hamstrings'],'Smith machine','free_weight'),(uid,'Hip thrust machine','Glutes',array['Hamstrings'],'Machine','machine'),(uid,'Glute kickback machine','Glutes',array[]::text[],'Machine','machine'),(uid,'Standing calf raise','Calves',array[]::text[],'Machine','machine'),(uid,'Seated calf raise','Calves',array[]::text[],'Machine','machine'),
  (uid,'Assisted dip machine','Triceps',array['Chest','Front delts'],'Machine','machine'),(uid,'Cable rope hammer curl','Biceps',array['Forearms'],'Cable','cable'),(uid,'Machine preacher curl','Biceps',array[]::text[],'Machine','machine'),(uid,'Ab crunch machine','Core',array[]::text[],'Machine','machine'),(uid,'Cable woodchop','Core',array['Obliques'],'Cable','cable');
  insert into public.foods(user_id,name,brand,category,kcal,protein_g,carbs_g,fat_g,fiber_g,serving_grams,source) values
  (uid,'Greek yogurt, plain, 2%','USDA reference','Dairy',73,10,3.9,1.9,0,100,'USDA FoodData Central'),
  (uid,'Chicken breast, cooked','Skinless, roasted','Protein',165,31,0,3.6,0,100,'USDA FoodData Central · FDC 171477'),
  (uid,'Quinoa, cooked','Boiled','Grains',120,4.4,21.3,1.9,2.8,100,'USDA FoodData Central · FDC 168917'),
  (uid,'Blueberries, raw','USDA reference','Fruit',57,0.7,14.5,0.3,2.4,100,'USDA FoodData Central · FDC 171711'),
  (uid,'Oats, dry','Regular and quick','Grains',379,13.2,67.7,6.5,10.1,100,'USDA FoodData Central · FDC 173904'),
  (uid,'Bananas, raw','USDA reference','Fruit',89,1.1,22.8,0.3,2.6,100,'USDA FoodData Central · FDC 173944'),
  (uid,'Egg, whole, cooked','Hard-boiled','Protein',155,12.6,1.1,10.6,0,100,'USDA FoodData Central · FDC 173424'),
  (uid,'Brown rice, cooked','Long-grain','Grains',123,2.7,25.6,1,1.6,100,'USDA FoodData Central · FDC 169704'),
  (uid,'Salmon, cooked','Atlantic, farmed','Protein',206,22.1,0,12.4,0,100,'USDA FoodData Central'),
  (uid,'Avocado, raw','All commercial varieties','Fruit',160,2,8.5,14.7,6.7,100,'USDA FoodData Central');
  insert into public.training_plans(user_id,name,description) values(uid,'PPL A · Steady foundation','Three-day push, pull and legs. Machine-focused volume, clear rep ranges and room to recover.') returning id into plan_a;
  insert into public.training_plans(user_id,name,description) values(uid,'PPL B · Six-day momentum','Six-day push, pull and legs rotation. Varied rep ranges and exercise order for a fresh stimulus.') returning id into plan_b;
  -- The two complete plans share this seeded, account-owned exercise library.
  insert into public.plan_days(user_id,plan_id,name,day_order,weekday) values(uid,plan_a,'Push · Strength',1,1) returning id into day_id;
  insert into public.plan_exercises(user_id,day_id,exercise_id,exercise_order,target_sets,rep_min,rep_max,rest_seconds) select uid,day_id,id,row_number() over(),3,8,12,90 from public.exercises where user_id=uid and name in ('Chest press machine','Incline chest press machine','Shoulder press machine','Lateral raise machine','Triceps pushdown');
  insert into public.plan_days(user_id,plan_id,name,day_order,weekday) values(uid,plan_a,'Pull · Strength & posture',2,3) returning id into day_id;
  insert into public.plan_exercises(user_id,day_id,exercise_id,exercise_order,target_sets,rep_min,rep_max,rest_seconds) select uid,day_id,id,row_number() over(),3,8,12,90 from public.exercises where user_id=uid and name in ('Lat pulldown','Seated cable row','Face pull','Cable biceps curl','Back extension');
  insert into public.plan_days(user_id,plan_id,name,day_order,weekday) values(uid,plan_a,'Legs · Foundation',3,5) returning id into day_id;
  insert into public.plan_exercises(user_id,day_id,exercise_id,exercise_order,target_sets,rep_min,rep_max,rest_seconds) select uid,day_id,id,row_number() over(),3,10,15,90 from public.exercises where user_id=uid and name in ('Leg press','Leg extension','Seated leg curl','Hip abduction','Calf raise machine');
  insert into public.plan_days(user_id,plan_id,name,day_order,weekday,is_rest_day) values(uid,plan_a,'Rest & recover',2,2,true),(uid,plan_a,'Rest & recover',4,4,true),(uid,plan_a,'Rest & recover',6,6,true),(uid,plan_a,'Rest & recover',7,0,true);
  insert into public.plan_days(user_id,plan_id,name,day_order,weekday) values(uid,plan_b,'Push A · Strength',1,1) returning id into day_id;
  insert into public.plan_exercises(user_id,day_id,exercise_id,exercise_order,target_sets,rep_min,rep_max,rest_seconds) select uid,day_id,id,row_number() over(),4,6,10,120 from public.exercises where user_id=uid and name in ('Chest press machine','Shoulder press machine','Pec deck','Cable lateral raise','Triceps pushdown');
  insert into public.plan_days(user_id,plan_id,name,day_order,weekday) values(uid,plan_b,'Pull A · Strength',2,2) returning id into day_id;
  insert into public.plan_exercises(user_id,day_id,exercise_id,exercise_order,target_sets,rep_min,rep_max,rest_seconds) select uid,day_id,id,row_number() over(),4,6,10,120 from public.exercises where user_id=uid and name in ('Lat pulldown','Chest-supported row','Face pull','Preacher curl machine');
  insert into public.plan_days(user_id,plan_id,name,day_order,weekday) values(uid,plan_b,'Legs A · Strength',3,3) returning id into day_id;
  insert into public.plan_exercises(user_id,day_id,exercise_id,exercise_order,target_sets,rep_min,rep_max,rest_seconds) select uid,day_id,id,row_number() over(),4,6,10,120 from public.exercises where user_id=uid and name in ('Leg press','Lying leg curl','Leg extension','Calf raise machine');
  insert into public.plan_days(user_id,plan_id,name,day_order,weekday) values(uid,plan_b,'Push B · Volume',4,4) returning id into day_id;
  insert into public.plan_exercises(user_id,day_id,exercise_id,exercise_order,target_sets,rep_min,rep_max,rest_seconds) select uid,day_id,id,row_number() over(),3,10,15,75 from public.exercises where user_id=uid and name in ('Incline chest press machine','Cable chest fly','Lateral raise machine','Overhead cable extension');
  insert into public.plan_days(user_id,plan_id,name,day_order,weekday) values(uid,plan_b,'Pull B · Volume',5,5) returning id into day_id;
  insert into public.plan_exercises(user_id,day_id,exercise_id,exercise_order,target_sets,rep_min,rep_max,rest_seconds) select uid,day_id,id,row_number() over(),3,10,15,75 from public.exercises where user_id=uid and name in ('Assisted pull-up','Seated cable row','Cable biceps curl','Back extension');
  insert into public.plan_days(user_id,plan_id,name,day_order,weekday) values(uid,plan_b,'Legs B · Volume',6,6) returning id into day_id;
  insert into public.plan_exercises(user_id,day_id,exercise_id,exercise_order,target_sets,rep_min,rep_max,rest_seconds) select uid,day_id,id,row_number() over(),3,10,15,75 from public.exercises where user_id=uid and name in ('Goblet squat','Seated leg curl','Hip abduction','Hip adduction','Calf raise machine');
  insert into public.plan_days(user_id,plan_id,name,day_order,weekday,is_rest_day) values(uid,plan_b,'Rest & recover',7,0,true);
  update public.training_plans set is_active=true where id=plan_a;
  return new;
end $$;
create trigger on_auth_user_created_seed after insert on auth.users for each row execute function public.seed_new_user();
