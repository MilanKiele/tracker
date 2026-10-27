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
]);
export type PlanDraft = z.infer<typeof planDraft>;
export type FoodDraft = z.infer<typeof foodDraft>;
export type AiResult = z.infer<typeof aiResult>;
export const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (date) =>
      !Number.isNaN(Date.parse(date)) &&
      new Date(date).toISOString().slice(0, 10) === date,
    "Ungültiges Datum",
  );

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
