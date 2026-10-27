"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { dateSchema, foodDraft, planDraft } from "@/lib/ai/schema";

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
  for (const path of ["/", "/train", "/nutrition", "/insights"])
    revalidatePath(path);
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
