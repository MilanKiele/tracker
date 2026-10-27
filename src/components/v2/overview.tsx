"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import Link from "next/link";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { addDays, addWeeks, format, parseISO, startOfWeek } from "date-fns";
import {
  ArrowRight,
  Camera,
  Check,
  ChevronLeft,
  ChevronRight,
  Droplets,
  Dumbbell,
  Moon,
  Play,
  Plus,
  Sparkles,
} from "lucide-react";
import { logWater, saveJournal } from "@/app/actions";
import { beginWorkout } from "@/app/ai-actions";
import { PageHeading } from "@/components/app-shell";
import { useAi } from "./ai-flow";
import {
  ActionButton,
  Empty,
  fmt,
  Modal,
  num,
  NumberField,
  SectionTitle,
  today,
  useFeedback,
} from "./ui";
import {
  DateNavigation,
  MealEditor,
  MealRow,
  NutritionSummary,
  sumMeals,
} from "./nutrition";
import { MeasurementEditor } from "./body-insights";

export function TodayPage({ data }: { data: any }) {
  const day =
    data.days.find((d: any) => d.date === data.selectedDate) ?? data.days[0];
  const date = day.date;
  const selectedDate = parseISO(date);
  const router = useRouter();
  const { openAi } = useAi();
  const [meal, setMeal] = useState<any>(null);
  const [checkin, setCheckin] = useState(false);
  const [journal, setJournal] = useState(false);
  const touch = useRef<number | null>(null);
  const actual = day.meals.filter(
    (m: any) => !m.is_planned && m.review_status === "approved",
  );
  const planned = day.meals.filter(
    (m: any) => m.is_planned && m.review_status !== "denied",
  );
  const completed = data.days.reduce(
    (sum: number, d: any) =>
      sum + d.sessions.filter((s: any) => s.finished_at).length,
    0,
  );
  const weekday = (selectedDate.getDay() + 6) % 7;
  return (
    <>
      <PageHeading
        eyebrow={`DEIN WORKSPACE · ${selectedDate.toLocaleDateString("de-DE", { month: "long", year: "numeric" }).toUpperCase()}`}
        title={`Hallo${data.context.profile?.full_name ? `, ${data.context.profile.full_name.split(" ")[0]}` : ""}.`}
        subtitle="Alles für deinen Tag. An einem Ort."
        action={
          <button
            className="btn btn-primary"
            onClick={() => openAi("food", date)}
          >
            <Camera size={17} /> Essen scannen
          </button>
        }
      />
      <section className="overview-hero">
        <div>
          <span className="hero-eyebrow">
            <i /> DEIN RHYTHMUS
          </span>
          <h2>
            Ein guter Tag
            <br />
            beginnt bei dir<span>.</span>
          </h2>
          <p>
            {completed
              ? `${completed} Training${completed === 1 ? "" : "s"} diese Woche. Bleib in Bewegung.`
              : "Ein Training. Eine Mahlzeit. Dein nächster Schritt."}
          </p>
          <div className="hero-actions">
            <Link href="/train" className="btn btn-lime">
              <Dumbbell size={17} /> Zum Training <ArrowRight size={16} />
            </Link>
            <button className="hero-secondary" onClick={() => openAi("plan")}>
              <Sparkles size={16} /> Plan erstellen
            </button>
          </div>
        </div>
        <div className="hero-orbit" aria-hidden="true">
          <div className="orbit-ring ring-one" />
          <div className="orbit-ring ring-two" />
          <div className="orbit-ring ring-three" />
          <LeafArt />
          <span className="orbit-label">IN DEINEM TEMPO.</span>
        </div>
      </section>
      <section className="card week-card">
        <div className="section-heading">
          <div>
            <span className="eyebrow">DEINE WOCHE</span>
            <h2>
              {format(startOfWeek(selectedDate, { weekStartsOn: 1 }), "dd.MM.")}{" "}
              –{" "}
              {format(
                addDays(startOfWeek(selectedDate, { weekStartsOn: 1 }), 6),
                "dd.MM.",
              )}
            </h2>
          </div>
          <div className="inline-actions">
            <Link
              href={`/?date=${format(addWeeks(selectedDate, -1), "yyyy-MM-dd")}`}
              className="icon-btn"
              aria-label="Vorherige Woche"
            >
              <ChevronLeft size={18} />
            </Link>
            <Link href="/" className="text-btn">
              Heute
            </Link>
            <Link
              href={`/?date=${format(addWeeks(selectedDate, 1), "yyyy-MM-dd")}`}
              className="icon-btn"
              aria-label="Nächste Woche"
            >
              <ChevronRight size={18} />
            </Link>
          </div>
        </div>
        <div className="week-strip">
          {data.days.map((d: any, i: number) => (
            <Link
              href={`/?date=${d.date}`}
              key={d.date}
              className={`week-day ${d.date === date ? "selected" : ""} ${d.date === today() ? "today" : ""}`}
            >
              <span>{["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"][i]}</span>
              <b>{parseISO(d.date).getDate()}</b>
              <div className="day-dots">
                <i
                  className={
                    d.sessions.some((s: any) => s.finished_at)
                      ? "filled"
                      : d.planDay
                        ? "planned"
                        : ""
                  }
                />
                <i className={d.actual.kcal ? "food" : ""} />
              </div>
              <small>{d.planDay?.name || "Freier Tag"}</small>
            </Link>
          ))}
        </div>
      </section>
      <div className="selected-day-bar">
        <h2>
          {date === today()
            ? "Heute"
            : [
                "Montag",
                "Dienstag",
                "Mittwoch",
                "Donnerstag",
                "Freitag",
                "Samstag",
                "Sonntag",
              ][weekday]}
        </h2>
        <DateNavigation date={date} base="/" />
      </div>
      <div
        className="overview-grid"
        onTouchStart={(e) => {
          touch.current = e.touches[0].clientX;
        }}
        onTouchEnd={(e) => {
          if (touch.current === null) return;
          const delta = e.changedTouches[0].clientX - touch.current;
          touch.current = null;
          if (Math.abs(delta) > 90)
            router.push(
              `/?date=${format(addDays(selectedDate, delta < 0 ? 1 : -1), "yyyy-MM-dd")}`,
            );
        }}
      >
        <section className="card today-training">
          <SectionTitle
            title="Dein Training"
            action={
              <Link className="text-btn" href="/train">
                Alle Pläne <ArrowRight size={14} />
              </Link>
            }
          />
          {day.planDay && !day.planDay.is_rest_day ? (
            <>
              <div className="today-plan-title">
                <span className="list-icon">
                  <Dumbbell size={21} />
                </span>
                <div>
                  <h3>{day.planDay.name}</h3>
                  <p>
                    {day.planDay.exercises.length} Übungen ·{" "}
                    {data.activePlan?.name}
                  </p>
                </div>
              </div>
              <div className="today-exercises">
                {day.planDay.exercises.map((e: any, i: number) => (
                  <div key={e.id}>
                    <span>{String(i + 1).padStart(2, "0")}</span>
                    <b>{e.exercise?.name}</b>
                    <small>
                      {e.target_sets} ×{" "}
                      {e.duration_seconds
                        ? `${e.duration_seconds} s`
                        : `${e.rep_min}–${e.rep_max}`}
                    </small>
                  </div>
                ))}
              </div>
              <ActionButton
                className="btn btn-primary full"
                action={async () => {
                  const id = await beginWorkout(day.planDay.id);
                  if (id) router.push(`/train?session=${id}`);
                }}
              >
                <Play size={16} /> Training starten
              </ActionButton>
            </>
          ) : (
            <Empty
              action={
                <Link href="/train" className="btn btn-secondary">
                  <Dumbbell size={16} /> Training wählen
                </Link>
              }
            >
              {day.planDay?.is_rest_day
                ? "Zeit für Erholung."
                : "Heute ist noch kein Training geplant."}
            </Empty>
          )}
          {day.sessions
            .filter((s: any) => s.finished_at)
            .map((s: any) => (
              <div key={s.id} className="completed-session">
                <Check size={16} />
                {s.title}
                <span>{fmt(num(s.duration_seconds) / 60)} min</span>
              </div>
            ))}
        </section>
        <section className="card today-food">
          <SectionTitle
            title="Deine Ernährung"
            action={
              <Link href={`/nutrition?date=${date}`} className="text-btn">
                Tagebuch <ArrowRight size={14} />
              </Link>
            }
          />
          <NutritionSummary
            totals={sumMeals(actual)}
            target={data.target}
            compact
          />
          {[
            ...day.meals.filter(
              (m: any) => !m.is_planned && m.review_status !== "denied",
            ),
            ...planned,
          ].length ? (
            <div className="today-meals">
              {day.meals
                .filter((m: any) => m.review_status !== "denied")
                .map((m: any) => (
                  <MealRow meal={m} key={m.id} onEdit={() => setMeal(m)} />
                ))}
            </div>
          ) : (
            <Empty>Dein Essen wartet auf den ersten Eintrag.</Empty>
          )}
          <button
            className="btn btn-secondary full"
            onClick={() => openAi("food", date)}
          >
            <Camera size={16} /> Mahlzeit hinzufügen
          </button>
        </section>
        <section className="card mini-checkin">
          <div className="checkin-icon water">
            <Droplets size={22} />
          </div>
          <div>
            <h3>Wasser</h3>
            <strong>
              {fmt(day.waterMl / 1000, 2)} <small>Liter</small>
            </strong>
          </div>
          <ActionButton
            className="btn btn-secondary btn-small"
            action={() => logWater({ entry_date: date, amount_ml: 250 })}
          >
            <Plus size={15} /> 250 ml
          </ActionButton>
        </section>
        <section className="card mini-checkin">
          <div className="checkin-icon">
            <Moon size={22} />
          </div>
          <div>
            <h3>Check-in</h3>
            <p>
              {day.journal?.sleep_hours != null
                ? `${fmt(day.journal.sleep_hours, 1)} h Schlaf`
                : "Wie geht’s dir heute?"}
            </p>
          </div>
          <button
            className="icon-btn"
            aria-label="Tagesnotiz öffnen"
            onClick={() => setJournal(true)}
          >
            <Plus size={20} />
          </button>
        </section>
        <section className="card body-mini">
          <div>
            <span className="eyebrow">BODY</span>
            <h3>
              {day.measurement?.weight_kg
                ? `${fmt(day.measurement.weight_kg, 1)} kg`
                : "Dein Körper. Dein Verlauf."}
            </h3>
          </div>
          <button
            className="btn btn-secondary btn-small"
            onClick={() => setCheckin(true)}
          >
            <Plus size={15} /> Messen
          </button>
        </section>
      </div>
      {meal && (
        <MealEditor
          entry={meal}
          date={date}
          foods={data.foods ?? []}
          onClose={() => setMeal(null)}
        />
      )}
      {checkin && (
        <MeasurementEditor date={date} onClose={() => setCheckin(false)} />
      )}
      {journal && (
        <JournalEditor
          date={date}
          journal={day.journal}
          onClose={() => setJournal(false)}
        />
      )}
    </>
  );
}
function LeafArt() {
  return (
    <svg className="hero-leaf" viewBox="0 0 160 200" fill="none">
      <path d="M80 180C35 149 22 93 40 30c56 21 87 62 40 150Z" fill="#c5e7a0" />
      <path
        d="M79 182c-4-50-13-94-34-141m31 111-35-22m31-3 26-38m-34 6-27-18"
        stroke="#244833"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path d="M86 173c-1-52 16-84 53-102 10 47-5 83-53 102Z" fill="#89ad72" />
      <path
        d="m85 174 46-88m-33 61 26-8m-17-11-3-21"
        stroke="#244833"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}
function JournalEditor({
  date,
  journal,
  onClose,
}: {
  date: string;
  journal: any;
  onClose: () => void;
}) {
  const { run } = useFeedback();
  const [busy, setBusy] = useState(false);
  return (
    <Modal title="Dein Check-in" onClose={onClose}>
      <form
        className="form-stack"
        onSubmit={async (e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          const optional = (key: string) =>
            f.get(key) === "" ? null : Number(f.get(key));
          setBusy(true);
          const ok = await run(
            () =>
              saveJournal({
                entry_date: date,
                sleep_hours: optional("sleep"),
                mood: optional("mood"),
                energy: optional("energy"),
                notes: String(f.get("notes")) || null,
              }),
            "Check-in gespeichert.",
          );
          setBusy(false);
          if (ok) onClose();
        }}
      >
        <NumberField
          name="sleep"
          label="Schlaf · Stunden"
          max={24}
          defaultValue={journal?.sleep_hours ?? ""}
        />
        <div className="form-grid">
          <label>
            Stimmung
            <select name="mood" defaultValue={journal?.mood ?? ""}>
              <option value="">Auswählen</option>
              {["Niedrig", "Geht so", "Okay", "Gut", "Sehr gut"].map((s, i) => (
                <option value={i + 1} key={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <label>
            Energie
            <select name="energy" defaultValue={journal?.energy ?? ""}>
              <option value="">Auswählen</option>
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n}>{n}</option>
              ))}
            </select>
          </label>
        </div>
        <label>
          Notiz
          <textarea
            name="notes"
            defaultValue={journal?.notes || ""}
            maxLength={4000}
          />
        </label>
        <button className="btn btn-primary" disabled={busy}>
          Speichern
        </button>
      </form>
    </Modal>
  );
}
