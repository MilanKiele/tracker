"use server";
import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const credentials = z.object({ email: z.string().trim().email().max(254), password: z.string().min(8).max(128) });
function value(form: FormData, key: string) { return String(form.get(key) ?? ""); }
export async function login(form: FormData) {
  const parsed = credentials.safeParse({ email: value(form,"email"), password: value(form,"password") });
  if (!parsed.success) redirect("/login?error=Enter%20a%20valid%20email%20and%20password%20(8%2B%20characters)");
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) redirect(`/login?error=${encodeURIComponent(error.message)}`);
  const { data: profile } = await supabase.from("profiles").select("onboarding_complete").eq("user_id", (await supabase.auth.getUser()).data.user?.id ?? "").maybeSingle();
  redirect(profile?.onboarding_complete ? "/" : "/onboarding");
}
export async function register(form: FormData) {
  const parsed = credentials.extend({ name: z.string().trim().min(2).max(80) }).safeParse({email:value(form,"email"),password:value(form,"password"),name:value(form,"name")});
  if (!parsed.success) redirect("/register?error=Please%20check%20your%20name%2C%20email%20and%20password%20(minimum%208%20characters)");
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({ email: parsed.data.email, password: parsed.data.password, options: { data: { full_name: parsed.data.name } } });
  if (error) redirect(`/register?error=${encodeURIComponent(error.message)}`);
  if (data.session) redirect("/onboarding");
  redirect("/login?message=Check%20your%20email%20to%20confirm%20your%20account%2C%20then%20sign%20in.");
}
export async function logout() {
  const supabase = await createClient(); await supabase.auth.signOut(); redirect("/login");
}
export async function requestPasswordReset(form: FormData) {
  const parsed = z.string().trim().email().safeParse(value(form,"email"));
  if (!parsed.success) redirect("/forgot-password?error=Enter%20a%20valid%20email%20address");
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data, { redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/reset-password` });
  if (error) redirect(`/forgot-password?error=${encodeURIComponent(error.message)}`);
  redirect("/forgot-password?message=If%20an%20account%20exists%2C%20we%20sent%20a%20password%20reset%20link.");
}
export async function saveProfile(form: FormData) {
  const input = z.object({ full_name:z.string().trim().min(2).max(80), sex:z.enum(["female","male","intersex","prefer_not_to_say"]), birth_date:z.string().date().optional().or(z.literal("")), height_cm:z.coerce.number().min(80).max(250), weight_kg:z.coerce.number().min(25).max(400), activity_level:z.enum(["sedentary","light","moderate","active","very_active"]), goal:z.enum(["cut","maintain","bulk"]), unit_system:z.enum(["metric","imperial"]) }).safeParse({full_name:value(form,"full_name"),sex:value(form,"sex"),birth_date:value(form,"birth_date"),height_cm:value(form,"height_cm"),weight_kg:value(form,"weight_kg"),activity_level:value(form,"activity_level"),goal:value(form,"goal"),unit_system:value(form,"unit_system")});
  if(!input.success) throw new Error("Please check the profile fields and try again.");
  const supabase=await createClient(); const {data:{user}}=await supabase.auth.getUser(); if(!user) throw new Error("Sign in to update your profile.");
  const profile = {...input.data, birth_date: input.data.birth_date || null};
  const {error}=await supabase.from("profiles").upsert({user_id:user.id,id:user.id,...profile,onboarding_complete:true,updated_at:new Date().toISOString()}); if(error)throw new Error(error.message);
  const age = profile.birth_date ? Math.max(18,new Date().getFullYear()-new Date(profile.birth_date).getFullYear()) : 30;
  const base = 10*profile.weight_kg + 6.25*profile.height_cm - 5*age + (profile.sex === "male" ? 5 : profile.sex === "female" ? -161 : -78);
  const activity = {sedentary:1.2,light:1.375,moderate:1.55,active:1.725,very_active:1.9}[profile.activity_level];
  const kcal = Math.max(500,Math.round((base*activity + (profile.goal === "cut" ? -400 : profile.goal === "bulk" ? 250 : 0))/50)*50);
  const protein = Math.round(profile.weight_kg*1.8); const fat = Math.round(profile.weight_kg*0.8); const carbs = Math.max(0,Math.round((kcal-protein*4-fat*9)/4));
  await supabase.from("nutrition_targets").insert({user_id:user.id,kcal,protein_g:protein,fat_g:fat,carbs_g:carbs,effective_from:new Date().toISOString().slice(0,10),calculation:{formula:"Mifflin-St Jeor BMR × activity factor, adjusted by goal",bmr:Math.round(base),activity_factor:activity,goal_adjustment:profile.goal === "cut" ? -400 : profile.goal === "bulk" ? 250 : 0,protein_g_per_kg:1.8,fat_g_per_kg:0.8},is_manual:false});
  await supabase.from("measurements").insert({user_id:user.id,measured_at:new Date().toISOString().slice(0,10),weight_kg:profile.weight_kg});
  revalidatePath("/"); redirect("/");
}
export async function logMeal(form: FormData) {
  const schema=z.object({entry_date:z.string().date(),meal_slot:z.enum(["breakfast","lunch","dinner","snack"]),name:z.string().trim().min(1).max(140),amount_grams:z.coerce.number().positive().max(5000).optional(),kcal:z.coerce.number().min(0).max(10000),protein_g:z.coerce.number().min(0).max(1000),carbs_g:z.coerce.number().min(0).max(1000),fat_g:z.coerce.number().min(0).max(1000),is_planned:z.enum(["true","false"]).default("false")});
  const parsed=schema.safeParse(Object.fromEntries(form.entries())); if(!parsed.success)throw new Error("Please check the meal details.");
  const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();if(!user)throw new Error("Sign in to log food.");
  const {error}=await supabase.from("meal_entries").insert({...parsed.data,user_id:user.id,is_planned:parsed.data.is_planned==="true"});if(error)throw new Error(error.message);revalidatePath("/nutrition");revalidatePath("/");
}
export async function logMeasurement(form: FormData) {
  const schema=z.object({measured_at:z.string().date(),weight_kg:z.coerce.number().min(25).max(400).optional(),body_fat_pct:z.coerce.number().min(1).max(70).optional(),waist_cm:z.coerce.number().positive().max(300).optional(),chest_cm:z.coerce.number().positive().max(300).optional(),hips_cm:z.coerce.number().positive().max(300).optional(),notes:z.string().max(2000).optional()});
  const parsed=schema.safeParse(Object.fromEntries(form.entries()));if(!parsed.success)throw new Error("Please check the measurement values.");const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();if(!user)throw new Error("Sign in to save measurements.");const {error}=await supabase.from("measurements").insert({...parsed.data,user_id:user.id});if(error)throw new Error(error.message);revalidatePath("/body");
}
export async function exportMyData() {
  const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();if(!user)throw new Error("Sign in to export data.");
  const tables=["profiles","exercises","training_plans","plan_days","plan_exercises","workout_sessions","workout_exercises","workout_sets","personal_records","foods","recipes","recipe_ingredients","meal_entries","nutrition_targets","measurements","measurement_goals","goal_milestones","daily_journal","progress_photos","water_entries"] as const;
  const results=await Promise.all(tables.map(async(table)=>({table,data:await supabase.from(table).select("*")})));
  const escape=(cell:string)=>`"${cell.replaceAll('"','""')}"`;
  return ["table,record_json",...results.flatMap(({table,data})=>(data.data??[]).map((row)=>`${escape(table)},${escape(JSON.stringify(row))}`))].join("\r\n");
}
