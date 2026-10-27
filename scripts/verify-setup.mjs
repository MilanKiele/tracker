import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";

const read = (file) =>
  readFile(new URL(`../supabase/${file}`, import.meta.url), "utf8");
const setup = await read("setup.sql");
const initial = await read("migrations/202610270001_initial_schema.sql");
const uid = randomUUID();
async function database() {
  const db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated; create schema auth; create schema storage;
    create table auth.users(id uuid primary key, raw_user_meta_data jsonb default '{}');
    create table storage.buckets(id text primary key, name text not null, public boolean not null, file_size_limit bigint, allowed_mime_types text[]);
    create table storage.objects(id uuid primary key default gen_random_uuid(), bucket_id text not null, name text not null);
    alter table storage.objects enable row level security;
    create function storage.foldername(name text) returns text[] language sql immutable as $$ select string_to_array(name, '/') $$;
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid
    $$;
    grant usage on schema auth,public to authenticated,anon;
    grant execute on function auth.uid() to authenticated,anon;
  `);
  return db;
}
async function verifyReady(db) {
  for (const table of [
    "meal_entries",
    "foods",
    "profiles",
    "training_plans",
    "workout_sets",
    "notification_settings",
    "app_mutations",
    "ai_daily_usage",
  ]) {
    assert.ok(
      (await db.query("select to_regclass($1) as name", [`public.${table}`]))
        .rows[0].name,
    );
  }
  assert.equal(
    (
      await db.query(
        "select count(*) as count from pg_trigger where tgname='on_auth_user_created_seed'",
      )
    ).rows[0].count,
    0,
  );
  await db.exec("set role authenticated");
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [uid]);
  const result = await db.query("select public.claim_ai_request() as allowed");
  assert.equal(result.rows[0].allowed, true);
  await assert.rejects(() =>
    db.exec("update public.ai_daily_usage set requests=0"),
  );
  await db.exec("reset role");
}
// Reproduces 42P01: auth exists, app tables have never been created.
{
  const db = await database();
  await db.query("insert into auth.users values($1,$2)", [
    uid,
    { full_name: "Existing auth account" },
  ]);
  await db.exec(setup);
  await db.exec(setup);
  const profile = (
    await db.query("select full_name from public.profiles where user_id=$1", [
      uid,
    ])
  ).rows[0];
  assert.equal(profile.full_name, "Existing auth account");
  await verifyReady(db);
  const newUser = randomUUID();
  await db.query("insert into auth.users(id) values($1)", [newUser]);
  assert.equal(
    (await db.query("select count(*) as count from public.foods")).rows[0]
      .count,
    0,
  );
  assert.equal(
    (await db.query("select count(*) as count from public.training_plans"))
      .rows[0].count,
    0,
  );
  await db.close();
  console.log(
    "✓ Empty app schema: all tables/functions created; repeat run succeeds; no sample data",
  );
}
// Simulates the first table having been created before a later SQL error.
{
  const db = await database();
  const profileDdl = initial.match(
    /create table public\.profiles \([\s\S]*?\n\);/,
  )[0];
  await db.exec(profileDdl);
  await db.query("insert into auth.users(id) values($1)", [uid]);
  await db.query(
    "insert into public.profiles(id,user_id,full_name,height_cm,onboarding_complete) values($1,$1,'Keep my profile',185,true)",
    [uid],
  );
  await db.exec(setup);
  const profile = (
    await db.query("select * from public.profiles where user_id=$1", [uid])
  ).rows[0];
  assert.equal(profile.full_name, "Keep my profile");
  assert.equal(Number(profile.height_cm), 185);
  assert.equal(profile.onboarding_complete, true);
  await verifyReady(db);
  await db.close();
  console.log(
    "✓ Partial initialization: existing profile preserved and missing tables created",
  );
}
// An already working project must retain its actual records and AI receipts.
{
  const db = await database();
  for (const name of [
    "202610270001_initial_schema.sql",
    "202610270002_meal_review_and_notifications.sql",
    "202610270003_remove_signup_templates.sql",
    "202610270004_ai_native.sql",
  ]) {
    await db.exec(
      (await read(`migrations/${name}`)).replace(
        "create extension if not exists pgcrypto;",
        "",
      ),
    );
  }
  await db.query("insert into auth.users(id) values($1)", [uid]);
  await db.query(
    "insert into public.foods(user_id,name,kcal,protein_g) values($1,'My saved dish',123,12)",
    [uid],
  );
  await db.query(
    "insert into public.meal_entries(user_id,entry_date,meal_slot,name,kcal) values($1,'2026-10-27','lunch','Actual meal',456)",
    [uid],
  );
  await db.query(
    "insert into public.app_mutations(user_id,mutation_id,kind,result) values($1,$2,'food','{\"count\":1}')",
    [uid, randomUUID()],
  );
  await db.exec(setup);
  await db.exec(setup);
  assert.equal(
    Number((await db.query("select kcal from public.foods")).rows[0].kcal),
    123,
  );
  assert.equal(
    Number(
      (await db.query("select kcal from public.meal_entries")).rows[0].kcal,
    ),
    456,
  );
  assert.equal(
    (await db.query("select count(*) as count from public.app_mutations"))
      .rows[0].count,
    1,
  );
  await verifyReady(db);
  await db.close();
  console.log(
    "✓ Existing 001–004 project: meals, library and import receipts preserved on repeat runs",
  );
}
// Unexpected custom schemas fail without leaving half a newly created schema.
{
  const db = await database();
  await db.exec("create table public.meal_entries(id uuid primary key)");
  await assert.rejects(() => db.exec(setup));
  await db.exec("rollback");
  assert.equal(
    (await db.query("select to_regclass('public.profiles') as name")).rows[0]
      .name,
    null,
  );
  await db.close();
  console.log(
    "✓ Incompatible pre-existing table: transaction aborts without partial changes",
  );
}
