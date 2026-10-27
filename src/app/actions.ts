"use server";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const credentials = z.object({ email: z.string().trim().email().max(254), password: z.string().min(8).max(128) });
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const uuid = z.string().uuid();
function value(form: FormData, key: string) { return String(form.get(key) ?? ""); }
async function ownedClient() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Your session expired. Sign in again to continue.");
  return { supabase, user };
}
function fail(error: { message: string } | null, fallback = "Could not save this change.") { if (error) throw new Error(error.message || fallback); }

export async function login(form: FormData) {
  const parsed = credentials.safeParse({ email: value(form, "email"), password: value(form, "password") });
  if (!parsed.success) redirect("/login?error=Enter%20a%20valid%20email%20and%20password%20(8%2B%20characters)");
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) redirect(`/login?error=${encodeURIComponent(error.message)}`);
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from("profiles").select("onboarding_complete").eq("user_id", user?.id ?? "").maybeSingle();
  redirect(profile?.onboarding_complete ? "/" : "/onboarding");
}
export async function register(form: FormData) {
  const parsed = credentials.extend({ name: z.string().trim().min(2).max(80) }).safeParse({ email: value(form, "email"), password: value(form, "password"), name: value(form, "name") });
  if (!parsed.success) redirect("/register?error=Please%20check%20your%20name%2C%20email%20and%20password%20(minimum%208%20characters)");
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({ email: parsed.data.email, password: parsed.data.password, options: { data: { full_name: parsed.data.name } } });
  if (error) redirect(`/register?error=${encodeURIComponent(error.message)}`);
  if (data.session) redirect("/onboarding");
  redirect("/login?message=Check%20your%20email%20to%20confirm%20your%20account%2C%20then%20sign%20in.");
}
export async function logout() { const supabase = await createClient(); await supabase.auth.signOut(); redirect("/login"); }
export async function requestPasswordReset(form: FormData) {
  const parsed = z.string().trim().email().safeParse(value(form, "email"));
  if (!parsed.success) redirect("/forgot-password?error=Enter%20a%20valid%20email%20address");
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data, { redirectTo: `${process.env.SITE_URL ?? "http://localhost:3000"}/reset-password` });
  if (error) redirect(`/forgot-password?error=${encodeURIComponent(error.message)}`);
  redirect("/forgot-password?message=If%20an%20account%20exists%2C%20we%20sent%20a%20password%20reset%20link.");
}

const profileSchema = z.object({ full_name: z.string().trim().min(2).max(80), sex: z.enum(["female", "male", "intersex", "prefer_not_to_say"]), birth_date: isoDate.nullable().optional(), height_cm: z.number().min(80).max(250), weight_kg: z.number().min(25).max(400), activity_level: z.enum(["sedentary", "light", "moderate", "active", "very_active"]), goal: z.enum(["cut", "maintain", "bulk"]), unit_system: z.enum(["metric", "imperial"]) });
function calculatedTargets(p: z.infer<typeof profileSchema>) {
  const age = p.birth_date ? Math.max(15, new Date().getFullYear() - new Date(p.birth_date).getFullYear()) : 30;
  const bmr = 10 * p.weight_kg + 6.25 * p.height_cm - 5 * age + (p.sex === "male" ? 5 : p.sex === "female" ? -161 : -78);
  const activity = { sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725, very_active: 1.9 }[p.activity_level];
  const adjustment = p.goal === "cut" ? -400 : p.goal === "bulk" ? 250 : 0;
  const kcal = Math.max(500, Math.round((bmr * activity + adjustment) / 50) * 50);
  const protein = Math.round(p.weight_kg * 1.8); const fat = Math.round(p.weight_kg * 0.8); const carbs = Math.max(0, Math.round((kcal - protein * 4 - fat * 9) / 4));
  return { kcal, protein_g: protein, fat_g: fat, carbs_g: carbs, calculation: { formula: "Mifflin–St Jeor BMR × activity factor, adjusted by goal", bmr: Math.round(bmr), activity_factor: activity, goal_adjustment: adjustment, protein_g_per_kg: 1.8, fat_g_per_kg: 0.8 } };
}
export async function saveProfile(input: unknown) {
  const p = profileSchema.parse(input); const { supabase, user } = await ownedClient();
  const { data: old } = await supabase.from("profiles").select("weight_kg,goal,height_cm,sex,activity_level").eq("user_id", user.id).maybeSingle();
  const { error } = await supabase.from("profiles").upsert({ id: user.id, user_id: user.id, ...p, onboarding_complete: true, updated_at: new Date().toISOString() }); fail(error);
  if (!old || old.weight_kg !== p.weight_kg || old.goal !== p.goal || old.height_cm !== p.height_cm || old.sex !== p.sex || old.activity_level !== p.activity_level) {
    const target = calculatedTargets(p);
    const { error: targetError } = await supabase.from("nutrition_targets").insert({ user_id: user.id, ...target, effective_from: new Date().toISOString().slice(0, 10), is_manual: false }); fail(targetError);
    const { error: measurementError } = await supabase.from("measurements").insert({ user_id: user.id, measured_at: new Date().toISOString().slice(0, 10), weight_kg: p.weight_kg }); fail(measurementError);
  }
  revalidatePath("/"); revalidatePath("/account"); revalidatePath("/nutrition"); revalidatePath("/body");
}

