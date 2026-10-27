"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import Link from "next/link";
import { useState } from "react";
import { addDays, format, parseISO } from "date-fns";
import {
  Apple,
  Camera,
  Check,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  Plus,
  Search,
  Sparkles,
  Trash2,
} from "lucide-react";
import {
  archiveFood,
  archiveMeal,
  createFood,
  createMeal,
  reviewMeal,
  updateFood,
  updateMeal,
} from "@/app/actions";
import { eatPlannedMeal } from "@/app/ai-actions";
import { PageHeading } from "@/components/app-shell";
import { useAi } from "./ai-flow";
import {
  ActionButton,
  Empty,
  fmt,
  Modal,
  num,
  NumberField,
  Progress,
  SectionTitle,
  slots,
  today,
  useFeedback,
} from "./ui";

export function sumMeals(entries: any[]) {
  return entries.reduce(
    (sum, entry) => ({
      kcal: sum.kcal + num(entry.kcal),
      protein_g: sum.protein_g + num(entry.protein_g),
      carbs_g: sum.carbs_g + num(entry.carbs_g),
      fat_g: sum.fat_g + num(entry.fat_g),
    }),
    { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 },
  );
}
export function NutritionSummary({
  totals,
  target,
  compact = false,
}: {
  totals: any;
  target?: any;
  compact?: boolean;
}) {
  const percentage = target?.kcal
    ? Math.min(100, (totals.kcal / target.kcal) * 100)
    : 0;
  return (
    <div className={`nutrition-summary ${compact ? "compact" : ""}`}>
      <div className="calorie-ring">
        <svg viewBox="0 0 120 120" aria-hidden="true">
          <circle cx="60" cy="60" r="51" />
          <circle
            className="ring-fill"
            cx="60"
            cy="60"
            r="51"
            strokeDasharray={`${percentage * 3.204} 320.4`}
          />
        </svg>
        <div>
          <strong>{fmt(totals.kcal)}</strong>
          <small>kcal gegessen</small>
        </div>
      </div>
      <div className="macro-summary">
        <div className="calorie-target">
          <span>
            {target
              ? `${fmt(Math.max(0, target.kcal - totals.kcal))} kcal übrig`
              : "Noch kein Tagesziel"}
          </span>
          <small>
            {target
              ? `von ${fmt(target.kcal)} kcal`
              : "Ziel in Nutrition festlegen"}
          </small>
        </div>
        {(
          [
            ["protein_g", "Protein"],
            ["carbs_g", "Kohlenhydrate"],
            ["fat_g", "Fett"],
          ] as const
        ).map(([key, label]) => (
          <div className={`macro-line ${key}`} key={key}>
            <div>
              <span>{label}</span>
              <b>
                {fmt(totals[key])}{" "}
                <small>/ {target ? fmt(target[key]) : "—"} g</small>
              </b>
            </div>
            <Progress
              value={num(totals[key])}
              max={num(target?.[key]) || 100}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
export function DateNavigation({
  date,
  base = "/nutrition",
}: {
  date: string;
  base?: string;
}) {
  return (
    <div className="date-navigation">
      <Link
        className="icon-btn"
        aria-label="Vorheriger Tag"
        href={`${base}?date=${format(addDays(parseISO(date), -1), "yyyy-MM-dd")}`}
      >
        <ChevronLeft size={18} />
      </Link>
      <span>
        {parseISO(date).toLocaleDateString("de-DE", {
          weekday: "long",
          day: "numeric",
          month: "short",
        })}
      </span>
      <Link
        className="icon-btn"
        aria-label="Nächster Tag"
        href={`${base}?date=${format(addDays(parseISO(date), 1), "yyyy-MM-dd")}`}
      >
        <ChevronRight size={18} />
      </Link>
      {date !== today() && (
        <Link href={base} className="text-btn">
          Heute
        </Link>
      )}
    </div>
  );
}
export function NutritionPage({ data }: { data: any }) {
  const { entries, foods, date, targets } = data;
  const target = targets[0];
  const actual = entries.filter(
    (e: any) => !e.is_planned && e.review_status === "approved",
  );
  const { openAi } = useAi();
  const [entry, setEntry] = useState<any>(null);
  const [food, setFood] = useState<any>(null);
  const [search, setSearch] = useState("");
  return (
    <>
      <PageHeading
        eyebrow="ESSEN. ERFASSEN. WEITERMACHEN."
        title="Deine Ernährung."
        action={
          <button
            className="btn btn-primary"
            onClick={() => openAi("food", date)}
          >
            <Camera size={18} /> Essen scannen
          </button>
        }
      />
      <DateNavigation date={date} />
      <div className="nutrition-layout">
        <section>
          <div className="card">
            <SectionTitle
              title="Dein Tagesbedarf"
              action={
                <button
                  className="icon-btn"
                  aria-label="Tagesziel im Chat ändern"
                  title="Tagesziel im Chat ändern"
                  onClick={() => openAi("food", date, `Ich möchte mein Tagesziel ändern. Aktuell: ${target?.kcal ?? "unbekannt"} kcal, ${target?.protein_g ?? "unbekannt"} g Protein, ${target?.carbs_g ?? "unbekannt"} g Kohlenhydrate und ${target?.fat_g ?? "unbekannt"} g Fett. Frag mich nach den gewünschten Änderungen und übernimm sie nach meiner Bestätigung.`)}
                >
                  <MoreHorizontal size={20} />
                </button>
              }
            />
            <NutritionSummary totals={sumMeals(actual)} target={target} />
          </div>
          <section className="card">
            <SectionTitle
              title="Deine Mahlzeiten"
              action={
                <button
                  className="btn btn-secondary btn-small"
                  onClick={() => setEntry({})}
                >
                  <Plus size={15} /> Manuell
                </button>
              }
            />
            {Object.entries(slots).map(([key, label]) => {
              const meals = entries.filter(
                (e: any) => e.meal_slot === key && e.review_status !== "denied",
              );
              return (
                <div className="meal-group" key={key}>
                  <div className="meal-group-label">
                    <b>{label}</b>
                    <small>
                      {fmt(
                        sumMeals(
                          meals.filter(
                            (e: any) =>
                              !e.is_planned && e.review_status === "approved",
                          ),
                        ).kcal,
                      )}{" "}
                      kcal
                    </small>
                  </div>
                  {meals.length ? (
                    meals.map((meal: any) => (
                      <MealRow
                        key={meal.id}
                        meal={meal}
                        onEdit={() => setEntry(meal)}
                      />
                    ))
                  ) : (
                    <button
                      className="empty-meal"
                      onClick={() => openAi("food", date)}
                    >
                      <Plus size={14} /> {label} hinzufügen
                    </button>
                  )}
                </div>
              );
            })}
          </section>
        </section>
        <aside>
          <div className="dark-card scan-promo">
            <span className="scan-icon">
              <Camera size={31} />
            </span>
            <span className="eyebrow">FOTO REICHT</span>
            <h2>
              Dein Essen.
              <br />
              Einfach erfasst.
            </h2>
            <p>Ganze Portion erkennen und hinzufügen.</p>
            <button
              className="btn btn-lime full"
              onClick={() => openAi("food", date)}
            >
              <Sparkles size={16} /> Foto oder Text
            </button>
          </div>
          <section className="card">
            <SectionTitle
              title="Speiseauswahl"
              action={
                <button
                  className="icon-btn"
                  aria-label="Lebensmittel anlegen"
                  onClick={() => setFood({})}
                >
                  <Plus size={18} />
                </button>
              }
            />
            <label className="search-field">
              <Search size={16} />
              <input
                aria-label="Speisen suchen"
                placeholder="Speise suchen …"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>
            <div className="food-library">
              {foods
                .filter((f: any) =>
                  f.name.toLowerCase().includes(search.toLowerCase()),
                )
                .map((f: any) => (
                  <div className="food-library-item" key={f.id}>
                    <div>
                      <b>{f.name}</b>
                      <small>
                        {fmt((f.kcal * num(f.serving_grams || 100)) / 100)} kcal
                        · {fmt(f.serving_grams || 100)} g
                      </small>
                      {f.source?.includes("KI") && (
                        <span className="estimate-label">KI-Schätzung</span>
                      )}
                    </div>
                    <ActionButton
                      className="icon-btn add-food"
                      action={() =>
                        createMeal({
                          entry_date: date,
                          meal_slot: "lunch",
                          food_id: f.id,
                          name: f.name,
                          amount_grams: num(f.serving_grams || 100),
                          kcal:
                            (num(f.kcal) * num(f.serving_grams || 100)) / 100,
                          protein_g:
                            (num(f.protein_g) * num(f.serving_grams || 100)) /
                            100,
                          carbs_g:
                            (num(f.carbs_g) * num(f.serving_grams || 100)) /
                            100,
                          fat_g:
                            (num(f.fat_g) * num(f.serving_grams || 100)) / 100,
                          fiber_g:
                            f.fiber_g == null
                              ? null
                              : (num(f.fiber_g) * num(f.serving_grams || 100)) /
                                100,
                          sugar_g:
                            f.sugar_g == null
                              ? null
                              : (num(f.sugar_g) * num(f.serving_grams || 100)) /
                                100,
                          salt_g:
                            f.salt_g == null
                              ? null
                              : (num(f.salt_g) * num(f.serving_grams || 100)) /
                                100,
                          is_planned: false,
                          review_status: "approved",
                        })
                      }
                      message="Ganze Portion hinzugefügt."
                    >
                      <Plus size={17} />
                      <span className="sr-only">
                        {f.name} als ganze Portion hinzufügen
                      </span>
                    </ActionButton>
                    <button
                      className="icon-btn"
                      aria-label={`${f.name} bearbeiten`}
                      onClick={() => setFood(f)}
                    >
                      <MoreHorizontal size={17} />
                    </button>
                  </div>
                ))}
            </div>
            {!foods.length && (
              <Empty
                action={
                  <button
                    className="text-btn"
                    onClick={() => openAi("food", date)}
                  >
                    Erste Speise scannen <ChevronRight size={14} />
                  </button>
                }
              >
                Deine erfassten Speisen findest du hier wieder.
              </Empty>
            )}
          </section>
        </aside>
      </div>
      {entry && (
        <MealEditor
          entry={entry}
          date={date}
          foods={foods}
          onClose={() => setEntry(null)}
        />
      )}
      {food && <FoodEditor food={food} onClose={() => setFood(null)} />}
    </>
  );
}
export function MealRow({ meal, onEdit }: { meal: any; onEdit?: () => void }) {
  return (
    <div className="meal-row">
      <span className="meal-symbol">
        <Apple size={18} />
      </span>
      <div className="meal-info">
        <b>{meal.name}</b>
        <small>
          {meal.amount_grams ? `${fmt(meal.amount_grams)} g · ` : ""}
          {meal.is_planned
            ? "Geplant"
            : meal.review_status === "pending"
              ? "Zu prüfen"
              : `${fmt(meal.protein_g)} g Protein`}
          {meal.notes?.includes("KI") ? " · geschätzt" : ""}
        </small>
      </div>
      <strong>
        {fmt(meal.kcal)}
        <small> kcal</small>
      </strong>
      {meal.is_planned ? (
        <ActionButton
          className="icon-btn add-food"
          action={() => eatPlannedMeal(meal.id)}
          message="Als gegessen erfasst."
        >
          <Check size={17} />
          <span className="sr-only">Als gegessen erfassen</span>
        </ActionButton>
      ) : meal.review_status === "pending" ? (
        <ActionButton
          className="icon-btn add-food"
          action={() => reviewMeal(meal.id, "approved")}
          message="Eintrag bestätigt."
        >
          <Check size={17} />
          <span className="sr-only">Eintrag bestätigen</span>
        </ActionButton>
      ) : null}
      {onEdit && (
        <button
          className="icon-btn"
          aria-label={`${meal.name} bearbeiten`}
          onClick={onEdit}
        >
          <MoreHorizontal size={17} />
        </button>
      )}
      <ActionButton
        className="icon-btn subtle-danger"
        action={() => archiveMeal(meal.id)}
        message="Eintrag entfernt."
      >
        <Trash2 size={14} />
        <span className="sr-only">Eintrag entfernen</span>
      </ActionButton>
    </div>
  );
}
export function MealEditor({
  entry,
  date,
  foods,
  onClose,
}: {
  entry: any;
  date: string;
  foods: any[];
  onClose: () => void;
}) {
  const [selected, setSelected] = useState("");
  const [grams, setGrams] = useState(String(entry.amount_grams || 100));
  const [busy, setBusy] = useState(false);
  const { run } = useFeedback();
  const food = foods.find((f) => f.id === selected);
  return (
    <Modal
      title={entry.id ? "Mahlzeit bearbeiten" : "Mahlzeit hinzufügen"}
      onClose={onClose}
    >
      <form
        className="form-stack"
        onSubmit={async (e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          setBusy(true);
          const data = {
            entry_date: String(f.get("date")),
            meal_slot: String(f.get("slot")),
            food_id: food?.id ?? entry.food_id ?? null,
            name: food?.name ?? String(f.get("name")),
            amount_grams: food ? Number(grams) : Number(f.get("grams")) || null,
            kcal: food
              ? (num(food.kcal) * Number(grams)) / 100
              : Number(f.get("kcal")),
            protein_g: food
              ? (num(food.protein_g) * Number(grams)) / 100
              : Number(f.get("protein_g")),
            carbs_g: food
              ? (num(food.carbs_g) * Number(grams)) / 100
              : Number(f.get("carbs_g")),
            fat_g: food
              ? (num(food.fat_g) * Number(grams)) / 100
              : Number(f.get("fat_g")),
            is_planned: f.get("planned") === "on",
            review_status: "approved",
            notes: entry.notes ?? null,
            fiber_g: food
              ? food.fiber_g == null
                ? null
                : (num(food.fiber_g) * Number(grams)) / 100
              : f.get("fiber_g") === ""
                ? null
                : Number(f.get("fiber_g")),
            sugar_g: food
              ? food.sugar_g == null
                ? null
                : (num(food.sugar_g) * Number(grams)) / 100
              : f.get("sugar_g") === ""
                ? null
                : Number(f.get("sugar_g")),
            salt_g: food
              ? food.salt_g == null
                ? null
                : (num(food.salt_g) * Number(grams)) / 100
              : f.get("salt_g") === ""
                ? null
                : Number(f.get("salt_g")),
          };
          const ok = await run(
            () => (entry.id ? updateMeal(entry.id, data) : createMeal(data)),
            "Mahlzeit gespeichert.",
          );
          setBusy(false);
          if (ok) onClose();
        }}
      >
        {!entry.id && (
          <label>
            Aus Speiseauswahl
            <select
              value={selected}
              onChange={(e) => {
                setSelected(e.target.value);
                setGrams(
                  String(
                    foods.find((f) => f.id === e.target.value)?.serving_grams ||
                      100,
                  ),
                );
              }}
            >
              <option value="">Selbst eingeben</option>
              {foods.map((f) => (
                <option value={f.id} key={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <div className="form-grid">
          <label>
            Datum
            <input
              name="date"
              type="date"
              defaultValue={entry.entry_date || date}
              required
            />
          </label>
          <label>
            Mahlzeit
            <select name="slot" defaultValue={entry.meal_slot || "lunch"}>
              {Object.entries(slots).map(([k, l]) => (
                <option value={k} key={k}>
                  {l}
                </option>
              ))}
            </select>
          </label>
        </div>
        {food ? (
          <>
            <label>
              Portion · Gramm
              <input
                type="number"
                min="1"
                max="5000"
                value={grams}
                onChange={(e) => setGrams(e.target.value)}
                required
              />
            </label>
            <div className="inline-macros">
              {fmt((num(food.kcal) * Number(grams)) / 100)} kcal ·{" "}
              {fmt((num(food.protein_g) * Number(grams)) / 100)} g Protein
            </div>
          </>
        ) : (
          <>
            <label>
              Speise
              <input
                name="name"
                defaultValue={entry.name || ""}
                required
                maxLength={140}
              />
            </label>
            <NumberField
              label="Portion · Gramm (optional)"
              name="grams"
              defaultValue={entry.amount_grams ?? ""}
              max={5000}
            />
            <div className="form-grid">
              {[
                ["kcal", "Kalorien"],
                ["protein_g", "Protein · g"],
                ["carbs_g", "Kohlenhydrate · g"],
                ["fat_g", "Fett · g"],
              ].map(([k, l]) => (
                <NumberField
                  key={k}
                  name={k}
                  label={l}
                  defaultValue={entry[k] ?? ""}
                  required
                />
              ))}
            </div>
            <small className="muted">Werte für die gesamte Portion.</small>
            <details>
              <summary>Weitere Nährwerte</summary>
              <div className="form-grid">
                {[
                  ["fiber_g", "Ballaststoffe g"],
                  ["sugar_g", "Zucker g"],
                  ["salt_g", "Salz g"],
                ].map(([key, label]) => (
                  <NumberField
                    key={key}
                    name={key}
                    label={label}
                    defaultValue={entry[key] ?? ""}
                  />
                ))}
              </div>
            </details>
          </>
        )}
        <label className="checkbox-label">
          <input
            type="checkbox"
            name="planned"
            defaultChecked={entry.is_planned}
          />{" "}
          Im Kalender planen
        </label>
        <button className="btn btn-primary" disabled={busy}>
          {busy ? "Speichert …" : "Speichern"}
        </button>
      </form>
    </Modal>
  );
}
function FoodEditor({ food, onClose }: { food: any; onClose: () => void }) {
  const { run } = useFeedback();
  const [busy, setBusy] = useState(false);
  return (
    <Modal
      title={food.id ? "Speise bearbeiten" : "Speise anlegen"}
      onClose={onClose}
    >
      <form
        className="form-stack"
        onSubmit={async (e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          setBusy(true);
          const data = {
            name: String(f.get("name")),
            category: "Gericht",
            kcal: Number(f.get("kcal")),
            protein_g: Number(f.get("protein_g")),
            carbs_g: Number(f.get("carbs_g")),
            fat_g: Number(f.get("fat_g")),
            serving_grams: Number(f.get("serving_grams")),
            source: "Manuell geprüft",
            fiber_g: food.fiber_g ?? null,
            sugar_g: food.sugar_g ?? null,
            salt_g: food.salt_g ?? null,
          };
          const ok = await run(
            () => (food.id ? updateFood(food.id, data) : createFood(data)),
            "Speise gespeichert.",
          );
          setBusy(false);
          if (ok) onClose();
        }}
      >
        <label>
          Name
          <input
            name="name"
            defaultValue={food.name || ""}
            required
            maxLength={140}
          />
        </label>
        <p className="muted">Nährwerte je 100 g.</p>
        <div className="form-grid">
          {[
            ["kcal", "Kalorien"],
            ["protein_g", "Protein g"],
            ["carbs_g", "Kohlenhydrate g"],
            ["fat_g", "Fett g"],
          ].map(([k, l]) => (
            <NumberField
              key={k}
              name={k}
              label={l}
              defaultValue={food[k] ?? ""}
              required
            />
          ))}
        </div>
        <NumberField
          name="serving_grams"
          label="Ganze Portion · Gramm"
          defaultValue={food.serving_grams || 100}
          max={5000}
          min={1}
          required
        />
        <button className="btn btn-primary" disabled={busy}>
          {busy ? "Speichert …" : "Speichern"}
        </button>
      </form>
      {food.id && (
        <ActionButton
          className="btn btn-danger"
          action={async () => {
            await archiveFood(food.id);
            onClose();
          }}
        >
          <Trash2 size={16} /> Entfernen
        </ActionButton>
      )}
    </Modal>
  );
}
