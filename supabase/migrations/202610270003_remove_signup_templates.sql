-- Stop the old signup trigger before cleaning the unused catalog defaults it created.
drop trigger if exists on_auth_user_created_seed on auth.users;
drop function if exists public.seed_new_user();

-- Remove only untouched default plans, matching both their original names and descriptions.
delete from public.training_plans
where (name = 'PPL A · Steady foundation' and description = 'Three-day push, pull and legs. Machine-focused volume, clear rep ranges and room to recover.')
   or (name = 'PPL B · Six-day momentum' and description = 'Six-day push, pull and legs rotation. Varied rep ranges and exercise order for a fresh stimulus.');

-- Remove untouched USDA demo foods when no user recipe relies on them. Meal diary rows remain; their food link is set null by the FK.
delete from public.foods as food
where food.name = any(array['Greek yogurt, plain, 2%', 'Chicken breast, cooked', 'Quinoa, cooked', 'Blueberries, raw', 'Oats, dry', 'Bananas, raw', 'Egg, whole, cooked', 'Brown rice, cooked', 'Salmon, cooked', 'Avocado, raw']::text[])
  and food.source like 'USDA FoodData Central%'
  and not exists (select 1 from public.recipe_ingredients as ingredient where ingredient.food_id = food.id);

-- Remove default exercise-library rows only when no remaining custom plan uses them. Workout history remains and keeps its recorded exercise name.
delete from public.exercises as exercise
where exercise.name = any(array['Chest press machine', 'Incline chest press machine', 'Pec deck', 'Cable chest fly', 'Lat pulldown', 'Seated cable row', 'Chest-supported row', 'Assisted pull-up', 'Face pull', 'Shoulder press machine', 'Lateral raise machine', 'Cable lateral raise', 'Leg press', 'Leg extension', 'Seated leg curl', 'Lying leg curl', 'Hip abduction', 'Hip adduction', 'Calf raise machine', 'Cable biceps curl', 'Preacher curl machine', 'Triceps pushdown', 'Overhead cable extension', 'Back extension', 'Dumbbell bench press', 'Dumbbell Romanian deadlift', 'Goblet squat', 'Dumbbell row', 'Plank', 'Converging chest press', 'Smith machine incline press', 'Cable fly, high to low', 'Wide-grip lat pulldown', 'Single-arm lat pulldown', 'High row machine', 'Pullover machine', 'Reverse pec deck', 'Cable rear-delt fly', 'Machine shrug', 'Hack squat', 'Smith machine squat', 'Hip thrust machine', 'Glute kickback machine', 'Standing calf raise', 'Seated calf raise', 'Assisted dip machine', 'Cable rope hammer curl', 'Machine preacher curl', 'Ab crunch machine', 'Cable woodchop']::text[])
  and not exists (select 1 from public.plan_exercises as item where item.exercise_id = exercise.id);
