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
  const imported = z.object({ plan_id: z.string().uuid() }).parse(result.data);
  const activation = await db.rpc("activate_training_plan", { p_plan_id: imported.plan_id });
  check(activation.error);
  refresh();
  return imported;
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
    const { data: current, error: currentError } = await db
      .from("nutrition_targets")
      .select("kcal,protein_g,carbs_g,fat_g")
      .eq("user_id", user.id)
      .lte("effective_from", action.effective_from)
      .order("effective_from", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    check(currentError);
    const previous = current as Record<string, unknown> | null;
    const kcal = action.kcal ?? Number(previous?.kcal ?? 2000);
    const existingProtein = Number(previous?.protein_g ?? kcal * 0.25 / 4);
    const existingCarbs = Number(previous?.carbs_g ?? kcal * 0.5 / 4);
    const existingFat = Number(previous?.fat_g ?? kcal * 0.25 / 9);
    const previousEnergy = existingProtein * 4 + existingCarbs * 4 + existingFat * 9;
    const scale = action.kcal !== undefined && ![action.protein_g, action.carbs_g, action.fat_g].some((value) => value !== undefined)
      ? kcal / (previousEnergy || kcal)
      : 1;
    const target = {
      effective_from: action.effective_from,
      kcal,
      protein_g: action.protein_g ?? existingProtein * scale,
      carbs_g: action.carbs_g ?? existingCarbs * scale,
      fat_g: action.fat_g ?? existingFat * scale,
    };
    const targetValues = {
      ...target,
      user_id: user.id,
      is_manual: true,
      calculation: { source: "KI-Vorschlag, vom Nutzer bestätigt", partial_update_preserved_existing_macros: true },
    };
    const { data: sameDate, error: sameDateError } = await db.from("nutrition_targets")
      .select("id").eq("user_id", user.id).eq("effective_from", action.effective_from)
      .eq("is_manual", true).order("created_at", { ascending: false }).limit(1).maybeSingle();
    check(sameDateError);
    const { error } = sameDate
      ? await db.from("nutrition_targets").update(targetValues).eq("id", sameDate.id).eq("user_id", user.id)
      : await db.from("nutrition_targets").insert(targetValues);
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

  if (action.type === "meal_template") {
    let source: Record<string, unknown> | null = null;
    if (action.template_id) {
      const { data, error } = await db.from("meal_plan_templates")
        .select("name,amount_grams,kcal,protein_g,carbs_g,fat_g")
        .eq("id", action.template_id).eq("user_id", user.id)
        .eq("is_active", true).maybeSingle();
      check(error);
      if (!data) throw new Error("Die wöchentliche Essensvorlage wurde nicht gefunden.");
      source = data as Record<string, unknown>;
    }
    if (action.source_meal_id) {
      const { data, error } = await db.from("meal_entries")
        .select("name,amount_grams,kcal,protein_g,carbs_g,fat_g")
        .eq("id", action.source_meal_id).eq("user_id", user.id)
        .is("archived_at", null).maybeSingle();
      check(error);
      if (!data) throw new Error("Die Mahlzeit für die wiederkehrende Vorlage wurde nicht gefunden.");
      source = { ...source, ...(data as Record<string, unknown>) };
    }
    const values = {
      user_id: user.id,
      weekday: action.weekday,
      meal_slot: action.meal_slot,
      name: action.name ?? String(source?.name),
      amount_grams: action.amount_grams ?? Number(source?.amount_grams),
      kcal: action.kcal ?? Number(source?.kcal),
      protein_g: action.protein_g ?? Number(source?.protein_g),
      carbs_g: action.carbs_g ?? Number(source?.carbs_g),
      fat_g: action.fat_g ?? Number(source?.fat_g),
      active_from: action.active_from ?? today,
      is_active: true,
      updated_at: new Date().toISOString(),
    };
    if (action.template_id) {
      const { data, error } = await db.from("meal_plan_templates").update(values)
        .eq("id", action.template_id).eq("user_id", user.id).select("id").maybeSingle();
      check(error);
      if (!data) throw new Error("Die wiederkehrende Mahlzeit wurde nicht gefunden.");
    } else {
      const { error } = await db.from("meal_plan_templates").insert(values);
      check(error);
    }
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

  if (action.type === "delete_entry") {
    if (action.entity === "meal_template_occurrence") {
      const { error } = await db.from("meal_plan_template_skips").upsert({
        user_id: user.id,
        template_id: action.id,
        entry_date: action.entry_date!,
      }, { onConflict: "user_id,template_id,entry_date" });
      check(error);
    } else {
    const tableByEntity = {
      meal: "meal_entries",
      meal_template: "meal_plan_templates",
      water: "water_entries",
      measurement: "measurements",
      goal: "measurement_goals",
      plan: "training_plans",
      plan_exercise: "plan_exercises",
      workout: "workout_sessions",
    } as const;
    const table = tableByEntity[action.entity];
    if (action.entity === "meal_template") {
      const { data, error } = await db.from(table)
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq("id", action.id).eq("user_id", user.id).select("id").maybeSingle();
      check(error);
      if (!data) throw new Error("Wiederkehrende Mahlzeit nicht gefunden.");
    } else if (["meal", "goal", "plan", "workout"].includes(action.entity)) {
      const { data, error } = await db.from(table)
        .update({ archived_at: new Date().toISOString() })
        .eq("id", action.id).eq("user_id", user.id).select("id").maybeSingle();
      check(error);
      if (!data) throw new Error("Eintrag nicht gefunden.");
    } else {
      const { data, error } = await db.from(table)
        .delete().eq("id", action.id).eq("user_id", user.id)
        .select("id").maybeSingle();
      check(error);
      if (!data) throw new Error("Eintrag nicht gefunden.");
    }
    }
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

export async function eatMealTemplate(templateId: string, date: string) {
  const parsedId = z.string().uuid().parse(templateId);
  const entryDate = dateSchema.parse(date);
  const db = await client();
  const { data: { user } } = await db.auth.getUser();
  if (!user) throw new Error("Bitte erneut anmelden.");
  const { data: template, error: templateError } = await db.from("meal_plan_templates")
    .select("id,meal_slot,name,amount_grams,kcal,protein_g,carbs_g,fat_g")
    .eq("id", parsedId).eq("user_id", user.id).eq("is_active", true).maybeSingle();
  check(templateError);
  if (!template) throw new Error("Die wiederkehrende Mahlzeit wurde nicht gefunden.");
  const { data: existing, error: existingError } = await db.from("meal_entries")
    .select("id").eq("user_id", user.id).eq("source_template_id", parsedId)
    .eq("entry_date", entryDate).maybeSingle();
  check(existingError);
  if (existing) {
    const { error } = await db.from("meal_entries").update({
      is_planned: false, review_status: "approved", archived_at: null,
    }).eq("id", existing.id).eq("user_id", user.id);
    check(error);
  } else {
    const { error } = await db.from("meal_entries").insert({
      user_id: user.id,
      source_template_id: parsedId,
      entry_date: entryDate,
      meal_slot: template.meal_slot,
      name: template.name,
      amount_grams: template.amount_grams,
      kcal: template.kcal,
      protein_g: template.protein_g,
      carbs_g: template.carbs_g,
      fat_g: template.fat_g,
      is_planned: false,
      review_status: "approved",
      notes: "Aus wöchentlicher Essensvorlage übernommen.",
    });
    check(error);
  }
  refresh();
}

export async function removeMealTemplate(templateId: string) {
  const parsedId = z.string().uuid().parse(templateId);
  const db = await client();
  const { data: { user } } = await db.auth.getUser();
  if (!user) throw new Error("Bitte erneut anmelden.");
  const { data, error } = await db.from("meal_plan_templates")
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("id", parsedId).eq("user_id", user.id).select("id").maybeSingle();
  check(error);
  if (!data) throw new Error("Wöchentliche Essensvorlage nicht gefunden.");
  refresh();
}

export async function skipMealTemplate(templateId: string, date: string) {
  const parsedId = z.string().uuid().parse(templateId);
  const entryDate = dateSchema.parse(date);
  const db = await client();
  const { data: { user } } = await db.auth.getUser();
  if (!user) throw new Error("Bitte erneut anmelden.");
  const { error } = await db.from("meal_plan_template_skips").upsert({
    user_id: user.id, template_id: parsedId, entry_date: entryDate,
  }, { onConflict: "user_id,template_id,entry_date" });
  check(error);
  refresh();
}