const foodSchema = z.object({ name: z.string().trim().min(1).max(140), brand: z.string().trim().max(100).nullable().optional(), category: z.string().trim().min(1).max(60), kcal: z.number().min(0).max(10000), protein_g: z.number().min(0).max(1000), carbs_g: z.number().min(0).max(1000), fat_g: z.number().min(0).max(1000), fiber_g: z.number().min(0).max(1000).nullable().optional(), sugar_g: z.number().min(0).max(1000).nullable().optional(), salt_g: z.number().min(0).max(1000).nullable().optional(), serving_grams: z.number().positive().max(5000).default(100), source: z.string().max(300).nullable().optional() });
const mealSchema = z.object({ entry_date: isoDate, meal_slot: z.enum(["breakfast", "lunch", "dinner", "snack"]), food_id: uuid.nullable().optional(), recipe_id: uuid.nullable().optional(), name: z.string().trim().min(1).max(140), amount_grams: z.number().positive().max(5000).nullable().optional(), kcal: z.number().min(0).max(10000), protein_g: z.number().min(0).max(1000), carbs_g: z.number().min(0).max(1000), fat_g: z.number().min(0).max(1000), is_planned: z.boolean(), review_status: z.enum(["pending", "approved", "denied"]).default("approved"), notes: z.string().max(2000).nullable().optional() });
export async function createFood(input: unknown) { const food = foodSchema.parse(input); const { supabase, user } = await ownedClient(); const { error } = await supabase.from("foods").insert({ ...food, user_id: user.id }); fail(error); revalidatePath("/nutrition"); }
export async function updateFood(id: string, input: unknown) { const food = foodSchema.parse(input); const { supabase, user } = await ownedClient(); const { error } = await supabase.from("foods").update(food).eq("id", uuid.parse(id)).eq("user_id", user.id); fail(error); revalidatePath("/nutrition"); }
export async function archiveFood(id: string) { const { supabase, user } = await ownedClient(); const { error } = await supabase.from("foods").update({ archived_at: new Date().toISOString() }).eq("id", uuid.parse(id)).eq("user_id", user.id); fail(error); revalidatePath("/nutrition"); }
export async function createMeal(input: unknown) { const meal = mealSchema.parse(input); const { supabase, user } = await ownedClient(); const { error } = await supabase.from("meal_entries").insert({ ...meal, user_id: user.id }); fail(error); revalidatePath("/"); revalidatePath("/nutrition"); revalidatePath("/insights"); }
export async function updateMeal(id: string, input: unknown) { const meal = mealSchema.parse(input); const { supabase, user } = await ownedClient(); const { error } = await supabase.from("meal_entries").update(meal).eq("id", uuid.parse(id)).eq("user_id", user.id); fail(error); revalidatePath("/"); revalidatePath("/nutrition"); revalidatePath("/insights"); }
export async function reviewMeal(id: string, status: "approved" | "denied") { const { supabase, user } = await ownedClient(); const { error } = await supabase.from("meal_entries").update({ review_status: z.enum(["approved", "denied"]).parse(status) }).eq("id", uuid.parse(id)).eq("user_id", user.id); fail(error); revalidatePath("/"); revalidatePath("/nutrition"); }
export async function archiveMeal(id: string) { const { supabase, user } = await ownedClient(); const { error } = await supabase.from("meal_entries").update({ archived_at: new Date().toISOString() }).eq("id", uuid.parse(id)).eq("user_id", user.id); fail(error); revalidatePath("/"); revalidatePath("/nutrition"); }
export async function copyMeals(fromDate: string, toDate: string, planned: boolean) {
  const from = isoDate.parse(fromDate), to = isoDate.parse(toDate); const { supabase, user } = await ownedClient();
  const { data, error } = await supabase.from("meal_entries").select("meal_slot,food_id,recipe_id,name,amount_grams,kcal,protein_g,carbs_g,fat_g,notes").eq("user_id", user.id).eq("entry_date", from).eq("is_planned", planned).is("archived_at", null); fail(error);
  if (data?.length) { const { error: insertError } = await supabase.from("meal_entries").insert(data.map((entry: any) => ({ ...entry, user_id: user.id, entry_date: to, is_planned: planned, review_status: "approved" }))); fail(insertError); }
  revalidatePath("/"); revalidatePath("/nutrition");
}
export async function saveNutritionTargets(input: unknown) {
  const data = z.object({ kcal: z.number().int().min(500).max(10000), protein_g: z.number().min(0).max(1000), carbs_g: z.number().min(0).max(1500), fat_g: z.number().min(0).max(1000), effective_from: isoDate }).parse(input);
  const { supabase, user } = await ownedClient(); const { error } = await supabase.from("nutrition_targets").insert({ ...data, user_id: user.id, is_manual: true, calculation: { source: "manual override" } }); fail(error); revalidatePath("/"); revalidatePath("/nutrition"); revalidatePath("/account");
}

