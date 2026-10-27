import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";

// Runs real migrations in an isolated PostgreSQL WASM database. Supabase's auth
// schema is stubbed; the real RLS policies and application functions are used.
const db = new PGlite();
const uid = randomUUID();
const other = randomUUID();
await db.exec(`
  create role anon;
  create role authenticated;
  create schema auth;
  create table auth.users(id uuid primary key,raw_user_meta_data jsonb default '{}');
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
  $$;
  grant usage on schema auth,public to authenticated,anon;
  grant execute on function auth.uid() to authenticated,anon;
`);
for (const name of [
  "202610270001_initial_schema.sql",
  "202610270002_meal_review_and_notifications.sql",
  "202610270003_remove_signup_templates.sql",
]) {
  const sql = await readFile(
    new URL(`../supabase/migrations/${name}`, import.meta.url),
    "utf8",
  );
  // gen_random_uuid is built into Postgres; pgcrypto is unnecessary in PGlite.
  await db.exec(sql.replace("create extension if not exists pgcrypto;", ""));
}
await db.exec("grant all on all tables in schema public to authenticated;");
await db.exec(
  await readFile(
    new URL(
      "../supabase/migrations/202610270004_ai_native.sql",
      import.meta.url,
    ),
    "utf8",
  ),
);
await db.query("insert into auth.users(id) values ($1),($2)", [uid, other]);
await db.exec("set role authenticated");
await db.query("select set_config('request.jwt.claim.sub',$1,false)", [uid]);
const query = async (sql, args = []) => (await db.query(sql, args)).rows;
const scalar = async (sql, args = []) =>
  Object.values((await query(sql, args))[0])[0];
