/* eslint-disable @typescript-eslint/no-explicit-any */
import { endOfWeek, format, parseISO, startOfWeek } from "date-fns";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getPublicSupabaseConfig } from "@/lib/supabase/config";

export const configured = getPublicSupabaseConfig().configured;
export type PageContext = { status: "setup" | "signed-out" | "ready"; user?: { id: string; email?: string }; profile?: any };
export async function getPageContext(): Promise<PageContext> {
  if (!configured) return { status: "setup" };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { status: "signed-out" };
  const { data: profile } = await supabase.from("profiles").select("*").eq("user_id", user.id).maybeSingle();
  return { status: "ready", user: { id: user.id, email: user.email }, profile };
}
export async function requireReadyContext() {
  const ctx = await getPageContext();
  if (ctx.status === "signed-out") redirect("/login");
  return ctx;
}
const rows = (value: unknown) => Array.isArray(value) ? value : [];
const isDate = (value?: string): value is string => Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0,10) === value);
export async function getTodayData(dateValue?: string) {
  const ctx = await requireReadyContext();
  if (ctx.status !== "ready" || !ctx.user) return { context: ctx, days: [], activePlan: null };
  const date = isDate(dateValue) ? parseISO(dateValue) : new Date();
  const start = startOfWeek(date, { weekStartsOn: 1 });
  const end = endOfWeek(date, { weekStartsOn: 1 });
  const startDate = format(start, "yyyy-MM-dd");
  const endDate = format(end, "yyyy-MM-dd");
  const uid = ctx.user.id;
  const supabase = await createClient();
  const [planResult, sessionsResult, mealsResult, measuresResult, journalResult, waterResult, targetResult] = await Promise.all([
    supabase.from("training_plans").select("id,name,description").eq("user_id", uid).eq("is_active", true).is("archived_at", null).maybeSingle(),
    supabase.from("workout_sessions").select("id,title,started_at,finished_at,duration_seconds,total_volume").eq("user_id", uid).gte("started_at", `${startDate}T00:00:00`).lte("started_at", `${endDate}T23:59:59`).is("archived_at", null).order("started_at"),
    supabase.from("meal_entries").select("id,entry_date,meal_slot,name,amount_grams,kcal,protein_g,carbs_g,fat_g,is_planned,review_status,notes").eq("user_id", uid).gte("entry_date", startDate).lte("entry_date", endDate).is("archived_at", null).order("created_at"),
    supabase.from("measurements").select("id,measured_at,weight_kg,body_fat_pct,waist_cm").eq("user_id", uid).gte("measured_at", startDate).lte("measured_at", endDate).order("measured_at"),
    supabase.from("daily_journal").select("id,entry_date,sleep_hours,mood,energy,notes").eq("user_id", uid).gte("entry_date", startDate).lte("entry_date", endDate),
    supabase.from("water_entries").select("id,entry_date,amount_ml").eq("user_id", uid).gte("entry_date", startDate).lte("entry_date", endDate),
    supabase.from("nutrition_targets").select("kcal,protein_g,carbs_g,fat_g,effective_from,is_manual,calculation").eq("user_id", uid).lte("effective_from", endDate).order("effective_from", { ascending: false }).limit(1).maybeSingle(),
  ]);
  const plan = planResult.data;
  let planDays: any[] = [];
  if (plan) {
    const { data } = await supabase.from("plan_days").select("id,name,day_order,weekday,is_rest_day").eq("user_id", uid).eq("plan_id", plan.id).order("day_order");
    planDays = rows(data);
  }
  let planExerciseRows: any[] = [];
  if (planDays.length) {
    const { data } = await supabase.from("plan_exercises").select("id,day_id,exercise_id,exercise_order,target_sets,rep_min,rep_max,rest_seconds,notes").eq("user_id", uid).in("day_id", planDays.map((item) => item.id)).order("exercise_order");
    planExerciseRows = rows(data);
  }
  const exerciseIds = [...new Set(planExerciseRows.map((item) => item.exercise_id))];
  const { data: planExercises } = exerciseIds.length ? await supabase.from("exercises").select("id,name,primary_muscle,equipment").eq("user_id", uid).in("id", exerciseIds) : { data: [] };
  const days = Array.from({ length: 7 }, (_, index) => {
    const dayDate = new Date(start); dayDate.setDate(start.getDate() + index);
    const key = format(dayDate, "yyyy-MM-dd");
    const dayMeals = rows(mealsResult.data).filter((item: any) => item.entry_date === key);
    const actual = dayMeals.filter((item: any) => !item.is_planned && item.review_status === "approved");
    const planned = dayMeals.filter((item: any) => item.is_planned && item.review_status !== "denied");
    const totals = (items: any[]) => items.reduce((total, item) => ({ kcal: total.kcal + Number(item.kcal || 0), protein: total.protein + Number(item.protein_g || 0), carbs: total.carbs + Number(item.carbs_g || 0), fat: total.fat + Number(item.fat_g || 0) }), { kcal: 0, protein: 0, carbs: 0, fat: 0 });
    const weekday = (dayDate.getDay() + 6) % 7;
    const session = rows(sessionsResult.data).filter((item: any) => format(parseISO(item.started_at), "yyyy-MM-dd") === key);
    return { date: key, label: format(dayDate, "EEE"), shortDate: format(dayDate, "MMM d"), meals: dayMeals, actual: totals(actual), planned: totals(planned), planDay: (() => { const day = planDays.find((item) => item.weekday === weekday) ?? null; return day ? { ...day, exercises: planExerciseRows.filter((item) => item.day_id === day.id).map((item) => ({ ...item, exercise: rows(planExercises).find((exercise: any) => exercise.id === item.exercise_id) ?? null })) } : null; })(), sessions: session,
      measurement: rows(measuresResult.data).filter((item: any) => item.measured_at === key).at(-1) ?? null,
      journal: rows(journalResult.data).find((item: any) => item.entry_date === key) ?? null,
      waterMl: rows(waterResult.data).filter((item: any) => item.entry_date === key).reduce((sum: number, item: any) => sum + item.amount_ml, 0),
    };
  });
  return { context: ctx, days, activePlan: plan, target: targetResult.data, startDate, endDate, selectedDate: format(date, "yyyy-MM-dd") };
}
export async function getNutritionData(dateValue?: string) {
  const ctx = await requireReadyContext();
  if (ctx.status !== "ready" || !ctx.user) return { context: ctx, entries: [], foods: [], targets: [], date: dateValue ?? null };
  const date = isDate(dateValue) ? dateValue : format(new Date(), "yyyy-MM-dd");
  const supabase = await createClient(); const uid = ctx.user.id;
  const [entries, foods, targets, settings] = await Promise.all([
    supabase.from("meal_entries").select("*").eq("user_id", uid).eq("entry_date", date).is("archived_at", null).order("created_at"),
    supabase.from("foods").select("*").eq("user_id", uid).is("archived_at", null).order("name"),
    supabase.from("nutrition_targets").select("*").eq("user_id", uid).lte("effective_from", date).order("effective_from", { ascending: false }).limit(1),
    supabase.from("notification_settings").select("user_id").eq("user_id", uid).maybeSingle(),
  ]);
  return { context: ctx, entries: rows(entries.data), foods: rows(foods.data), targets: rows(targets.data), date, settings: settings.data };
}
export async function getTrainingData() {
  const ctx = await requireReadyContext();
  if (ctx.status !== "ready" || !ctx.user) return { context: ctx, plans: [], exercises: [], sessions: [], activePlan: null };
  const supabase = await createClient(); const uid = ctx.user.id;
  const [plans, exercises, sessions] = await Promise.all([
    supabase.from("training_plans").select("*").eq("user_id", uid).is("archived_at", null).order("created_at"),
    supabase.from("exercises").select("*").eq("user_id", uid).is("archived_at", null).order("name"),
    supabase.from("workout_sessions").select("*").eq("user_id", uid).is("archived_at", null).order("started_at", { ascending: false }).limit(30),
  ]);
  const planRows = rows(plans.data); const exerciseRows = rows(exercises.data);
  const { data: days } = planRows.length ? await supabase.from("plan_days").select("*").eq("user_id", uid).in("plan_id", planRows.map((p: any) => p.id)).order("day_order") : { data: [] };
  const dayRows = rows(days);
  const { data: planExerciseData } = dayRows.length ? await supabase.from("plan_exercises").select("*").eq("user_id", uid).in("day_id", dayRows.map((d: any) => d.id)).order("exercise_order") : { data: [] };
  const items = rows(planExerciseData).map((item: any) => ({ ...item, exercise: exerciseRows.find((exercise: any) => exercise.id === item.exercise_id) ?? null }));
  const hydratedPlans = planRows.map((plan: any) => ({ ...plan, days: dayRows.filter((day: any) => day.plan_id === plan.id).map((day: any) => ({ ...day, exercises: items.filter((item: any) => item.day_id === day.id) })) }));
  const { data: records } = await supabase.from("personal_records").select("*").eq("user_id", uid).order("achieved_at", { ascending: false }).limit(40);
  const sessionRows = rows(sessions.data);
  const sessionIds = sessionRows.map((session: any) => session.id);
  const { data: loggedExercises } = sessionIds.length ? await supabase.from("workout_exercises").select("*").eq("user_id", uid).in("session_id", sessionIds) : { data: [] };
  const exerciseLogs = rows(loggedExercises);
  const { data: setRows } = exerciseLogs.length ? await supabase.from("workout_sets").select("*").eq("user_id", uid).in("workout_exercise_id", exerciseLogs.map((item: any) => item.id)).order("set_number") : { data: [] };
  const history = sessionRows.map((session: any) => ({ ...session, exercises: exerciseLogs.filter((item: any) => item.session_id === session.id).map((item: any) => ({ ...item, sets: rows(setRows).filter((set: any) => set.workout_exercise_id === item.id) })) }));
  return { context: ctx, plans: hydratedPlans, exercises: exerciseRows, sessions: history, records: rows(records), activePlan: hydratedPlans.find((plan: any) => plan.is_active) ?? null };
}
export async function getBodyData() {
  const ctx = await requireReadyContext();
  if (ctx.status !== "ready" || !ctx.user) return { context: ctx, measurements: [], goals: [], milestones: [] };
  const supabase = await createClient(); const uid = ctx.user.id;
  const [measurements, goals] = await Promise.all([
    supabase.from("measurements").select("*").eq("user_id", uid).order("measured_at", { ascending: false }).limit(500),
    supabase.from("measurement_goals").select("*").eq("user_id", uid).is("archived_at", null).order("created_at", { ascending: false }),
  ]);
  const goalRows = rows(goals.data);
  const { data: milestones } = goalRows.length ? await supabase.from("goal_milestones").select("*").eq("user_id", uid).in("goal_id", goalRows.map((goal: any) => goal.id)).order("due_on") : { data: [] };
  return { context: ctx, measurements: rows(measurements.data), goals: goalRows, milestones: rows(milestones) };
}
export async function getInsightsData(fromValue?: string, toValue?: string) {
  const ctx = await requireReadyContext();
  if (ctx.status !== "ready" || !ctx.user) return { context: ctx, sessions: [], meals: [], measurements: [], days: [] };
  const initialFrom = isDate(fromValue) ? fromValue : format(startOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd");
  const initialTo = isDate(toValue) ? toValue : format(new Date(), "yyyy-MM-dd");
  const from = initialFrom <= initialTo ? initialFrom : initialTo;
  const to = initialFrom <= initialTo ? initialTo : initialFrom;
  const supabase = await createClient(); const uid = ctx.user.id;
  const [sessions, meals, measurements, targets, profile, journal, water] = await Promise.all([
    supabase.from("workout_sessions").select("*").eq("user_id", uid).gte("started_at", `${from}T00:00:00`).lte("started_at", `${to}T23:59:59`).is("archived_at", null).order("started_at"),
    supabase.from("meal_entries").select("*").eq("user_id", uid).gte("entry_date", from).lte("entry_date", to).is("archived_at", null).order("entry_date"),
    supabase.from("measurements").select("*").eq("user_id", uid).gte("measured_at", from).lte("measured_at", to).order("measured_at"),
    supabase.from("nutrition_targets").select("*").eq("user_id", uid).lte("effective_from", to).order("effective_from"),
    supabase.from("profiles").select("full_name,goal,weight_kg,height_cm,birth_date").eq("user_id", uid).maybeSingle(),
    supabase.from("daily_journal").select("entry_date,sleep_hours,mood,energy").eq("user_id", uid).gte("entry_date", from).lte("entry_date", to),
    supabase.from("water_entries").select("entry_date,amount_ml").eq("user_id", uid).gte("entry_date", from).lte("entry_date", to),
  ]);
  const yearStart = `${to.slice(0, 4)}-01-01`, yearEnd = `${to.slice(0,4)}-12-31`;
  const { data: yearSessions } = await supabase.from("workout_sessions").select("started_at,total_volume").eq("user_id", uid).gte("started_at", `${yearStart}T00:00:00`).lte("started_at", `${yearEnd}T23:59:59`).is("archived_at", null);
  return { context: ctx, sessions: rows(sessions.data), meals: rows(meals.data), measurements: rows(measurements.data), targets: rows(targets.data), profile: profile.data, journal: rows(journal.data), water: rows(water.data), yearSessions: rows(yearSessions), from, to };
}
export async function getAccountData() {
  const ctx = await requireReadyContext();
  if (ctx.status !== "ready" || !ctx.user) return { context: ctx, targets: [], settings: null, subscriptions: [], events: [] };
  const supabase = await createClient(); const uid = ctx.user.id;
  const [targets, settings, subscriptions, events] = await Promise.all([
    supabase.from("nutrition_targets").select("*").eq("user_id", uid).order("effective_from", { ascending: false }).limit(20),
    supabase.from("notification_settings").select("*").eq("user_id", uid).maybeSingle(),
    supabase.from("push_subscriptions").select("id,device_label,last_seen_at,created_at").eq("user_id", uid).order("last_seen_at", { ascending: false }),
    supabase.from("notification_events").select("*").eq("user_id", uid).order("created_at", { ascending: false }).limit(30),
  ]);
  return { context: ctx, targets: rows(targets.data), settings: settings.data, subscriptions: rows(subscriptions.data), events: rows(events.data) };
}