const planSchema = z.object({ name: z.string().trim().min(1).max(100), description: z.string().max(1000).nullable().optional() });
export async function createPlan(input: unknown) { const data = planSchema.parse(input); const { supabase, user } = await ownedClient(); const { data: plan, error } = await supabase.from("training_plans").insert({ ...data, user_id: user.id }).select("id").single(); fail(error); revalidatePath("/train"); return plan?.id; }
export async function updatePlan(id: string, input: unknown) { const data = planSchema.parse(input); const { supabase, user } = await ownedClient(); const { error } = await supabase.from("training_plans").update(data).eq("id", uuid.parse(id)).eq("user_id", user.id); fail(error); revalidatePath("/train"); }
export async function activatePlan(id: string) { const { supabase, user } = await ownedClient(); const parsed = uuid.parse(id); const { error: clearError } = await supabase.from("training_plans").update({ is_active: false }).eq("user_id", user.id); fail(clearError); const { error } = await supabase.from("training_plans").update({ is_active: true }).eq("id", parsed).eq("user_id", user.id).is("archived_at", null); fail(error); revalidatePath("/"); revalidatePath("/train"); }
export async function archivePlan(id: string) { const { supabase, user } = await ownedClient(); const { error } = await supabase.from("training_plans").update({ archived_at: new Date().toISOString(), is_active: false }).eq("id", uuid.parse(id)).eq("user_id", user.id); fail(error); revalidatePath("/"); revalidatePath("/train"); }
export async function createPlanDay(input: unknown) { const data = z.object({ plan_id: uuid, name: z.string().trim().min(1).max(80), day_order: z.number().int().min(1).max(14), weekday: z.number().int().min(0).max(6).nullable().optional(), is_rest_day: z.boolean().default(false) }).parse(input); const { supabase, user } = await ownedClient(); const { error } = await supabase.from("plan_days").insert({ ...data, user_id: user.id }); fail(error); revalidatePath("/train"); }
export async function updatePlanDay(id: string, input: unknown) { const data = z.object({ name: z.string().trim().min(1).max(80), day_order: z.number().int().min(1).max(14), weekday: z.number().int().min(0).max(6).nullable().optional(), is_rest_day: z.boolean() }).parse(input); const { supabase, user } = await ownedClient(); const { error } = await supabase.from("plan_days").update(data).eq("id", uuid.parse(id)).eq("user_id", user.id); fail(error); revalidatePath("/train"); }
export async function addPlanExercise(input: unknown) { const data = z.object({ day_id: uuid, exercise_id: uuid, exercise_order: z.number().int().min(1).max(100), target_sets: z.number().int().min(1).max(20), rep_min: z.number().int().min(1).max(100), rep_max: z.number().int().min(1).max(100), rest_seconds: z.number().int().min(0).max(900), notes: z.string().max(1000).nullable().optional() }).refine((value) => value.rep_max >= value.rep_min, "Maximum reps must be greater than minimum reps.").parse(input); const { supabase, user } = await ownedClient(); const { error } = await supabase.from("plan_exercises").insert({ ...data, user_id: user.id }); fail(error); revalidatePath("/train"); revalidatePath("/"); }
export async function updatePlanExercise(id: string, input: unknown) { const data = z.object({ target_sets: z.number().int().min(1).max(20), rep_min: z.number().int().min(1).max(100), rep_max: z.number().int().min(1).max(100), rest_seconds: z.number().int().min(0).max(900), notes: z.string().max(1000).nullable().optional(), exercise_order: z.number().int().min(1).max(100) }).refine((value) => value.rep_max >= value.rep_min).parse(input); const { supabase, user } = await ownedClient(); const { error } = await supabase.from("plan_exercises").update(data).eq("id", uuid.parse(id)).eq("user_id", user.id); fail(error); revalidatePath("/train"); }
export async function removePlanExercise(id: string) { const { supabase, user } = await ownedClient(); const { error } = await supabase.from("plan_exercises").delete().eq("id", uuid.parse(id)).eq("user_id", user.id); fail(error); revalidatePath("/train"); }
export async function createExercise(input: unknown) { const data = z.object({ name: z.string().trim().min(1).max(100), primary_muscle: z.string().min(1).max(60), secondary_muscles: z.array(z.string().max(60)).max(8).default([]), equipment: z.string().min(1).max(60), movement_type: z.enum(["machine", "cable", "free_weight", "bodyweight"]), notes: z.string().max(1000).nullable().optional() }).parse(input); const { supabase, user } = await ownedClient(); const { error } = await supabase.from("exercises").insert({ ...data, user_id: user.id }); fail(error); revalidatePath("/train"); }
export async function archiveExercise(id: string) { const { supabase, user } = await ownedClient(); const { error } = await supabase.from("exercises").update({ archived_at: new Date().toISOString() }).eq("id", uuid.parse(id)).eq("user_id", user.id); fail(error); revalidatePath("/train"); }