const rejects = async (sql, args = []) => {
  await assert.rejects(() => db.query(sql, args));
};
const ex = {
  name: "Squat",
  muscle: "Legs",
  equipment: "Barbell",
  sets: 3,
  reps: 10,
  rest_seconds: 90,
  duration_seconds: null,
  notes: "",
};
const plan = {
  name: "My plan",
  description: "Test plan",
  days: [
    { name: "Day A", weekday: 0, exercises: [ex] },
    { name: "Day B", weekday: 2, exercises: [{ ...ex, name: "Row" }] },
  ],
};
const planMutation = randomUUID();
const imported = await scalar("select public.import_plan_draft($1,$2::jsonb)", [
  planMutation,
  JSON.stringify(plan),
]);
assert.equal(
  (
    await scalar("select public.import_plan_draft($1,$2::jsonb)", [
      planMutation,
      JSON.stringify(plan),
    ])
  ).plan_id,
  imported.plan_id,
);
assert.equal(
  Number(await scalar("select count(*) from public.training_plans")),
  1,
);
assert.equal(Number(await scalar("select count(*) from public.plan_days")), 2);
assert.equal(
  Number(await scalar("select count(*) from public.plan_exercises")),
  2,
);
console.log("✓ Plan import is complete and idempotent");
const before = await scalar("select count(*) from public.training_plans");
await rejects("select public.import_plan_draft($1,$2::jsonb)", [
  randomUUID(),
  JSON.stringify({
    ...plan,
    days: [plan.days[0], { ...plan.days[1], exercises: [{ ...ex, sets: 99 }] }],
  }),
]);
assert.equal(
  await scalar("select count(*) from public.training_plans"),
  before,
);
console.log("✓ Invalid imports roll back the complete plan");
const food = {
  name: "Chicken wrap",
  grams: 400,
  kcal: 600,
  protein_g: 40,
  carbs_g: 60,
  fat_g: 20,
  fiber_g: 5,
  confidence: "medium",
  notes: "Estimate",
};
const foodId = randomUUID();
await query("select public.import_food_draft($1,$2::jsonb,$3,$4,$5)", [
  foodId,
  JSON.stringify([food]),
  "2026-10-27",
  "lunch",
  "diary",
]);
await query("select public.import_food_draft($1,$2::jsonb,$3,$4,$5)", [
  foodId,
  JSON.stringify([food]),
  "2026-10-27",
  "lunch",
  "diary",
]);
assert.equal(
  Number(await scalar("select count(*) from public.meal_entries")),
  1,
);
const meal = (await query("select * from public.meal_entries"))[0];
assert.equal(Number(meal.kcal), 600);
assert.equal(Number(meal.amount_grams), 400);
assert.equal(meal.is_planned, false);
assert.equal(Number(await scalar("select kcal from public.foods")), 150);
await query("update public.foods set kcal=123 where name=$1", [food.name]);
await query("select public.import_food_draft($1,$2::jsonb,$3,$4,$5)", [
  randomUUID(),
  JSON.stringify([food]),
  "2026-10-28",
  "lunch",
  "calendar",
]);
assert.equal(Number(await scalar("select kcal from public.foods")), 123);
assert.equal(
  (
    await query(
      "select * from public.meal_entries where entry_date='2026-10-28'",
    )
  )[0].is_planned,
  true,
);
const count = await scalar("select count(*) from public.foods");
await rejects("select public.import_food_draft($1,$2::jsonb,$3,$4,$5)", [
  randomUUID(),
  JSON.stringify([
    { ...food, name: "New dish" },
    { ...food, grams: 0 },
  ]),
  "2026-10-27",
  "lunch",
  "diary",
]);
assert.equal(await scalar("select count(*) from public.foods"), count);
console.log(
  "✓ Full portions, per-100g library conversion, planning and retry safety",
);
console.log(
  "✓ A scan preserves user-edited library values; partial imports roll back",
);
const day = await scalar(
  "select id from public.plan_days order by day_order limit 1",
);
const session = await scalar("select public.begin_plan_workout($1)", [day]);
assert.equal(
  await scalar("select public.begin_plan_workout($1)", [day]),
  session,
);
const exercise = await scalar(
  "select id from public.workout_exercises where session_id=$1",
  [session],
);
await query("select public.record_training_set($1,1,60,10,0)", [exercise]);
await query("select public.record_training_set($1,1,70,10,0)", [exercise]);
assert.equal(
  Number(await scalar("select count(*) from public.workout_sets")),
  1,
);
await query("select public.finish_training_session($1,600)", [session]);
await query("select public.finish_training_session($1,600)", [session]);
assert.equal(
  Number(
    await scalar(
      "select total_volume from public.workout_sessions where id=$1",
      [session],
    ),
  ),
  700,
);
assert.equal(
  Number(await scalar("select count(*) from public.personal_records")),
  1,
);
await rejects("select public.record_training_set($1,2,70,10,0)", [exercise]);
console.log(
  "✓ Workout resume, duplicate-safe sets, final volume and personal records",
);
await query("select public.activate_training_plan($1)", [imported.plan_id]);
await rejects("select public.activate_training_plan($1)", [randomUUID()]);
assert.equal(
  Number(
    await scalar("select count(*) from public.training_plans where is_active"),
  ),
  1,
);
assert.equal(await scalar("select public.claim_ai_request()"), true);
assert.equal(await scalar("select public.claim_ai_request()"), false);
await rejects("update public.ai_daily_usage set requests=0");
console.log(
  "✓ Plan activation is atomic; AI quota cannot be overwritten by users",
);
await db.query("select set_config('request.jwt.claim.sub',$1,false)", [other]);
assert.equal(
  Number(await scalar("select count(*) from public.training_plans")),
  0,
);
assert.equal(Number(await scalar("select count(*) from public.foods")), 0);
assert.equal(
  Number(await scalar("select count(*) from public.meal_entries")),
  0,
);
await rejects("select public.begin_plan_workout($1)", [day]);
await rejects("select public.record_training_set($1,2,50,10,0)", [exercise]);
await rejects("select public.finish_training_session($1,600)", [session]);
await rejects("select public.activate_training_plan($1)", [imported.plan_id]);
console.log(
  "✓ Another account cannot read, activate or mutate the first account’s data",
);
await db.exec("set role anon");
await rejects("select public.claim_ai_request()");
await rejects("select public.import_plan_draft($1,$2::jsonb)", [
  randomUUID(),
  JSON.stringify(plan),
]);
console.log("✓ Anonymous callers cannot access mutation functions");
await db.close();
