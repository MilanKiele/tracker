import { z } from "zod";

export const exerciseDraft = z.object({
  name: z.string().trim().min(1).max(100),
  muscle: z.string().trim().min(1).max(60),
  equipment: z.string().trim().min(1).max(60),
  movement_type: z
    .enum(["machine", "cable", "free_weight", "bodyweight"])
    .default("free_weight"),
  sets: z.number().int().min(1).max(10),
  reps: z.number().int().min(1).max(100),
  rest_seconds: z.number().int().min(0).max(600),
  duration_seconds: z.number().int().min(5).max(3600).nullable().default(null),
  notes: z.string().max(600).default(""),
});
export const planDraft = z
  .object({
    name: z.string().trim().min(1).max(100),
    description: z.string().max(800),
    days: z
      .array(
        z.object({
          name: z.string().trim().min(1).max(80),
          weekday: z.number().int().min(0).max(6),
          exercises: z.array(exerciseDraft).min(1).max(12),
        }),
      )
      .min(1)
      .max(7),
  })
  .refine(
    (plan) =>
      new Set(plan.days.map((day) => day.weekday)).size === plan.days.length,
    "Jeder Wochentag darf nur einmal vorkommen.",
  );
export const foodDraft = z.object({
  name: z.string().trim().min(1).max(140),
  grams: z.number().min(1).max(5000),
  kcal: z.number().min(0).max(10000),
  protein_g: z.number().min(0).max(1000),
  carbs_g: z.number().min(0).max(1000),
  fat_g: z.number().min(0).max(1000),
  fiber_g: z.number().min(0).max(1000).nullable().default(null),
  sugar_g: z.number().min(0).max(1000).nullable().default(null),
  salt_g: z.number().min(0).max(1000).nullable().default(null),
  confidence: z.enum(["low", "medium", "high"]).default("medium"),
  notes: z.string().max(600).default(""),
});

export const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (date) =>
      !Number.isNaN(Date.parse(date)) &&
      new Date(date).toISOString().slice(0, 10) === date,
    "Ungültiges Datum",
  );

const measurementValues = z.object({
  weight_kg: z.number().min(25).max(400).nullable().optional(),
  body_fat_pct: z.number().min(1).max(70).nullable().optional(),
  neck_cm: z.number().min(10).max(100).nullable().optional(),
  shoulders_cm: z.number().min(20).max(250).nullable().optional(),
  chest_cm: z.number().min(20).max(250).nullable().optional(),
  upper_arm_left_cm: z.number().min(10).max(100).nullable().optional(),
  upper_arm_right_cm: z.number().min(10).max(100).nullable().optional(),
  forearm_left_cm: z.number().min(10).max(100).nullable().optional(),
  forearm_right_cm: z.number().min(10).max(100).nullable().optional(),
  waist_cm: z.number().min(20).max(250).nullable().optional(),
  hips_cm: z.number().min(20).max(250).nullable().optional(),
  thigh_left_cm: z.number().min(20).max(150).nullable().optional(),
  thigh_right_cm: z.number().min(20).max(150).nullable().optional(),
  calf_left_cm: z.number().min(10).max(100).nullable().optional(),
  calf_right_cm: z.number().min(10).max(100).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
});
const targetMetric = z.enum([
  "weight_kg", "body_fat_pct", "waist_cm", "neck_cm", "shoulders_cm",
  "chest_cm", "upper_arm_left_cm", "upper_arm_right_cm", "forearm_left_cm",
  "forearm_right_cm", "hips_cm", "thigh_left_cm", "thigh_right_cm",
  "calf_left_cm", "calf_right_cm",
]);