export async function startWorkout(input: unknown) { const data = z.object({ title: z.string().trim().min(1).max(120), plan_id: uuid.nullable().optional(), plan_day_id: uuid.nullable().optional(), started_at: z.string().datetime().optional() }).parse(input); const { supabase, user } = await ownedClient(); const { data: session, error } = await supabase.from("workout_sessions").insert({ ...data, user_id: user.id }).select("id").single(); fail(error); revalidatePath("/"); revalidatePath("/train"); return session?.id; }
export async function addWorkoutExercise(input: unknown) { const data = z.object({ session_id: uuid, exercise_id: uuid.nullable().optional(), exercise_name: z.string().trim().min(1).max(120), exercise_order: z.number().int().min(1).max(100) }).parse(input); const { supabase, user } = await ownedClient(); const { data: session } = await supabase.from("workout_sessions").select("id").eq("id", data.session_id).eq("user_id", user.id).is("finished_at", null).maybeSingle(); if (!session) throw new Error("This workout is no longer active."); const { data: exercise, error } = await supabase.from("workout_exercises").insert({ ...data, user_id: user.id }).select("id").single(); fail(error); return exercise?.id; }
export async function logWorkoutSet(input: unknown) { const data = z.object({ workout_exercise_id: uuid, set_number: z.number().int().min(1).max(50), weight_kg: z.number().min(0).max(2000), reps: z.number().int().min(0).max(1000), rpe: z.number().min(1).max(10).nullable().optional(), is_warmup: z.boolean().default(false), notes: z.string().max(1000).nullable().optional() }).parse(input); const { supabase, user } = await ownedClient(); const { data: ex } = await supabase.from("workout_exercises").select("id,session_id").eq("id", data.workout_exercise_id).eq("user_id", user.id).maybeSingle(); if (!ex) throw new Error("Exercise is not part of your account."); const { data: session } = await supabase.from("workout_sessions").select("id").eq("id", ex.session_id).eq("user_id", user.id).is("finished_at", null).maybeSingle(); if (!session) throw new Error("Workout is already finished."); const { error } = await supabase.from("workout_sets").insert({ ...data, user_id: user.id, completed_at: new Date().toISOString() }); fail(error); revalidatePath("/train"); }
export async function updateWorkoutSet(id: string, input: unknown) { const data = z.object({ weight_kg: z.number().min(0).max(2000), reps: z.number().int().min(0).max(1000), rpe: z.number().min(1).max(10).nullable().optional(), is_warmup: z.boolean(), notes: z.string().max(1000).nullable().optional() }).parse(input); const { supabase, user } = await ownedClient(); const setId = uuid.parse(id); const { data: oldSet } = await supabase.from("workout_sets").select("id,workout_exercise_id").eq("id", setId).eq("user_id", user.id).maybeSingle(); if(!oldSet) throw new Error("Set not found in your account."); const { error } = await supabase.from("workout_sets").update(data).eq("id", setId).eq("user_id", user.id); fail(error); const { data: exercise } = await supabase.from("workout_exercises").select("session_id").eq("id", oldSet.workout_exercise_id).eq("user_id", user.id).maybeSingle(); if(exercise){const {data:rows}=await supabase.from("workout_exercises").select("id").eq("session_id",exercise.session_id).eq("user_id",user.id);const ids=(rows??[]).map((row:any)=>row.id);const {data:sets}=ids.length?await supabase.from("workout_sets").select("weight_kg,reps,is_warmup").eq("user_id",user.id).in("workout_exercise_id",ids):{data:[]};const volume=(sets??[]).filter((row:any)=>!row.is_warmup).reduce((sum:number,row:any)=>sum+Number(row.weight_kg??0)*Number(row.reps??0),0);await supabase.from("workout_sessions").update({total_volume:volume}).eq("id",exercise.session_id).eq("user_id",user.id);} revalidatePath("/train"); revalidatePath("/insights"); }
export async function finishWorkout(input: unknown) { const data = z.object({ session_id: uuid, duration_seconds: z.number().int().min(0).max(86400) }).parse(input); const { supabase, user } = await ownedClient(); const { data: exercises } = await supabase.from("workout_exercises").select("id,exercise_id").eq("session_id", data.session_id).eq("user_id", user.id); const ids = (exercises ?? []).map((item: any) => item.id); let volume = 0; const best: Array<{exercise_id:string;weight:number;reps:number;e1rm:number}> = [];
  if (ids.length) { const { data: sets } = await supabase.from("workout_sets").select("workout_exercise_id,weight_kg,reps,is_warmup").eq("user_id", user.id).in("workout_exercise_id", ids).eq("is_warmup", false); for (const item of sets ?? []) { volume += Number(item.weight_kg ?? 0) * Number(item.reps ?? 0); const exId = exercises?.find((ex: any) => ex.id === item.workout_exercise_id)?.exercise_id; if (!exId) continue; const weight = Number(item.weight_kg ?? 0), reps = Number(item.reps ?? 0), e1rm = reps ? weight * (1 + reps / 30) : weight; const found = best.find((record) => record.exercise_id === exId); if (!found) best.push({ exercise_id: exId, weight, reps, e1rm }); else { found.weight = Math.max(found.weight, weight); found.e1rm = Math.max(found.e1rm, e1rm); if (reps > found.reps) found.reps = reps; } } }
  const { error } = await supabase.from("workout_sessions").update({ finished_at: new Date().toISOString(), duration_seconds: data.duration_seconds, total_volume: volume }).eq("id", data.session_id).eq("user_id", user.id).is("finished_at", null); fail(error);
  for (const record of best) { const { data: existing } = await supabase.from("personal_records").select("value").eq("user_id", user.id).eq("exercise_id", record.exercise_id).eq("record_type", "estimated_1rm").order("value", { ascending: false }).limit(1).maybeSingle(); if (!existing || record.e1rm > existing.value) await supabase.from("personal_records").insert({ user_id: user.id, exercise_id: record.exercise_id, record_type: "estimated_1rm", value: record.e1rm, achieved_at: new Date().toISOString(), session_id: data.session_id }); }
  revalidatePath("/"); revalidatePath("/train"); revalidatePath("/insights"); }

