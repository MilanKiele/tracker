import assert from "node:assert/strict";
import {
  aiResult,
  dateSchema,
  foodDraft,
  planDraft,
  scaleFood,
} from "../src/lib/ai/schema.ts";
const food = foodDraft.parse({
  name: "Wrap",
  grams: 400,
  kcal: 600,
  protein_g: 40,
  carbs_g: 60,
  fat_g: 20,
});
assert.equal(scaleFood(food, 1).kcal, 600);
assert.equal(scaleFood(food, 0.5).grams, 200);
assert.equal(scaleFood(food, 0.5).kcal, 300);
assert.equal(scaleFood(food, 2).protein_g, 80);
assert.equal(scaleFood(food, 0.5).fiber_g, null);
assert.throws(() => scaleFood(food, 0));
assert.throws(() => scaleFood(food, -1));
assert.throws(() => scaleFood(food, Infinity));
assert.equal(foodDraft.safeParse({ ...food, kcal: -20 }).success, false);
assert.equal(dateSchema.safeParse("2026-02-30").success, false);
assert.equal(dateSchema.safeParse("2026-10-27").success, true);
const exercise = {
  name: "Squat",
  muscle: "Legs",
  equipment: "Bodyweight",
  sets: 3,
  reps: 10,
  rest_seconds: 90,
};
const day = { name: "A", weekday: 0, exercises: [exercise] };
assert.equal(
  planDraft.safeParse({
    name: "Plan",
    description: "",
    days: [day, { ...day, name: "B" }],
  }).success,
  false,
);
assert.equal(
  aiResult.safeParse({ kind: "food", message: "", foods: [] }).success,
  false,
);
assert.equal(
  aiResult.safeParse({ kind: "message", message: "Bitte ein klareres Foto." })
    .success,
  true,
);
console.log(
  "✓ Whole/half/double portions, unknown nutrients and invalid amounts",
);
console.log(
  "✓ Invalid dates, duplicate weekdays, empty foods and clarification results",
);
