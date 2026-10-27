"use client";

import { useState } from "react";
import { addStarterPlan, createMeal } from "@/app/actions";

const ideas = [
  ["Overnight oats", "Oats, milk or yogurt, berries"], ["Greek yogurt bowl", "Greek yogurt, fruit, nuts"],
  ["Eggs on toast", "Eggs, wholegrain toast, tomatoes"], ["Breakfast burrito", "Tortilla, eggs, beans, vegetables"],
  ["Cottage cheese bowl", "Cottage cheese, apple, cinnamon"], ["Peanut butter banana toast", "Wholegrain toast, peanut butter, banana"],
  ["Chicken wrap", "Chicken, tortilla, lettuce, yogurt sauce"], ["Chicken rice bowl", "Chicken, rice, vegetables"],
  ["Tuna pasta salad", "Tuna, pasta, cucumber, tomatoes"], ["Chickpea salad", "Chickpeas, cucumber, tomato, olive oil"],
  ["Tofu noodle bowl", "Tofu, noodles, vegetables, soy sauce"], ["Turkey sandwich", "Turkey, wholegrain bread, salad"],
  ["Lentil soup", "Lentils, carrots, onions, tomatoes"], ["Salmon and potatoes", "Salmon, potatoes, green vegetables"],
  ["Chicken stir fry", "Chicken, mixed vegetables, rice"], ["Bean chilli", "Beans, tomatoes, peppers, rice"],
  ["Beef pasta", "Lean beef, pasta, tomato sauce"], ["Vegetable omelette", "Eggs, peppers, mushrooms, cheese"],
  ["Tofu curry", "Tofu, vegetables, curry sauce, rice"], ["Baked potato with cottage cheese", "Potato, cottage cheese, herbs"],
  ["Hummus and vegetables", "Hummus, carrots, cucumber"], ["Fruit and nuts", "Seasonal fruit, mixed nuts"],
  ["Yogurt and berries", "Plain yogurt, berries"], ["Cheese and crackers", "Cheese, wholegrain crackers"],
];

type Props = { onToast: (message: string) => void };

export function StarterPlan({ onToast }: Props) {
  const [busy, setBusy] = useState(false);
  return <section className="card starter-card"><div><div className="eyebrow">A SIMPLE PLACE TO START</div><h3>Full body · 3 days per week</h3><p>Three editable sessions for Monday, Wednesday and Friday. Includes squats, presses, rows and core work.</p><small>Choose weights and adjust movements to your experience. Activating the plan is a separate step.</small></div><button className="button button-primary" disabled={busy} onClick={async () => { setBusy(true); try { await addStarterPlan(); onToast("Starter plan added. Choose Set active when you are ready."); } catch (error) { onToast(error instanceof Error ? error.message : "Could not add the plan."); } finally { setBusy(false); } }}>{busy ? "Adding…" : "Add starter plan"}</button></section>;
}

export function MealIdeas({ date, onToast }: Props & { date: string }) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [planned, setPlanned] = useState(true);
  return <section className="card meal-ideas"><div className="card-heading"><div><div className="eyebrow">MEAL IDEAS</div><h3>Find something to eat</h3><p className="muted-copy">Choose an idea and enter the values for your own ingredients and portion.</p></div></div><label className="field-label">Search ideas<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Try chicken, oats or tofu" /></label><div className="meal-ideas-grid">{ideas.map(([name, ingredients], index) => ({ name, ingredients, index })).filter((idea) => `${idea.name} ${idea.ingredients}`.toLowerCase().includes(search.toLowerCase())).map((idea) => <button type="button" className={`meal-idea ${selected === idea.index ? "selected" : ""}`} key={idea.name} onClick={() => setSelected(idea.index)}><b>{idea.name}</b><small>{idea.ingredients}</small></button>)}</div>{selected !== null && <form className="entry-form idea-entry" onSubmit={async (event) => { event.preventDefault(); const form = new FormData(event.currentTarget); setBusy(true); try { await createMeal({ entry_date: date, meal_slot: String(form.get("slot")), name: ideas[selected][0], amount_grams: Number(form.get("grams")) || null, kcal: Number(form.get("kcal")), protein_g: Number(form.get("protein")), carbs_g: Number(form.get("carbs")), fat_g: Number(form.get("fat")), is_planned: planned, review_status: "approved" }); setSelected(null); onToast(planned ? "Meal added to your plan." : "Meal added to your diary."); } catch (error) { onToast(error instanceof Error ? error.message : "Could not add meal."); } finally { setBusy(false); } }}><h3>{ideas[selected][0]}</h3><p>Ingredients: {ideas[selected][1]}. Values depend on the amounts and products you use.</p><div className="form-grid"><label className="field-label">Meal<select name="slot"><option value="breakfast">Breakfast</option><option value="lunch">Lunch</option><option value="dinner">Dinner</option><option value="snack">Snack</option></select></label><label className="field-label">Portion (g), optional<input name="grams" type="number" min="1" max="5000" /></label></div><div className="entry-calorie-controls">{[["kcal", "Calories"], ["protein", "Protein g"], ["carbs", "Carbs g"], ["fat", "Fat g"]].map(([key, label]) => <label key={key}>{label}<input name={key} type="number" min="0" step="0.1" required /></label>)}</div><label><input type="checkbox" checked={planned} onChange={(event) => setPlanned(event.target.checked)} /> Plan for this day</label><div><button className="button button-primary" disabled={busy}>{busy ? "Saving…" : planned ? "Add to plan" : "Log meal"}</button> <button type="button" className="button button-secondary" onClick={() => setSelected(null)}>Cancel</button></div></form>}</section>;
}

export function AiAssistant({ topic }: { topic: "training" | "nutrition" }) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [busy, setBusy] = useState(false);
  return <details className="card assistant-card"><summary><div><div className="eyebrow">OPTIONAL AI ASSISTANT</div><h3>Ask about {topic}</h3><small>Get ideas or explanations without changing your records.</small></div><span>Open +</span></summary><form className="entry-form" onSubmit={async (event) => { event.preventDefault(); setBusy(true); setAnswer(""); try { const response = await fetch("/api/assistant", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question, topic }) }); const data = await response.json(); setAnswer(response.ok ? data.answer : data.error || "Could not get an answer."); } catch { setAnswer("Could not reach the assistant. Please try again."); } finally { setBusy(false); } }}><p className="muted-copy">Your question is sent to OpenAI. Your account and tracker data are not sent automatically.</p><label className="field-label">Your question<textarea value={question} onChange={(event) => setQuestion(event.target.value)} maxLength={1500} required placeholder={topic === "training" ? "How can I adapt a workout to the equipment I have?" : "What could I make with chickpeas and rice?"} /></label><button className="button button-primary" disabled={busy}>{busy ? "Thinking…" : "Ask assistant"}</button>{answer && <div className="assistant-answer" role="status">{answer}</div>}</form></details>;
}