const measurementSchema = z.object({ measured_at: isoDate, weight_kg: z.number().min(25).max(400).nullable().optional(), body_fat_pct: z.number().min(1).max(70).nullable().optional(), neck_cm: z.number().min(10).max(100).nullable().optional(), shoulders_cm: z.number().min(20).max(250).nullable().optional(), chest_cm: z.number().min(20).max(250).nullable().optional(), upper_arm_left_cm: z.number().min(10).max(100).nullable().optional(), upper_arm_right_cm: z.number().min(10).max(100).nullable().optional(), forearm_left_cm: z.number().min(10).max(100).nullable().optional(), forearm_right_cm: z.number().min(10).max(100).nullable().optional(), waist_cm: z.number().min(20).max(250).nullable().optional(), hips_cm: z.number().min(20).max(250).nullable().optional(), thigh_left_cm: z.number().min(20).max(150).nullable().optional(), thigh_right_cm: z.number().min(20).max(150).nullable().optional(), calf_left_cm: z.number().min(10).max(100).nullable().optional(), calf_right_cm: z.number().min(10).max(100).nullable().optional(), notes: z.string().max(2000).nullable().optional() });
export async function saveMeasurement(input: unknown) { const data = measurementSchema.parse(input); const { supabase, user } = await ownedClient(); const { error } = await supabase.from("measurements").insert({ ...data, user_id: user.id }); fail(error); revalidatePath("/"); revalidatePath("/body"); revalidatePath("/insights"); }
export async function updateMeasurement(id: string, input: unknown) { const data = measurementSchema.parse(input); const { supabase, user } = await ownedClient(); const { error } = await supabase.from("measurements").update(data).eq("id", uuid.parse(id)).eq("user_id", user.id); fail(error); revalidatePath("/"); revalidatePath("/body"); revalidatePath("/insights"); }
export async function saveMeasurementGoal(input: unknown) { const data = z.object({ metric: z.string().min(1).max(60), start_value: z.number().nullable().optional(), target_value: z.number(), starts_on: isoDate, target_date: isoDate.nullable().optional(), milestones: z.array(z.object({ value: z.number(), due_on: isoDate.nullable().optional() })).max(50).default([]) }).parse(input); const { supabase, user } = await ownedClient(); const { data: goal, error } = await supabase.from("measurement_goals").insert({ user_id: user.id, metric: data.metric, start_value: data.start_value, target_value: data.target_value, starts_on: data.starts_on, target_date: data.target_date }).select("id").single(); fail(error); if (goal && data.milestones.length) { const { error: msError } = await supabase.from("goal_milestones").insert(data.milestones.map((item) => ({ ...item, goal_id: goal.id, user_id: user.id }))); fail(msError); } revalidatePath("/body"); }
export async function archiveMeasurementGoal(id: string) { const { supabase, user } = await ownedClient(); const { error } = await supabase.from("measurement_goals").update({ archived_at: new Date().toISOString() }).eq("id", uuid.parse(id)).eq("user_id", user.id); fail(error); revalidatePath("/body"); }
export async function saveJournal(input: unknown) { const data = z.object({ entry_date: isoDate, sleep_hours: z.number().min(0).max(24).nullable().optional(), mood: z.number().int().min(1).max(5).nullable().optional(), energy: z.number().int().min(1).max(5).nullable().optional(), notes: z.string().max(4000).nullable().optional() }).parse(input); const { supabase, user } = await ownedClient(); const { error } = await supabase.from("daily_journal").upsert({ ...data, user_id: user.id, updated_at: new Date().toISOString() }, { onConflict: "user_id,entry_date" }); fail(error); revalidatePath("/"); }
export async function logWater(input: unknown) { const data = z.object({ entry_date: isoDate, amount_ml: z.number().int().min(1).max(5000) }).parse(input); const { supabase, user } = await ownedClient(); const { error } = await supabase.from("water_entries").insert({ ...data, user_id: user.id }); fail(error); revalidatePath("/"); }