export const aiAction = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("measurement"),
    measurement_id: z.string().uuid().optional(),
    measured_at: dateSchema,
    values: measurementValues.refine(
      (values) => Object.values(values).some((value) => value != null),
      "Mindestens einen Messwert angeben.",
    ),
  }),
  z.object({
    type: z.literal("goal"),
    goal_id: z.string().uuid().optional(),
    metric: targetMetric,
    start_value: z.number().nullable().optional(),
    target_value: z.number().min(0).max(10000),
    starts_on: dateSchema,
    target_date: dateSchema.nullable().optional(),
  }),
  z.object({
    type: z.literal("journal"),
    entry_date: dateSchema,
    sleep_hours: z.number().min(0).max(24).nullable().optional(),
    mood: z.number().int().min(1).max(5).nullable().optional(),
    energy: z.number().int().min(1).max(5).nullable().optional(),
    notes: z.string().max(4000).nullable().optional(),
  }).refine((entry) => [entry.sleep_hours, entry.mood, entry.energy, entry.notes].some((v) => v != null)),
  z.object({
    type: z.literal("water"),
    entry_date: dateSchema,
    amount_ml: z.number().int().min(1).max(5000),
  }),
  z.object({
    type: z.literal("nutrition_target"),
    effective_from: dateSchema,
    kcal: z.number().int().min(500).max(10000).optional(),
    protein_g: z.number().min(0).max(1000).optional(),
    carbs_g: z.number().min(0).max(1000).optional(),
    fat_g: z.number().min(0).max(1000).optional(),
  }).refine((action) => Object.keys(action).some((key) => key !== "type" && key !== "effective_from")),
  z.object({
    type: z.literal("meal_update"),
    meal_id: z.string().uuid(),
    name: z.string().trim().min(1).max(140).optional(),
    entry_date: dateSchema.optional(),
    meal_slot: z.enum(["breakfast", "lunch", "dinner", "snack"]).optional(),
    amount_grams: z.number().min(0).max(5000).nullable().optional(),
    kcal: z.number().min(0).max(10000).optional(),
    protein_g: z.number().min(0).max(1000).optional(),
    carbs_g: z.number().min(0).max(1000).optional(),
    fat_g: z.number().min(0).max(1000).optional(),
  }).refine((action) => Object.keys(action).some((key) => key !== "type" && key !== "meal_id")),
  z.object({
    type: z.literal("profile"),
    full_name: z.string().trim().min(2).max(80).optional(),
    sex: z.enum(["female", "male", "intersex", "prefer_not_to_say"]).optional(),
    birth_date: dateSchema.nullable().optional(),
    height_cm: z.number().min(80).max(250).optional(),
    weight_kg: z.number().min(25).max(400).optional(),
    activity_level: z.enum(["sedentary", "light", "moderate", "active", "very_active"]).optional(),
    goal: z.enum(["cut", "maintain", "bulk"]).optional(),
    unit_system: z.enum(["metric", "imperial"]).optional(),
  }).refine((action) => Object.keys(action).some((key) => key !== "type")),
  z.object({
    type: z.literal("notification_settings"),
    missed_workout_enabled: z.boolean().optional(),
    reminder_enabled: z.boolean().optional(),
    reminder_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
    timezone: z.string().min(1).max(80).optional(),
    quiet_hours_start: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable().optional(),
    quiet_hours_end: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable().optional(),
  }).refine((action) => Object.keys(action).some((key) => key !== "type")),
  z.object({ type: z.literal("mark_notification_read"), notification_id: z.string().uuid() }),
]);
export const aiResult = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("plan"),
    message: z.string().max(2000),
    plan: planDraft,
  }),
  z.object({
    kind: z.literal("food"),
    message: z.string().max(2000),
    foods: z.array(foodDraft).min(1).max(12),
  }),
  z.object({
    kind: z.literal("message"),
    message: z.string().min(1).max(3000),
  }),
  z.object({
    kind: z.literal("action"),
    message: z.string().max(2000),
    action: aiAction,
  }),
]);
export type PlanDraft = z.infer<typeof planDraft>;
export type FoodDraft = z.infer<typeof foodDraft>;
export type AiResult = z.infer<typeof aiResult>;
export type AiAction = z.infer<typeof aiAction>;

/** Scale total values, never per-100g values. Unknown nutrients stay unknown. */
export function scaleFood(food: FoodDraft, factor: number): FoodDraft {
  z.number().min(0.05).max(10).parse(factor);
  const scaled = { ...foodDraft.parse(food) };
  for (const key of [
    "grams",
    "kcal",
    "protein_g",
    "carbs_g",
    "fat_g",
    "fiber_g",
    "sugar_g",
    "salt_g",
  ] as const) {
    const value = scaled[key];
    if (value !== null) scaled[key] = Math.round(value * factor * 100) / 100;
  }
  return foodDraft.parse(scaled);
}
