"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { aiAction, dateSchema, foodDraft, planDraft } from "@/lib/ai/schema";
import { calculatedTargets } from "@/lib/nutrition-targets";

async function client() {
  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) throw new Error("Bitte erneut anmelden.");
  return db;
}
function check(error: { message: string; code?: string } | null) {
  if (!error) return;
  if (["PGRST202", "PGRST204", "42703", "42P01"].includes(error.code ?? ""))
    throw new Error(
      "Datenbank-Update erforderlich: supabase/setup.sql im Supabase SQL Editor ausführen.",
    );
  throw new Error(error.message);
}
function refresh() {
  for (const path of ["/", "/assistant", "/account", "/body", "/train", "/nutrition", "/insights"])
    revalidatePath(path);
}
function withoutType<T extends { type: string }>({ type: _ignored, ...value }: T) {
  void _ignored;
  return value;
}

export async function importPlan(input: unknown) {
  const parsed = z
    .object({ mutation_id: z.string().uuid(), plan: planDraft })
    .safeParse(input);
  if (!parsed.success)
    throw new Error(
      "Bitte Planname, eindeutige Wochentage und Übungswerte prüfen.",
    );
  const data = parsed.data;
  const db = await client();
  const result = await db.rpc("import_plan_draft", {
    p_mutation_id: data.mutation_id,
    p_plan: data.plan,
  });
  check(result.error);
  refresh();
  return z.object({ plan_id: z.string().uuid() }).parse(result.data);
}
export async function importFood(input: unknown) {
  const parsed = z
    .object({
      mutation_id: z.string().uuid(),
      foods: z.array(foodDraft).min(1).max(12),
      date: dateSchema,
      slot: z.enum(["breakfast", "lunch", "dinner", "snack"]),
      destination: z.enum(["diary", "calendar", "library"]),
    })
    .safeParse(input);
  if (!parsed.success)
    throw new Error("Bitte Datum, Portion und Nährwerte prüfen.");
  const data = parsed.data;
  const db = await client();
  const result = await db.rpc("import_food_draft", {
    p_mutation_id: data.mutation_id,
    p_foods: data.foods,
    p_date: data.date,
    p_slot: data.slot,
    p_destination: data.destination,
  });
  check(result.error);
  refresh();
}