export async function saveNotificationSettings(input: unknown) { const data = z.object({ push_enabled: z.boolean(), missed_workout_enabled: z.boolean(), reminder_enabled: z.boolean(), reminder_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/), timezone: z.string().min(1).max(80), quiet_hours_start: z.string().nullable().optional(), quiet_hours_end: z.string().nullable().optional() }).parse(input); const { supabase, user } = await ownedClient(); const { error } = await supabase.from("notification_settings").upsert({ ...data, user_id: user.id, updated_at: new Date().toISOString() }, { onConflict: "user_id" }); fail(error); revalidatePath("/account"); }
export async function savePushSubscription(input: unknown) { const data = z.object({ endpoint: z.string().url().max(2048), keys: z.object({ p256dh: z.string().min(20).max(500), auth: z.string().min(8).max(200) }), device_label: z.string().max(100).nullable().optional() }).parse(input); const { supabase, user } = await ownedClient(); const { error } = await supabase.from("push_subscriptions").upsert({ user_id: user.id, endpoint: data.endpoint, p256dh: data.keys.p256dh, auth_secret: data.keys.auth, device_label: data.device_label ?? "This device", last_seen_at: new Date().toISOString() }, { onConflict: "user_id,endpoint" }); fail(error); const { data: existing } = await supabase.from("notification_settings").select("user_id").eq("user_id", user.id).maybeSingle(); if(existing) { const { error: settingsError } = await supabase.from("notification_settings").update({ push_enabled: true }).eq("user_id", user.id); fail(settingsError); } else { const { error: settingsError } = await supabase.from("notification_settings").insert({ user_id: user.id, push_enabled: true }); fail(settingsError); } revalidatePath("/account"); }
export async function removePushSubscription(id: string) { const { supabase, user } = await ownedClient(); const { error } = await supabase.from("push_subscriptions").delete().eq("id", uuid.parse(id)).eq("user_id", user.id); fail(error); const { data: remaining } = await supabase.from("push_subscriptions").select("id").eq("user_id", user.id).limit(1); if(!remaining?.length) await supabase.from("notification_settings").update({ push_enabled: false }).eq("user_id", user.id); revalidatePath("/account"); }
export async function markNotificationRead(id: string) { const { supabase, user } = await ownedClient(); const { error } = await supabase.from("notification_events").update({ read_at: new Date().toISOString() }).eq("id", uuid.parse(id)).eq("user_id", user.id); fail(error); revalidatePath("/account"); }

