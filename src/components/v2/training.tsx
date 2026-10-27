"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowRight,
  Check,
  ChevronRight,
  Dumbbell,
  Pause,
  Play,
  Plus,
  Settings2,
  Sparkles,
  Timer,
  Trash2,
} from "lucide-react";
import {
  addStarterPlan,
  activatePlan,
  archivePlan,
  finishWorkout,
  updatePlan,
  updatePlanDay,
  updatePlanExercise,
  removePlanExercise,
  createPlanDay,
  addPlanExercise,
  createExercise,
} from "@/app/actions";
import { beginWorkout, recordSet } from "@/app/ai-actions";
import { PageHeading } from "@/components/app-shell";
import {
  ActionButton,
  Empty,
  fmt,
  Modal,
  num,
  SectionTitle,
  useFeedback,
} from "./ui";
import { useAi } from "./ai-flow";
import { EntityImageField, StorageImage } from "./entity-image";

const weekdays = [
  "Montag",
  "Dienstag",
  "Mittwoch",
  "Donnerstag",
  "Freitag",
  "Samstag",
  "Sonntag",
];
export function TrainPage({ data }: { data: any }) {
  const { openAi } = useAi();
  const [runnerId, setRunnerId] = useState<string | null>(
    data.openSessionId ?? null,
  );
  const [editing, setEditing] = useState<any>(null);
  const [selected, setSelected] = useState<string>(
    data.openPlanId ?? data.activePlan?.id ?? data.plans[0]?.id ?? "",
  );
  const plan =
    data.plans.find((item: any) => item.id === selected) ?? data.plans[0];
  const active = data.sessions.find((session: any) => !session.finished_at);
  const running = data.sessions.find((session: any) => session.id === runnerId);
  return (
    <>
      <PageHeading
        eyebrow="DEIN NÄCHSTER SCHRITT"
        title="Dein Training."
        subtitle="Plan wählen. Starten. Satz für Satz."
        action={
          <button className="btn btn-primary" onClick={() => openAi("plan")}>
            <Sparkles size={17} /> Plan mit KI erstellen
          </button>
        }
      />
      {active && (
        <div className="resume-banner">
          <span>
            <i className="status-dot" />
            <b>{active.title}</b> ist noch aktiv.
          </span>
          <button
            className="btn btn-primary"
            onClick={() => setRunnerId(active.id)}
          >
            <Play size={16} /> Fortsetzen
          </button>
        </div>
      )}
      <div className="train-layout">
        <section>
          <div className="card plan-card">
            <div className="section-heading">
              <div>
                <span className="eyebrow">DEIN TRAININGSPLAN</span>
                <h2>{plan?.name ?? "Dein erster Plan"}</h2>
              </div>
              {plan && (
                <button
                  className="icon-btn"
                  aria-label="Trainingsplan bearbeiten"
                  onClick={() => setEditing(plan)}
                >
                  <Settings2 size={19} />
                </button>
              )}
            </div>
            {plan?.image_path && (
              <StorageImage path={plan.image_path} alt={`${plan.name}`} className="entity-cover" />
            )}
            {data.plans.length > 0 && (
              <div className="plan-toolbar">
                <select
                  aria-label="Trainingsplan auswählen"
                  value={plan?.id ?? ""}
                  onChange={(e) => setSelected(e.target.value)}
                >
                  {data.plans.map((item: any) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
                {plan?.is_active ? (
                  <span className="pill">
                    <Check size={12} /> Im Kalender
                  </span>
                ) : (
                  <ActionButton
                    className="btn btn-secondary btn-small"
                    action={() => activatePlan(plan.id)}
                    message="Plan im Kalender aktiviert."
                  >
                    Im Kalender aktivieren
                  </ActionButton>
                )}
              </div>
            )}
            {plan ? (
              <div className="training-days">
                {plan.days.map((day: any, index: number) => (
                  <div className="training-day" key={day.id}>
                    <div className="day-number">
                      {String(index + 1).padStart(2, "0")}
                    </div>
                    <div className="training-day-main">
                      <small>
                        {day.weekday != null
                          ? weekdays[day.weekday]
                          : "Flexibler Trainingstag"}
                      </small>
                      <h3>{day.name}</h3>
                      <div className="exercise-pills">
                        {day.exercises.map((entry: any) => (
                          <span key={entry.id} className="exercise-pill">
                            {entry.exercise?.image_path && <StorageImage path={entry.exercise.image_path} alt="" className="exercise-thumb" />}
                            {entry.exercise?.name || "Übung"}
                          </span>
                        ))}
                      </div>
                      <span className="muted">
                        {day.is_rest_day
                          ? "Erholung"
                          : `${day.exercises.length} Übungen · ${day.exercises.reduce((sum: number, entry: any) => sum + num(entry.target_sets), 0)} Sätze`}
                      </span>
                    </div>
                    {!day.is_rest_day && (
                      <ActionButton
                        className="btn btn-primary"
                        disabled={!day.exercises.length}
                        action={async () => {
                          const id = await beginWorkout(day.id);
                          if (id) setRunnerId(id);
                        }}
                      >
                        <Play size={16} /> Starten
                      </ActionButton>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <Empty
                action={
                  <button
                    className="btn btn-primary"
                    onClick={() => openAi("plan")}
                  >
                    <Sparkles size={16} /> Plan erstellen
                  </button>
                }
              >
                Wie möchtest du trainieren?
              </Empty>
            )}
            {plan && !plan.days.length && (
              <Empty
                action={
                  <button
                    className="btn btn-secondary"
                    onClick={() => setEditing(plan)}
                  >
                    Trainingstag hinzufügen
                  </button>
                }
              >
                Noch keine Trainingstage.
              </Empty>
            )}
          </div>
          <section className="card">
            <SectionTitle
              title="Deine Einheiten"
              action={
                <span className="pill neutral">
                  {data.sessions.filter((s: any) => s.finished_at).length}{" "}
                  abgeschlossen
                </span>
              }
            />
            {data.sessions.filter((s: any) => s.finished_at).length ? (
              data.sessions
                .filter((s: any) => s.finished_at)
                .map((session: any) => (
                  <details className="history-item" key={session.id}>
                    <summary>
                      <span className="list-icon">
                        <Dumbbell size={17} />
                      </span>
                      <span>
                        <b>{session.title}</b>
                        <small>
                          {new Date(session.started_at).toLocaleDateString(
                            "de-DE",
                          )}{" "}
                          · {fmt(num(session.duration_seconds) / 60)} min
                        </small>
                      </span>
                      <strong>
                        {fmt(session.total_volume)} <small>kg</small>
                      </strong>
                      <ChevronRight size={16} />
                    </summary>
                    <div className="history-details">
                      {session.exercises.map((exercise: any) => (
                        <div key={exercise.id}>
                          <b>{exercise.exercise_name}</b>
                          <div className="set-chips">
                            {exercise.sets.map((set: any) => (
                              <span key={set.id}>
                                {set.duration_seconds
                                  ? `${set.duration_seconds} s`
                                  : `${fmt(set.weight_kg, 1)} kg × ${set.reps}`}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </details>
                ))
            ) : (
              <Empty>Deine abgeschlossenen Trainings erscheinen hier.</Empty>
            )}
          </section>
        </section>
        <aside className="train-aside">
          <div className="dark-card">
            <span className="eyebrow">DEIN KI-COACH</span>
            <Sparkles size={28} />
            <h2>Ein Plan, der zu dir passt.</h2>
            <p>Dein Ziel. Dein Equipment. Deine Zeit.</p>
            <button className="btn btn-lime" onClick={() => openAi("plan")}>
              Plan erstellen <ArrowRight size={16} />
            </button>
          </div>
          <div className="card starter-mini">
            <span className="eyebrow">DIREKT LOSLEGEN</span>
            <h3>Ganzkörper · 3 Tage</h3>
            <p>Ein vorbereiteter Startpunkt.</p>
            <ActionButton
              className="btn btn-secondary full"
              action={addStarterPlan}
              message="Vorlage hinzugefügt. Im Planmenü auswählen."
            >
              <Plus size={16} /> Vorlage hinzufügen
            </ActionButton>
          </div>
          <div className="card">
            <SectionTitle
              title="Übungsbibliothek"
              action={
                <span className="pill neutral">{data.exercises.length}</span>
              }
            />
            <ExerciseLibrary exercises={data.exercises} />
          </div>
        </aside>
      </div>
      {running && (
        <WorkoutRunner
          session={running}
          plans={data.plans}
          history={data.sessions}
          onClose={() => setRunnerId(null)}
        />
      )}
      {editing && (
        <PlanEditor
          plan={data.plans.find((p: any) => p.id === editing.id) ?? editing}
          exercises={data.exercises}
          onClose={() => setEditing(null)}
        />
      )}
    </>
  );
}
function WorkoutRunner({
  session,
  plans,
  history,
  onClose,
}: {
  session: any;
  plans: any[];
  history: any[];
  onClose: () => void;
}) {
  const [selectedId, setSelectedId] = useState(session.exercises[0]?.id);
  const [order, setOrder] = useState<string[]>(
    session.exercises.map((e: any) => e.id),
  );
  const [restUntil, setRestUntil] = useState<number | null>(null);
  const [tick, setTick] = useState(() => Date.now());
  const [confirmFinish, setConfirmFinish] = useState(false);
  useEffect(() => {
    const timer = setInterval(() => setTick(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const day = plans
    .flatMap((p) => p.days)
    .find((d: any) => d.id === session.plan_day_id);
  const targetFor = (exercise: any) =>
    day?.exercises.find(
      (item: any) => item.exercise_id === exercise.exercise_id,
    );
  const exercises = order
    .map((id) => session.exercises.find((e: any) => e.id === id))
    .filter(Boolean);
  const selected = exercises.find((e) => e.id === selectedId) ?? exercises[0];
  const completed = session.exercises.reduce(
    (sum: number, e: any) => sum + e.sets.length,
    0,
  );
  const total = session.exercises.reduce(
    (sum: number, e: any) => sum + (targetFor(e)?.target_sets ?? 3),
    0,
  );
  const target = selected ? targetFor(selected) : null;
  const nextExercise = exercises.find(
    (exercise) =>
      exercise.id !== selected?.id &&
      exercise.sets.length < (targetFor(exercise)?.target_sets ?? 3),
  );
  const previousWeight = selected
    ? history
        .filter((s) => s.finished_at)
        .flatMap((s) => s.exercises)
        .find((e: any) => e.exercise_id === selected.exercise_id)
        ?.sets?.at(-1)?.weight_kg
    : undefined;
  const seconds = restUntil
    ? Math.max(0, Math.ceil((restUntil - tick) / 1000))
    : 0;
  function move(id: string, delta: number) {
    const next = [...order];
    const index = next.indexOf(id);
    const other = index + delta;
    if (other < 0 || other >= next.length) return;
    [next[index], next[other]] = [next[other], next[index]];
    setOrder(next);
  }
  return (
    <Modal title={session.title} onClose={onClose} wide>
      <div className="workout-summary">
        <span>
          <Timer size={16} />
          {fmt(
            Math.max(
              0,
              (tick - new Date(session.started_at).getTime()) / 60000,
            ),
          )}{" "}
          min
        </span>
        <span>
          {completed} / {total} Sätze
        </span>
        <button className="text-btn" onClick={onClose}>
          Später fortsetzen
        </button>
      </div>
      <div className="runner-progress">
        <i
          style={{
            width: `${Math.min(100, (completed / Math.max(1, total)) * 100)}%`,
          }}
        />
      </div>
      <div className="runner-tabs">
        {exercises.map((exercise, index) => {
          const done =
            exercise.sets.length >= (targetFor(exercise)?.target_sets ?? 3);
          return (
            <button
              className={exercise.id === selected?.id ? "selected" : ""}
              key={exercise.id}
              onClick={() => setSelectedId(exercise.id)}
            >
              <span>{done ? <Check size={15} /> : index + 1}</span>
              {exercise.exercise_name}
            </button>
          );
        })}
      </div>
      {selected ? (
        <div className="runner-exercise">
          <div className="section-heading">
            <div>
              <span className="eyebrow">DEINE ÜBUNG</span>
              <h2>{selected.exercise_name}</h2>
            </div>
            <div className="inline-actions">
              <button
                className="icon-btn"
                aria-label="Übung nach vorne"
                onClick={() => move(selected.id, -1)}
              >
                <ArrowUp size={17} />
              </button>
              <button
                className="icon-btn"
                aria-label="Übung nach hinten"
                onClick={() => move(selected.id, 1)}
              >
                <ArrowDown size={17} />
              </button>
            </div>
          </div>
          {target?.notes && <p className="muted">{target.notes}</p>}
          <div className="set-table-label">
            <span>Satz</span>
            <span>Gewicht · kg</span>
            <span>{target?.duration_seconds ? "Zeit · s" : "Wdh."}</span>
            <span />
          </div>
          {Array.from(
            {
              length: Math.max(target?.target_sets ?? 3, selected.sets.length),
            },
            (_, i) => (
              <SetRow
                key={`${selected.id}-${i}`}
                exercise={selected}
                index={i}
                target={target}
                previousWeight={previousWeight}
                onSaved={() =>
                  setRestUntil(Date.now() + (target?.rest_seconds ?? 90) * 1000)
                }
              />
            ),
          )}
          {nextExercise &&
            selected.sets.length >= (target?.target_sets ?? 3) && (
              <button
                className="btn btn-secondary full"
                onClick={() => setSelectedId(nextExercise.id)}
              >
                Nächste Übung <ArrowRight size={16} />
              </button>
            )}
          {restUntil && (
            <div
              className={`rest-timer ${seconds === 0 ? "ready" : ""}`}
              role="status"
            >
              <Pause size={18} />
              <span>
                {seconds
                  ? `Pause · ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`
                  : "Bereit für den nächsten Satz"}
              </span>
              <button className="text-btn" onClick={() => setRestUntil(null)}>
                Überspringen
              </button>
            </div>
          )}
        </div>
      ) : (
        <Empty>Keine Übungen in dieser Einheit.</Empty>
      )}
      {confirmFinish ? (
        <div className="finish-confirm">
          <p>
            {completed < total
              ? "Es sind noch Sätze offen. Trotzdem abschließen?"
              : "Training abschließen?"}
          </p>
          <div className="inline-actions">
            <ActionButton
              className="btn btn-primary"
              action={async () => {
                await finishWorkout({
                  session_id: session.id,
                  duration_seconds: Math.min(
                    86400,
                    Math.max(
                      0,
                      Math.round(
                        (Date.now() - new Date(session.started_at).getTime()) /
                          1000,
                      ),
                    ),
                  ),
                });
                onClose();
              }}
              message="Training abgeschlossen. Stark gemacht."
            >
              <Check size={17} /> Abschließen
            </ActionButton>
            <button
              className="btn btn-secondary"
              onClick={() => setConfirmFinish(false)}
            >
              Zurück
            </button>
          </div>
        </div>
      ) : (
        <button
          className="btn btn-primary full"
          onClick={() => setConfirmFinish(true)}
        >
          <Check size={17} /> Training abschließen
        </button>
      )}
    </Modal>
  );
}
function SetRow({
  exercise,
  index,
  target,
  previousWeight,
  onSaved,
}: {
  exercise: any;
  index: number;
  target: any;
  previousWeight?: number;
  onSaved: () => void;
}) {
  const set = exercise.sets.find((item: any) => item.set_number === index + 1);
  const [weight, setWeight] = useState(
    String(
      set?.weight_kg ?? exercise.sets.at(-1)?.weight_kg ?? previousWeight ?? "",
    ),
  );
  const [reps, setReps] = useState(
    String(
      set?.duration_seconds ||
        set?.reps ||
        target?.duration_seconds ||
        target?.rep_min ||
        10,
    ),
  );
  return (
    <div className={`set-row ${set ? "done" : ""}`}>
      <span>{index + 1}</span>
      <input
        type="number"
        min="0"
        max="2000"
        step=".5"
        aria-label={`Satz ${index + 1} Gewicht`}
        placeholder="0"
        value={weight}
        onChange={(e) => setWeight(e.target.value)}
      />
      <input
        type="number"
        min="0"
        max={target?.duration_seconds ? 86400 : 1000}
        aria-label={`Satz ${index + 1} ${target?.duration_seconds ? "Sekunden" : "Wiederholungen"}`}
        value={reps}
        onChange={(e) => setReps(e.target.value)}
      />
      <ActionButton
        className={`set-check ${set ? "checked" : ""}`}
        action={async () => {
          if (Number(reps) <= 0)
            throw new Error("Bitte Wiederholungen oder Sekunden eintragen.");
          await recordSet({
            exercise_id: exercise.id,
            number: index + 1,
            weight: Number(weight || 0),
            reps: target?.duration_seconds ? 0 : Number(reps),
            duration: target?.duration_seconds ? Number(reps) : 0,
          });
          onSaved();
        }}
      >
        <Check size={18} />
        <span className="sr-only">Satz {index + 1} speichern</span>
      </ActionButton>
    </div>
  );
}
function PlanEditor({
  plan,
  exercises,
  onClose,
}: {
  plan: any;
  exercises: any[];
  onClose: () => void;
}) {
  const { run } = useFeedback();
  const [imagePath, setImagePath] = useState<string | null>(plan.image_path ?? null);
  return (
    <Modal title="Plan bearbeiten" onClose={onClose} wide>
      <form
        className="form-stack"
        onSubmit={async (e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          await run(
            () =>
              updatePlan(plan.id, {
                name: String(f.get("name")),
                description: String(f.get("description")),
                image_path: imagePath,
              }),
            "Plan gespeichert.",
          );
        }}
      >
        <label>
          Planname
          <input
            name="name"
            defaultValue={plan.name}
            required
            maxLength={100}
          />
        </label>
        <label>
          Notiz
          <textarea
            name="description"
            defaultValue={plan.description || ""}
            maxLength={1000}
          />
        </label>
        <EntityImageField path={imagePath} onChange={setImagePath} label="Bild zum Trainingsplan" />
        <button className="btn btn-primary">Speichern</button>
      </form>
      <div className="editor-days">
        {plan.days.map((day: any) => (
          <details className="draft-day" key={day.id}>
            <summary>
              <b>{day.name}</b>
              <small>{day.exercises.length} Übungen</small>
            </summary>
            <form
              className="form-stack"
              onSubmit={async (e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                await run(
                  () =>
                    updatePlanDay(day.id, {
                      name: String(f.get("name")),
                      day_order: day.day_order,
                      weekday:
                        f.get("weekday") === ""
                          ? null
                          : Number(f.get("weekday")),
                      is_rest_day: day.is_rest_day,
                    }),
                  "Tag gespeichert.",
                );
              }}
            >
              <div className="form-grid">
                <label>
                  Name
                  <input name="name" defaultValue={day.name} required />
                </label>
                <label>
                  Wochentag
                  <select name="weekday" defaultValue={day.weekday ?? ""}>
                    <option value="">Flexibel</option>
                    {weekdays.map((name, i) => (
                      <option value={i} key={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <button className="btn btn-secondary btn-small">
                Tag speichern
              </button>
            </form>
            {day.exercises.map((entry: any) => (
              <form
                className="exercise-edit"
                key={entry.id}
                onSubmit={async (e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  await run(
                    () =>
                      updatePlanExercise(entry.id, {
                        target_sets: Number(f.get("sets")),
                        rep_min: f.get("duration") ? 1 : Number(f.get("reps")),
                        rep_max: f.get("duration") ? 1 : Number(f.get("reps")),
                        duration_seconds: f.get("duration")
                          ? Number(f.get("duration"))
                          : null,
                        rest_seconds: Number(f.get("rest")),
                        notes: entry.notes,
                        exercise_order: entry.exercise_order,
                      }),
                    "Übung gespeichert.",
                  );
                }}
              >
                <b>{entry.exercise?.name}</b>
                <div className="form-grid three">
                  <label>
                    Sätze
                    <input
                      name="sets"
                      type="number"
                      min="1"
                      max="20"
                      defaultValue={entry.target_sets}
                      required
                    />
                  </label>
                  <label>
                    Wdh.
                    <input
                      name="reps"
                      type="number"
                      min="1"
                      max="100"
                      defaultValue={entry.rep_min}
                      required
                    />
                  </label>
                  <label>
                    Pause s
                    <input
                      name="rest"
                      type="number"
                      min="0"
                      max="900"
                      defaultValue={entry.rest_seconds}
                      required
                    />
                  </label>
                  <label>
                    Dauer · Sekunden (optional)
                    <input
                      name="duration"
                      type="number"
                      min="5"
                      max="3600"
                      defaultValue={entry.duration_seconds ?? ""}
                    />
                  </label>
                </div>
                <div className="inline-actions">
                  <button className="btn btn-secondary btn-small">
                    Speichern
                  </button>
                  <ActionButton
                    className="icon-btn danger"
                    action={() => removePlanExercise(entry.id)}
                  >
                    <Trash2 size={16} />
                    <span className="sr-only">Übung entfernen</span>
                  </ActionButton>
                </div>
              </form>
            ))}
            <form
              className="inline-form"
              onSubmit={async (e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                await run(
                  () =>
                    addPlanExercise({
                      day_id: day.id,
                      exercise_id: String(f.get("exercise")),
                      exercise_order: day.exercises.length + 1,
                      target_sets: 3,
                      rep_min: 8,
                      rep_max: 12,
                      rest_seconds: 90,
                    }),
                  "Übung hinzugefügt.",
                );
              }}
            >
              <select name="exercise" aria-label="Übung hinzufügen" required>
                <option value="">Übung auswählen</option>
                {exercises.map((ex) => (
                  <option value={ex.id} key={ex.id}>
                    {ex.name}
                  </option>
                ))}
              </select>
              <button
                className="btn btn-secondary"
                aria-label="Übung zum Tag hinzufügen"
              >
                <Plus size={16} />
              </button>
            </form>
          </details>
        ))}
      </div>
      <form
        className="inline-form"
        onSubmit={async (e) => {
          e.preventDefault();
          const form = e.currentTarget;
          const f = new FormData(form);
          if (
            await run(
              () =>
                createPlanDay({
                  plan_id: plan.id,
                  name: String(f.get("name")),
                  day_order: plan.days.length + 1,
                  weekday: null,
                  is_rest_day: false,
                }),
              "Trainingstag hinzugefügt.",
            )
          )
            form.reset();
        }}
      >
        <input
          name="name"
          placeholder="Neuer Trainingstag"
          required
          maxLength={80}
        />
        <button className="btn btn-secondary">
          <Plus size={16} /> Tag
        </button>
      </form>
      <hr />
      <ActionButton
        className="btn btn-danger"
        action={async () => {
          if (
            window.confirm(
              "Plan archivieren? Deine Trainingseinheiten bleiben gespeichert.",
            )
          ) {
            await archivePlan(plan.id);
            onClose();
          }
        }}
      >
        <Trash2 size={16} /> Plan archivieren
      </ActionButton>
    </Modal>
  );
}
function ExerciseLibrary({ exercises }: { exercises: any[] }) {
  const [search, setSearch] = useState("");
  const [adding, setAdding] = useState(false);
  const [imagePath, setImagePath] = useState<string | null>(null);
  const { run } = useFeedback();
  return (
    <>
      <input
        aria-label="Übungen durchsuchen"
        placeholder="Übung suchen …"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <div className="compact-library">
        {exercises
          .filter((e) =>
            `${e.name} ${e.primary_muscle}`
              .toLowerCase()
              .includes(search.toLowerCase()),
          )
          .map((e) => (
            <div key={e.id}>
              {e.image_path && <StorageImage path={e.image_path} alt="" className="exercise-thumb" />}
              <b>{e.name}</b>
              <small>
                {e.primary_muscle} · {e.equipment}
              </small>
            </div>
          ))}
      </div>
      <button className="text-btn" onClick={() => setAdding(!adding)}>
        <Plus size={15} /> Eigene Übung
      </button>
      {adding && (
        <form
          className="form-stack"
          onSubmit={async (e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            if (
              await run(
                () =>
                  createExercise({
                    name: String(f.get("name")),
                    primary_muscle: String(f.get("muscle")),
                    equipment: String(f.get("equipment")),
                    movement_type: "free_weight",
                    image_path: imagePath,
                  }),
                "Übung gespeichert.",
              )
            ) {
              setAdding(false);
              setImagePath(null);
            }
          }}
        >
          <label>
            Name
            <input name="name" required />
          </label>
          <label>
            Muskelgruppe
            <input name="muscle" required />
          </label>
          <label>
            Equipment
            <input name="equipment" required />
          </label>
          <EntityImageField path={imagePath} onChange={setImagePath} label="Bild zur Übung" />
          <button className="btn btn-primary">Speichern</button>
        </form>
      )}
    </>
  );
}
