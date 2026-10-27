/* eslint-disable @typescript-eslint/no-explicit-any */
import { addDays, differenceInCalendarDays, endOfWeek, format, parseISO, startOfWeek, subDays } from "date-fns";
import { cacheLife } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getPublicSupabaseConfig } from "@/lib/supabase/config";

export const configured = getPublicSupabaseConfig().configured;
export type PageContext = {
  status: "setup" | "signed-out" | "ready";
  user?: { id: string; email?: string };
  profile?: any;
};
export async function getPageContext(): Promise<PageContext> {
  if (!configured) return { status: "setup" };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "signed-out" };
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();
  return { status: "ready", user: { id: user.id, email: user.email }, profile };
}
export async function requireReadyContext() {
  const ctx = await getPageContext();
  if (ctx.status === "signed-out") redirect("/login");
  return ctx;
}
function checkQueries(
  ...results: { error?: { message: string; code?: string } | null }[]
) {
  const error = results.find((result) => result.error)?.error;
  if (error)
    throw new Error(
      ["42703", "42P01", "PGRST202"].includes(error.code ?? "")
        ? "Datenbank-Update erforderlich: supabase/setup.sql im Supabase SQL Editor ausführen."
        : "Daten konnten nicht geladen werden. Bitte erneut versuchen.",
    );
}
const rows = (value: unknown) => (Array.isArray(value) ? value : []);
const localAppDate = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
const isDate = (value?: string): value is string =>
  Boolean(
    value &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) &&
    new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value,
  );