export async function exportMyData() {
  const { supabase, user } = await ownedClient();
  const tables = ["profiles", "exercises", "training_plans", "plan_days", "plan_exercises", "workout_sessions", "workout_exercises", "workout_sets", "personal_records", "foods", "recipes", "recipe_ingredients", "meal_entries", "nutrition_targets", "measurements", "measurement_goals", "goal_milestones", "daily_journal", "progress_photos", "water_entries", "notification_settings", "push_subscriptions", "notification_events"] as const;
  const results = await Promise.all(tables.map(async (table) => ({ table, data: await supabase.from(table).select("*").eq("user_id", user.id) })));
  const escape = (cell: string) => `"${cell.replaceAll('"', '""')}"`;
  return ["table,record_json", ...results.flatMap(({ table, data }) => (data.data ?? []).map((row: any) => `${escape(table)},${escape(JSON.stringify(row))}`))].join("\r\n");
}

/** Add an editable starter plan only when the user chooses it. */
export async function addStarterPlan() {
  const { supabase, user } = await ownedClient();
  const movements = [
    { name: "Goblet squat", primary_muscle: "Legs", equipment: "Dumbbell", movement_type: "free_weight" },
    { name: "Dumbbell bench press", primary_muscle: "Chest", equipment: "Dumbbell", movement_type: "free_weight" },
    { name: "Seated cable row", primary_muscle: "Back", equipment: "Cable", movement_type: "cable" },
    { name: "Romanian deadlift", primary_muscle: "Hamstrings", equipment: "Dumbbell", movement_type: "free_weight" },
    { name: "Lat pulldown", primary_muscle: "Back", equipment: "Machine", movement_type: "machine" },
    { name: "Dumbbell shoulder press", primary_muscle: "Shoulders", equipment: "Dumbbell", movement_type: "free_weight" },
    { name: "Plank", primary_muscle: "Core", equipment: "Bodyweight", movement_type: "bodyweight" },
  ];
  const ids: Record<string, string> = {};
  for (const exercise of movements) {
    const existing = await supabase.from("exercises").select("id,archived_at").eq("user_id", user.id).eq("name", exercise.name).maybeSingle();
    fail(existing.error);
    if (existing.data) {
      ids[exercise.name] = existing.data.id;
      if (existing.data.archived_at) { const restored = await supabase.from("exercises").update({ archived_at: null }).eq("user_id", user.id).eq("id", existing.data.id); fail(restored.error); }
    } else {
      const inserted = await supabase.from("exercises").insert({ ...exercise, user_id: user.id }).select("id").single();
      fail(inserted.error);
      if (!inserted.data) throw new Error("Could not create starter exercise.");
      ids[exercise.name] = inserted.data.id;
    }
  }
  const result = await supabase.from("training_plans").insert({ user_id: user.id, name: "Full body · 3 days", description: "A flexible beginner-friendly starting point. Adjust exercises and days to suit you." }).select("id").single();
  fail(result.error);
  if (!result.data) throw new Error("Could not create the plan.");
  const planId = result.data.id;
  try {
    const days = [
      { name: "Full body A", weekday: 0, exercises: ["Goblet squat", "Dumbbell bench press", "Seated cable row", "Plank"] },
      { name: "Full body B", weekday: 2, exercises: ["Romanian deadlift", "Lat pulldown", "Dumbbell shoulder press", "Plank"] },
      { name: "Full body A", weekday: 4, exercises: ["Goblet squat", "Dumbbell bench press", "Seated cable row", "Plank"] },
    ];
    for (const [index, day] of days.entries()) {
      const saved = await supabase.from("plan_days").insert({ user_id: user.id, plan_id: planId, name: day.name, day_order: index + 1, weekday: day.weekday, is_rest_day: false }).select("id").single();
      fail(saved.error);
      if (!saved.data) throw new Error("Could not create plan day.");
      const entries = day.exercises.map((name, i) => ({ user_id: user.id, day_id: saved.data!.id, exercise_id: ids[name], exercise_order: i + 1, target_sets: 3, rep_min: name === "Plank" ? 20 : 8, rep_max: name === "Plank" ? 30 : 12, rest_seconds: 90, notes: name === "Plank" ? "Hold for 20–30 seconds per set." : "Choose a manageable weight and focus on technique." }));
      const inserted = await supabase.from("plan_exercises").insert(entries); fail(inserted.error);
    }
  } catch (error) {
    await supabase.from("training_plans").delete().eq("id", planId).eq("user_id", user.id);
    throw error;
  }
  revalidatePath("/train"); revalidatePath("/");
}