export async function applyAiAction(input: unknown) {
  const action = aiAction.parse(input);
  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) throw new Error("Bitte erneut anmelden.");
  const today = new Date().toISOString().slice(0, 10);

  if (action.type === "measurement") {
    if (action.measurement_id) {
      const { data, error } = await db
        .from("measurements")
        .update({ measured_at: action.measured_at, ...action.values })
        .eq("id", action.measurement_id)
        .eq("user_id", user.id)
        .select("id")
        .maybeSingle();
      check(error);
      if (!data) throw new Error("Messung nicht gefunden.");
    } else {
      const { error } = await db.from("measurements").insert({
        user_id: user.id,
        measured_at: action.measured_at,
        ...action.values,
      });
      check(error);
    }
  }

  if (action.type === "goal") {
    const values = {
      metric: action.metric,
      start_value: action.start_value ?? null,
      target_value: action.target_value,
      starts_on: action.starts_on,
      target_date: action.target_date ?? null,
    };
    if (action.goal_id) {
      const { data, error } = await db
        .from("measurement_goals")
        .update(values)
        .eq("id", action.goal_id)
        .eq("user_id", user.id)
        .select("id")
        .maybeSingle();
      check(error);
      if (!data) throw new Error("Körperziel nicht gefunden.");
    } else {
      const { error } = await db
        .from("measurement_goals")
        .insert({ user_id: user.id, ...values });
      check(error);
    }
  }

  if (action.type === "journal") {
    const entry = withoutType(action);
    const { error } = await db.from("daily_journal").upsert(
      { ...entry, user_id: user.id, updated_at: new Date().toISOString() },
      { onConflict: "user_id,entry_date" },
    );
    check(error);
  }

  if (action.type === "water") {
    const entry = withoutType(action);
    const { error } = await db
      .from("water_entries")
      .insert({ ...entry, user_id: user.id });
    check(error);
  }

  if (action.type === "nutrition_target") {
    const target = withoutType(action);
    const { error } = await db.from("nutrition_targets").insert({
      ...target,
      user_id: user.id,
      is_manual: true,
      calculation: { source: "KI-Vorschlag, vom Nutzer bestätigt" },
    });
    check(error);
  }

  if (action.type === "meal_update") {
    const { meal_id, ...values } = withoutType(action);
    const { data, error } = await db
      .from("meal_entries")
      .update(values)
      .eq("id", meal_id)
      .eq("user_id", user.id)
      .select("id")
      .maybeSingle();
    check(error);
    if (!data) throw new Error("Mahlzeit nicht gefunden.");
  }

  if (action.type === "profile") {
    const { data: old, error: oldError } = await db
      .from("profiles")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();
    check(oldError);
    const previous = old as Record<string, unknown> | null;
    const next = {
      id: user.id,
      user_id: user.id,
      full_name: action.full_name ?? previous?.full_name ?? user.user_metadata?.full_name ?? user.email?.split("@")[0] ?? "Mein Konto",
      sex: action.sex ?? previous?.sex ?? "prefer_not_to_say",
      birth_date: action.birth_date === undefined ? previous?.birth_date ?? null : action.birth_date,
      height_cm: action.height_cm ?? previous?.height_cm,
      weight_kg: action.weight_kg ?? previous?.weight_kg,
      activity_level: action.activity_level ?? previous?.activity_level ?? "moderate",
      goal: action.goal ?? previous?.goal ?? "maintain",
      unit_system: previous?.unit_system ?? "metric",
      onboarding_complete: true,
      updated_at: new Date().toISOString(),
    };
    if (!next.height_cm || !next.weight_kg)
      throw new Error("Für Profilziele brauche ich Größe und Gewicht. Ergänze beide Werte im Chat.");
    if (next.birth_date && next.birth_date > today)
      throw new Error("Das Geburtsdatum darf nicht in der Zukunft liegen.");
    const { error } = await db.from("profiles").upsert(next);
    check(error);
    const profileChanged =
      !previous ||
      previous.weight_kg !== next.weight_kg ||
      previous.goal !== next.goal ||
      previous.height_cm !== next.height_cm ||
      previous.sex !== next.sex ||
      previous.activity_level !== next.activity_level ||
      previous.birth_date !== next.birth_date;
    if (profileChanged) {
      const { error: targetError } = await db.from("nutrition_targets").insert({
        user_id: user.id,
        ...calculatedTargets(next as unknown as Parameters<typeof calculatedTargets>[0]),
        effective_from: today,
        is_manual: false,
      });
      check(targetError);
      const { error: measurementError } = await db.from("measurements").insert({
        user_id: user.id,
        measured_at: today,
        weight_kg: next.weight_kg,
      });
      check(measurementError);
    }
  }

  if (action.type === "notification_settings") {
    const changes = withoutType(action);
    const { data, error: currentError } = await db
      .from("notification_settings")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();
    check(currentError);
    const current = data as Record<string, unknown> | null;
    const { error } = await db.from("notification_settings").upsert({
      user_id: user.id,
      push_enabled: current?.push_enabled ?? false,
      missed_workout_enabled: current?.missed_workout_enabled ?? false,
      reminder_enabled: current?.reminder_enabled ?? false,
      reminder_time: current?.reminder_time ?? "08:00",
      timezone: current?.timezone ?? "UTC",
      quiet_hours_start: current?.quiet_hours_start ?? null,
      quiet_hours_end: current?.quiet_hours_end ?? null,
      ...changes,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });
    check(error);
  }

  if (action.type === "mark_notification_read") {
    const { data, error } = await db.from("notification_events")
      .update({ read_at: new Date().toISOString() })
      .eq("id", action.notification_id)
      .eq("user_id", user.id)
      .select("id")
      .maybeSingle();
    check(error);
    if (!data) throw new Error("Benachrichtigung nicht gefunden.");
  }

  refresh();
  return { saved: true };
}
export async function beginWorkout(dayId: string) {
  const db = await client();
  const result = await db.rpc("begin_plan_workout", {
    p_day_id: z.string().uuid().parse(dayId),
  });
  check(result.error);
  refresh();
  return result.data;
}
export async function recordSet(input: unknown) {
  const data = z
    .object({
      exercise_id: z.string().uuid(),
      number: z.number().int().min(1).max(50),
      weight: z.number().min(0).max(2000),
      reps: z.number().int().min(0).max(1000),
      duration: z.number().int().min(0).max(86400),
    })
    .parse(input);
  const db = await client();
  const result = await db.rpc("record_training_set", {
    p_exercise_id: data.exercise_id,
    p_number: data.number,
    p_weight: data.weight,
    p_reps: data.reps,
    p_duration: data.duration,
  });
  check(result.error);
  revalidatePath("/train");
}
export async function eatPlannedMeal(id: string) {
  const db = await client();
  const {
    data: { user },
  } = await db.auth.getUser();
  const result = await db
    .from("meal_entries")
    .update({ is_planned: false, review_status: "approved" })
    .eq("id", z.string().uuid().parse(id))
    .eq("user_id", user!.id);
  check(result.error);
  refresh();
}