export async function getTodayData(dateValue?: string) {
  "use cache: private";
  cacheLife({ stale: 300 });
  const ctx = await requireReadyContext();
  if (ctx.status !== "ready" || !ctx.user)
    return { context: ctx, days: [], activePlan: null };
  const date = parseISO(isDate(dateValue) ? dateValue : localAppDate());
  const start = startOfWeek(date, { weekStartsOn: 1 });
  const end = endOfWeek(date, { weekStartsOn: 1 });
  const startDate = format(start, "yyyy-MM-dd");
  const endDate = format(end, "yyyy-MM-dd");
  const uid = ctx.user.id;
  const supabase = await createClient();
  const [
    planResult,
    sessionsResult,
    mealsResult,
    measuresResult,
    journalResult,
    waterResult,
    targetResult,
    foodsResult,
    planExerciseResult,
    exerciseResult,
    mealTemplatesResult,
    mealTemplateSkipsResult,
  ] = await Promise.all([
    supabase
      .from("training_plans")
      .select("id,name,description")
      .eq("user_id", uid)
      .eq("is_active", true)
      .is("archived_at", null)
      .maybeSingle(),
    supabase
      .from("workout_sessions")
      .select("id,title,started_at,finished_at,duration_seconds,total_volume")
      .eq("user_id", uid)
      .gte("started_at", `${startDate}T00:00:00`)
      .lte("started_at", `${endDate}T23:59:59`)
      .is("archived_at", null)
      .order("started_at"),
    supabase
      .from("meal_entries")
      .select("*")
      .eq("user_id", uid)
      .gte("entry_date", startDate)
      .lte("entry_date", endDate)
      .is("archived_at", null)
      .order("created_at"),
    supabase
      .from("measurements")
      .select("id,measured_at,weight_kg,body_fat_pct,waist_cm")
      .eq("user_id", uid)
      .gte("measured_at", startDate)
      .lte("measured_at", endDate)
      .order("measured_at"),
    supabase
      .from("daily_journal")
      .select("id,entry_date,sleep_hours,mood,energy,notes")
      .eq("user_id", uid)
      .gte("entry_date", startDate)
      .lte("entry_date", endDate),
    supabase
      .from("water_entries")
      .select("id,entry_date,amount_ml")
      .eq("user_id", uid)
      .gte("entry_date", startDate)
      .lte("entry_date", endDate),
    supabase
      .from("nutrition_targets")
      .select(
        "kcal,protein_g,carbs_g,fat_g,effective_from,is_manual,calculation",
      )
      .eq("user_id", uid)
      .lte("effective_from", format(date, "yyyy-MM-dd"))
      .order("effective_from", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("foods")
      .select("*")
      .eq("user_id", uid)
      .is("archived_at", null)
      .order("name"),
    supabase
      .from("plan_exercises")
      .select("*")
      .eq("user_id", uid)
      .order("exercise_order"),
    supabase
      .from("exercises")
      .select("id,name,primary_muscle,equipment")
      .eq("user_id", uid),
    supabase
      .from("meal_plan_templates")
      .select("id,weekday,meal_slot,meal_time,name,amount_grams,kcal,protein_g,carbs_g,fat_g,active_from")
      .eq("user_id", uid)
      .eq("is_active", true)
      .lte("active_from", endDate),
    supabase
      .from("meal_plan_template_skips")
      .select("template_id,entry_date")
      .eq("user_id", uid)
      .gte("entry_date", startDate)
      .lte("entry_date", endDate),
  ]);
  checkQueries(
    planResult,
    sessionsResult,
    mealsResult,
    measuresResult,
    journalResult,
    waterResult,
    targetResult,
    foodsResult,
    planExerciseResult,
    exerciseResult,
    mealTemplatesResult,
    mealTemplateSkipsResult,
  );
  const plan = planResult.data;
  let planDays: any[] = [];
  if (plan) {
    const { data, error } = await supabase
      .from("plan_days")
      .select("id,name,day_order,weekday,is_rest_day")
      .eq("user_id", uid)
      .eq("plan_id", plan.id)
      .order("day_order");
    checkQueries({ error });
    planDays = rows(data);
  }
  const activeDayIds = new Set(planDays.map((day) => day.id));
  const planExerciseRows = rows(planExerciseResult.data).filter((item) =>
    activeDayIds.has(item.day_id),
  );
  const planExercises = rows(exerciseResult.data);
  const localToday = localAppDate();
  const autoSchedule = new Map<string, any>();
  let autoRearrange = false;
  if (plan && localToday >= startDate && localToday <= endDate && planDays.length) {
    const { data: latestWorkout, error: latestWorkoutError } = await supabase
      .from("workout_sessions")
      .select("id,started_at,plan_day_id")
      .eq("user_id", uid)
      .eq("plan_id", plan.id)
      .not("finished_at", "is", null)
      .is("archived_at", null)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    checkQueries({ error: latestWorkoutError });
    const lastWorkoutDate = latestWorkout?.started_at
      ? format(parseISO(latestWorkout.started_at), "yyyy-MM-dd")
      : null;
    const pauseDays = lastWorkoutDate
      ? differenceInCalendarDays(parseISO(localToday), parseISO(lastWorkoutDate))
      : 0;
    const orderedDays = [...planDays].sort((a, b) => a.day_order - b.day_order);
    const lastIndex = orderedDays.findIndex((day) => day.id === latestWorkout?.plan_day_id);
    const nextIndex = lastIndex >= 0 ? (lastIndex + 1) % orderedDays.length : 0;
    const gapBetween = (from: any, to: any) =>
      from.weekday == null || to.weekday == null
        ? Math.max(2, Math.round(7 / orderedDays.length))
        : ((to.weekday - from.weekday + 7) % 7) || 7;
    const shiftedFromTemplate = Boolean(
      latestWorkout &&
      orderedDays[lastIndex]?.weekday != null &&
      ((parseISO(lastWorkoutDate!).getDay() + 6) % 7) !== orderedDays[lastIndex].weekday,
    );
    const hasOpenSession = rows(sessionsResult.data).some((session) => !session.finished_at);
    if ((pauseDays >= 3 || shiftedFromTemplate) && !hasOpenSession) {
      autoRearrange = true;
      let planIndex = nextIndex;
      let scheduleDate = pauseDays >= 3 || !lastWorkoutDate
        ? parseISO(localToday)
        : addDays(parseISO(lastWorkoutDate), gapBetween(orderedDays[Math.max(lastIndex, 0)], orderedDays[planIndex]));
      if (scheduleDate < parseISO(localToday)) scheduleDate = parseISO(localToday);
      while (scheduleDate <= end) {
        const scheduled = orderedDays[planIndex];
        const key = format(scheduleDate, "yyyy-MM-dd");
        autoSchedule.set(key, { ...scheduled, auto_rescheduled: true });
        const current = orderedDays[planIndex];
        const next = orderedDays[(planIndex + 1) % orderedDays.length];
        const gap = gapBetween(current, next);
        scheduleDate = addDays(scheduleDate, gap);
        planIndex = (planIndex + 1) % orderedDays.length;
      }
    }
  }
  const days = Array.from({ length: 7 }, (_, index) => {
    const dayDate = new Date(start);
    dayDate.setDate(start.getDate() + index);
    const key = format(dayDate, "yyyy-MM-dd");
    const dayMeals = rows(mealsResult.data).filter(
      (item: any) => item.entry_date === key,
    );
    const weekday = (dayDate.getDay() + 6) % 7;
    const consumedTemplateIds = new Set(dayMeals.map((item: any) => item.source_template_id).filter(Boolean));
    const skippedTemplateIds = new Set(rows(mealTemplateSkipsResult.data).filter((skip: any) => skip.entry_date === key).map((skip: any) => skip.template_id));
    const recurringMeals = rows(mealTemplatesResult.data)
      .filter((template: any) => template.weekday === weekday && template.active_from <= key && !consumedTemplateIds.has(template.id) && !skippedTemplateIds.has(template.id))
      .map((template: any) => ({
        ...template,
        id: `template-${template.id}-${key}`,
        template_id: template.id,
        entry_date: key,
        is_template: true,
        is_planned: true,
        review_status: "approved",
        notes: "Wiederkehrender Wochenplan",
      }));
    const mealsForDay = [...dayMeals, ...recurringMeals];
    const actual = dayMeals.filter(
      (item: any) => !item.is_planned && item.review_status === "approved",
    );
    const planned = mealsForDay.filter(
      (item: any) => item.is_planned && item.review_status !== "denied",
    );
    const totals = (items: any[]) =>
      items.reduce(
        (total, item) => ({
          kcal: total.kcal + Number(item.kcal || 0),
          protein: total.protein + Number(item.protein_g || 0),
          carbs: total.carbs + Number(item.carbs_g || 0),
          fat: total.fat + Number(item.fat_g || 0),
        }),
        { kcal: 0, protein: 0, carbs: 0, fat: 0 },
      );
    const session = rows(sessionsResult.data).filter(
      (item: any) => format(parseISO(item.started_at), "yyyy-MM-dd") === key,
    );
    return {
      date: key,
      label: format(dayDate, "EEE"),
      shortDate: format(dayDate, "MMM d"),
      meals: mealsForDay,
      actual: totals(actual),
      planned: totals(planned),
      planDay: (() => {
        const regular = planDays.find((item) => item.weekday === weekday) ?? null;
        const day = autoSchedule.get(key) ?? (autoRearrange && key >= localToday ? null : regular);
        return day
          ? {
              ...day,
              exercises: planExerciseRows
                .filter((item) => item.day_id === day.id)
                .map((item) => ({
                  ...item,
                  exercise:
                    rows(planExercises).find(
                      (exercise: any) => exercise.id === item.exercise_id,
                    ) ?? null,
                })),
            }
          : null;
      })(),
      sessions: session,
      measurement:
        rows(measuresResult.data)
          .filter((item: any) => item.measured_at === key)
          .at(-1) ?? null,
      journal:
        rows(journalResult.data).find((item: any) => item.entry_date === key) ??
        null,
      waterMl: rows(waterResult.data)
        .filter((item: any) => item.entry_date === key)
        .reduce((sum: number, item: any) => sum + item.amount_ml, 0),
    };
  });
  return {
    context: ctx,
    days,
    foods: rows(foodsResult.data),
    activePlan: plan,
    target: targetResult.data,
    startDate,
    endDate,
    selectedDate: format(date, "yyyy-MM-dd"),
  };
}
export async function getNutritionData(dateValue?: string) {
  "use cache: private";
  cacheLife({ stale: 300 });
  const ctx = await requireReadyContext();
  if (ctx.status !== "ready" || !ctx.user)
    return {
      context: ctx,
      entries: [],
      foods: [],
      targets: [],
      date: dateValue ?? null,
    };
  const date = isDate(dateValue) ? dateValue : localAppDate();
  const supabase = await createClient();
  const uid = ctx.user.id;
  const [entries, foods, targets, settings, recurring, skipped] = await Promise.all([
    supabase
      .from("meal_entries")
      .select("*")
      .eq("user_id", uid)
      .eq("entry_date", date)
      .is("archived_at", null)
      .order("created_at"),
    supabase
      .from("foods")
      .select("*")
      .eq("user_id", uid)
      .is("archived_at", null)
      .order("name"),
    supabase
      .from("nutrition_targets")
      .select("*")
      .eq("user_id", uid)
      .lte("effective_from", date)
      .order("effective_from", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(1),
    supabase
      .from("notification_settings")
      .select("user_id")
      .eq("user_id", uid)
      .maybeSingle(),
    supabase
      .from("meal_plan_templates")
      .select("id,weekday,meal_slot,meal_time,name,amount_grams,kcal,protein_g,carbs_g,fat_g,active_from")
      .eq("user_id", uid)
      .eq("is_active", true)
      .lte("active_from", date),
    supabase
      .from("meal_plan_template_skips")
      .select("template_id")
      .eq("user_id", uid)
      .eq("entry_date", date),
  ]);
  checkQueries(entries, foods, targets, settings, recurring, skipped);
  const savedEntries = rows(entries.data);
  const weekday = (parseISO(date).getDay() + 6) % 7;
  const consumedTemplateIds = new Set(savedEntries.map((item: any) => item.source_template_id).filter(Boolean));
  const skippedTemplateIds = new Set(rows(skipped.data).map((item: any) => item.template_id));
  const recurringEntries = rows(recurring.data)
    .filter((template: any) => template.weekday === weekday && !consumedTemplateIds.has(template.id) && !skippedTemplateIds.has(template.id))
    .map((template: any) => ({
      ...template,
      id: `template-${template.id}-${date}`,
      template_id: template.id,
      entry_date: date,
      is_template: true,
      is_planned: true,
      review_status: "approved",
      notes: "Wiederkehrender Wochenplan",
    }));
  return {
    context: ctx,
    entries: [...savedEntries, ...recurringEntries],
    foods: rows(foods.data),
    targets: rows(targets.data),
    date,
    settings: settings.data,
  };
}
export async function getTrainingData() {
  "use cache: private";
  cacheLife({ stale: 300 });
  const ctx = await requireReadyContext();
  if (ctx.status !== "ready" || !ctx.user)
    return {
      context: ctx,
      plans: [],
      exercises: [],
      sessions: [],
      activePlan: null,
    };
  const supabase = await createClient();
  const uid = ctx.user.id;
  const [
    plans,
    exercises,
    sessions,
    activeSessions,
    days,
    planExerciseData,
    records,
  ] = await Promise.all([
    supabase
      .from("training_plans")
      .select("*")
      .eq("user_id", uid)
      .is("archived_at", null)
      .order("created_at"),
    supabase
      .from("exercises")
      .select("*")
      .eq("user_id", uid)
      .is("archived_at", null)
      .order("name"),
    supabase
      .from("workout_sessions")
      .select("*")
      .eq("user_id", uid)
      .is("archived_at", null)
      .order("started_at", { ascending: false })
      .limit(30),
    supabase
      .from("workout_sessions")
      .select("*")
      .eq("user_id", uid)
      .is("archived_at", null)
      .is("finished_at", null)
      .order("started_at", { ascending: false }),
    supabase
      .from("plan_days")
      .select("*")
      .eq("user_id", uid)
      .order("day_order"),
    supabase
      .from("plan_exercises")
      .select("*")
      .eq("user_id", uid)
      .order("exercise_order"),
    supabase
      .from("personal_records")
      .select("*")
      .eq("user_id", uid)
      .order("achieved_at", { ascending: false })
      .limit(40),
  ]);
  checkQueries(
    plans,
    exercises,
    sessions,
    activeSessions,
    days,
    planExerciseData,
    records,
  );
  const planRows = rows(plans.data);
  const exerciseRows = rows(exercises.data);
  const planIds = new Set(planRows.map((plan: any) => plan.id));
  const dayRows = rows(days.data).filter((day: any) => planIds.has(day.plan_id));
  const dayIds = new Set(dayRows.map((day: any) => day.id));
  const items = rows(planExerciseData.data).filter((item: any) => dayIds.has(item.day_id)).map((item: any) => ({
    ...item,
    exercise:
      exerciseRows.find((exercise: any) => exercise.id === item.exercise_id) ??
      null,
  }));
  const hydratedPlans = planRows.map((plan: any) => ({
    ...plan,
    days: dayRows
      .filter((day: any) => day.plan_id === plan.id)
      .map((day: any) => ({
        ...day,
        exercises: items.filter((item: any) => item.day_id === day.id),
      })),
  }));
  const sessionRows = [
    ...rows(activeSessions.data),
    ...rows(sessions.data).filter(
      (s: any) => !rows(activeSessions.data).some((a: any) => a.id === s.id),
    ),
  ];
  const sessionIds = sessionRows.map((session: any) => session.id);
  const { data: loggedExercises, error: logError } = sessionIds.length
    ? await supabase
        .from("workout_exercises")
        .select("*,workout_sets(*)")
        .eq("user_id", uid)
        .in("session_id", sessionIds)
    : { data: [], error: null };
  checkQueries({ error: logError });
  const exerciseLogs = rows(loggedExercises);
  const history = sessionRows.map((session: any) => ({
    ...session,
    exercises: exerciseLogs
      .filter((item: any) => item.session_id === session.id)
      .map((item: any) => ({
        ...item,
        sets: rows(item.workout_sets).sort(
          (left: any, right: any) => left.set_number - right.set_number,
        ),
      })),
  }));
  return {
    context: ctx,
    plans: hydratedPlans,
    exercises: exerciseRows,
    sessions: history,
    records: rows(records.data),
    activePlan: hydratedPlans.find((plan: any) => plan.is_active) ?? null,
  };
}
export async function getBodyData() {
  "use cache: private";
  cacheLife({ stale: 300 });
  const ctx = await requireReadyContext();
  if (ctx.status !== "ready" || !ctx.user)
    return { context: ctx, measurements: [], goals: [], milestones: [] };
  const supabase = await createClient();
  const uid = ctx.user.id;
  const [measurements, goals, milestones] = await Promise.all([
    supabase
      .from("measurements")
      .select("*")
      .eq("user_id", uid)
      .order("measured_at", { ascending: false })
      .limit(500),
    supabase
      .from("measurement_goals")
      .select("*")
      .eq("user_id", uid)
      .is("archived_at", null)
      .order("created_at", { ascending: false }),
    supabase
      .from("goal_milestones")
      .select("*")
      .eq("user_id", uid)
      .order("due_on"),
  ]);
  checkQueries(measurements, goals, milestones);
  const goalRows = rows(goals.data);
  const goalIds = new Set(goalRows.map((goal: any) => goal.id));
  return {
    context: ctx,
    measurements: rows(measurements.data),
    goals: goalRows,
    milestones: rows(milestones.data).filter((item: any) =>
      goalIds.has(item.goal_id),
    ),
  };
}
export async function getInsightsData(fromValue?: string, toValue?: string) {
  "use cache: private";
  cacheLife({ stale: 300 });
  const ctx = await requireReadyContext();
  if (ctx.status !== "ready" || !ctx.user)
    return {
      context: ctx,
      sessions: [],
      meals: [],
      measurements: [],
      days: [],
    };
  const initialFrom = isDate(fromValue)
    ? fromValue
    : format(startOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd");
  const initialTo = isDate(toValue)
    ? toValue
    : format(new Date(), "yyyy-MM-dd");
  const rawFrom = initialFrom <= initialTo ? initialFrom : initialTo;
  const to = initialFrom <= initialTo ? initialTo : initialFrom;
  const from =
    rawFrom < format(subDays(parseISO(to), 365), "yyyy-MM-dd")
      ? format(subDays(parseISO(to), 365), "yyyy-MM-dd")
      : rawFrom;
  const supabase = await createClient();
  const uid = ctx.user.id;
  const [sessions, meals, measurements, targets, profile, journal, water, yearSessions] =
    await Promise.all([
      supabase
        .from("workout_sessions")
        .select("*")
        .eq("user_id", uid)
        .gte("started_at", `${from}T00:00:00`)
        .lte("started_at", `${to}T23:59:59`)
        .is("archived_at", null)
        .order("started_at"),
      supabase
        .from("meal_entries")
        .select("*")
        .eq("user_id", uid)
        .gte("entry_date", from)
        .lte("entry_date", to)
        .is("archived_at", null)
        .order("entry_date"),
      supabase
        .from("measurements")
        .select("*")
        .eq("user_id", uid)
        .gte("measured_at", from)
        .lte("measured_at", to)
        .order("measured_at"),
      supabase
        .from("nutrition_targets")
        .select("*")
        .eq("user_id", uid)
        .lte("effective_from", to)
        .order("effective_from")
        .order("created_at"),
      supabase
        .from("profiles")
        .select("full_name,goal,weight_kg,height_cm,birth_date")
        .eq("user_id", uid)
        .maybeSingle(),
      supabase
        .from("daily_journal")
        .select("entry_date,sleep_hours,mood,energy")
        .eq("user_id", uid)
        .gte("entry_date", from)
        .lte("entry_date", to),
      supabase
        .from("water_entries")
        .select("entry_date,amount_ml")
        .eq("user_id", uid)
        .gte("entry_date", from)
        .lte("entry_date", to),
      supabase
        .from("workout_sessions")
        .select("started_at,finished_at,total_volume")
        .eq("user_id", uid)
        .gte("started_at", `${to.slice(0, 4)}-01-01T00:00:00`)
        .lte("started_at", `${to.slice(0, 4)}-12-31T23:59:59`)
        .is("archived_at", null),
    ]);
  checkQueries(sessions, meals, measurements, targets, profile, journal, water, yearSessions);
  return {
    context: ctx,
    sessions: rows(sessions.data),
    meals: rows(meals.data),
    measurements: rows(measurements.data),
    targets: rows(targets.data),
    profile: profile.data,
    journal: rows(journal.data),
    water: rows(water.data),
    yearSessions: rows(yearSessions.data),
    from,
    to,
  };
}
export async function getAccountData() {
  "use cache: private";
  cacheLife({ stale: 300 });
  const ctx = await requireReadyContext();
  if (ctx.status !== "ready" || !ctx.user)
    return {
      context: ctx,
      targets: [],
      settings: null,
      subscriptions: [],
      events: [],
    };
  const supabase = await createClient();
  const uid = ctx.user.id;
  const [targets, settings, subscriptions, events] = await Promise.all([
    supabase
      .from("nutrition_targets")
      .select("*")
      .eq("user_id", uid)
      .order("effective_from", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("notification_settings")
      .select("*")
      .eq("user_id", uid)
      .maybeSingle(),
    supabase
      .from("push_subscriptions")
      .select("id,device_label,last_seen_at,created_at")
      .eq("user_id", uid)
      .order("last_seen_at", { ascending: false }),
    supabase
      .from("notification_events")
      .select("*")
      .eq("user_id", uid)
      .order("created_at", { ascending: false })
      .limit(30),
  ]);
  checkQueries(targets, settings, subscriptions, events);
  return {
    context: ctx,
    targets: rows(targets.data),
    settings: settings.data,
    subscriptions: rows(subscriptions.data),
    events: rows(events.data),
  };
}
