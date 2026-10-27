import { differenceInYears, parseISO } from "date-fns";

export type ProfileForNutrition = {
  sex: "female" | "male" | "intersex" | "prefer_not_to_say";
  birth_date?: string | null;
  height_cm: number;
  weight_kg: number;
  activity_level: "sedentary" | "light" | "moderate" | "active" | "very_active";
  goal: "cut" | "maintain" | "bulk";
};

export function calculatedTargets(profile: ProfileForNutrition) {
  const age = profile.birth_date
    ? Math.max(15, differenceInYears(new Date(), parseISO(profile.birth_date)))
    : 30;
  const bmr =
    10 * profile.weight_kg +
    6.25 * profile.height_cm -
    5 * age +
    (profile.sex === "male" ? 5 : profile.sex === "female" ? -161 : -78);
  const activity = {
    sedentary: 1.2,
    light: 1.375,
    moderate: 1.55,
    active: 1.725,
    very_active: 1.9,
  }[profile.activity_level];
  const adjustment = profile.goal === "cut" ? -400 : profile.goal === "bulk" ? 250 : 0;
  const kcal = Math.max(
    500,
    Math.round((bmr * activity + adjustment) / 50) * 50,
  );
  const protein = Math.round(profile.weight_kg * 1.8);
  const fat = Math.round(profile.weight_kg * 0.8);
  const carbs = Math.max(0, Math.round((kcal - protein * 4 - fat * 9) / 4));
  return {
    kcal,
    protein_g: protein,
    fat_g: fat,
    carbs_g: carbs,
    calculation: {
      formula: "Mifflin–St Jeor BMR × activity factor, adjusted by goal",
      bmr: Math.round(bmr),
      activity_factor: activity,
      goal_adjustment: adjustment,
      protein_g_per_kg: 1.8,
      fat_g_per_kg: 0.8,
    },
  };
}
