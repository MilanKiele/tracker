"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import Link from "next/link";
import { useState } from "react";
import {
  differenceInYears,
  eachDayOfInterval,
  format,
  parseISO,
  startOfWeek,
  subDays,
} from "date-fns";
import {
  ArrowRight,
  ChevronRight,
  Heart,
  Plus,
  Ruler,
  Target,
  Trash2,
  Weight,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  archiveMeasurementGoal,
  saveMeasurement,
  saveMeasurementGoal,
  updateMeasurement,
} from "@/app/actions";
import { PageHeading } from "@/components/app-shell";
import {
  ActionButton,
  Empty,
  fmt,
  Modal,
  num,
  NumberField,
  Progress,
  SectionTitle,
  Stat,
  today,
  useFeedback,
} from "./ui";

const fields: [string, string, number, number][] = [
  ["weight_kg", "Gewicht · kg", 25, 400],
  ["body_fat_pct", "Körperfett · %", 1, 70],
  ["waist_cm", "Taille · cm", 20, 250],
  ["neck_cm", "Hals · cm", 10, 100],
  ["shoulders_cm", "Schultern · cm", 20, 250],
  ["chest_cm", "Brust · cm", 20, 250],
  ["upper_arm_left_cm", "Oberarm links · cm", 10, 100],
  ["upper_arm_right_cm", "Oberarm rechts · cm", 10, 100],
  ["forearm_left_cm", "Unterarm links · cm", 10, 100],
  ["forearm_right_cm", "Unterarm rechts · cm", 10, 100],
  ["hips_cm", "Hüfte · cm", 20, 250],
  ["thigh_left_cm", "Oberschenkel links · cm", 20, 150],
  ["thigh_right_cm", "Oberschenkel rechts · cm", 20, 150],
  ["calf_left_cm", "Wade links · cm", 10, 100],
  ["calf_right_cm", "Wade rechts · cm", 10, 100],
];
export function BodyPage({ data }: { data: any }) {
  const [editing, setEditing] = useState<any>(null);
  const [goal, setGoal] = useState(false);
  const profile = data.context.profile ?? {};
  const weights = data.measurements
    .filter((m: any) => m.weight_kg != null)
    .slice()
    .reverse();
  const lastWeight = weights.at(-1);
  const firstWeight = weights[0];
  const delta =
    lastWeight && firstWeight
      ? num(lastWeight.weight_kg) - num(firstWeight.weight_kg)
      : null;
  return (
    <>
      <PageHeading
        eyebrow="DEIN KÖRPER IM VERLAUF"
        title="Dein Körper."
        action={
          <button className="btn btn-primary" onClick={() => setEditing({})}>
            <Plus size={17} /> Messung erfassen
          </button>
        }
      />
      <div className="stats-grid four">
        <Stat
          label="Gewicht"
          value={lastWeight ? fmt(lastWeight.weight_kg, 1) : "—"}
          unit="kg"
          detail={
            delta != null && weights.length > 1
              ? `${delta > 0 ? "+" : ""}${fmt(delta, 1)} kg seit erster Messung`
              : "Deine erfassten Werte"
          }
        />
        <Stat
          label="Körperfett"
          value={
            data.measurements.find((m: any) => m.body_fat_pct != null)
              ?.body_fat_pct ?? "—"
          }
          unit="%"
        />
        <Stat
          label="Größe"
          value={profile.height_cm ? fmt(profile.height_cm, 1) : "—"}
          unit="cm"
        />
        <Stat
          label="Alter"
          value={
            profile.birth_date
              ? differenceInYears(new Date(), parseISO(profile.birth_date))
              : "—"
          }
          unit="Jahre"
        />
      </div>
      <div className="body-layout">
        <section>
          <div className="card">
            <SectionTitle
              title="Dein Gewichtsverlauf"
              label="MESSWERTE"
              action={<Weight size={20} className="muted" />}
            />
            {weights.length > 1 ? (
              <WeightChart rows={weights} />
            ) : (
              <Empty>Mit zwei Gewichtsmessungen entsteht dein Verlauf.</Empty>
            )}
          </div>
          <section className="card">
            <SectionTitle
              title="Deine Ziele"
              action={
                <button
                  className="icon-btn"
                  aria-label="Ziel hinzufügen"
                  onClick={() => setGoal(true)}
                >
                  <Plus size={19} />
                </button>
              }
            />
            {data.goals.length ? (
              data.goals.map((g: any) => {
                const actual = data.measurements.find(
                  (m: any) => m[g.metric] != null,
                )?.[g.metric];
                const start = g.start_value;
                const total = num(g.target_value) - num(start);
                const progress =
                  actual != null && start != null && total !== 0
                    ? Math.max(
                        0,
                        Math.min(
                          100,
                          ((num(actual) - num(start)) / total) * 100,
                        ),
                      )
                    : 0;
                return (
                  <div className="goal-row" key={g.id}>
                    <span className="list-icon">
                      <Target size={18} />
                    </span>
                    <div>
                      <b>
                        {fields.find(([k]) => k === g.metric)?.[1] || g.metric}
                      </b>
                      <p>
                        {actual != null ? fmt(actual, 1) : "—"} →{" "}
                        {fmt(g.target_value, 1)}
                        {g.target_date
                          ? ` · bis ${parseISO(g.target_date).toLocaleDateString("de-DE")}`
                          : ""}
                      </p>
                      <Progress value={progress} />
                    </div>
                    <ActionButton
                      className="icon-btn subtle-danger"
                      action={() => archiveMeasurementGoal(g.id)}
                      message="Ziel archiviert."
                    >
                      <Trash2 size={15} />
                      <span className="sr-only">Ziel archivieren</span>
                    </ActionButton>
                  </div>
                );
              })
            ) : (
              <Empty
                action={
                  <button
                    className="btn btn-secondary"
                    onClick={() => setGoal(true)}
                  >
                    <Target size={16} /> Ziel festlegen
                  </button>
                }
              >
                Was möchtest du erreichen?
              </Empty>
            )}
          </section>
          <section className="card">
            <SectionTitle title="Messungen" />
            {data.measurements.length ? (
              data.measurements.map((m: any) => (
                <details className="history-item" key={m.id}>
                  <summary>
                    <span className="list-icon">
                      <Ruler size={17} />
                    </span>
                    <span>
                      <b>
                        {parseISO(m.measured_at).toLocaleDateString("de-DE", {
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        })}
                      </b>
                      <small>{m.notes || "Körpermessung"}</small>
                    </span>
                    <strong>
                      {m.weight_kg ? `${fmt(m.weight_kg, 1)} kg` : ""}
                    </strong>
                    <ChevronRight size={16} />
                  </summary>
                  <div className="measurement-values">
                    {fields
                      .filter(([k]) => m[k] != null)
                      .map(([k, l]) => (
                        <div key={k}>
                          <span>{l}</span>
                          <b>{fmt(m[k], 1)}</b>
                        </div>
                      ))}
                  </div>
                  <button
                    className="btn btn-secondary btn-small"
                    onClick={() => setEditing(m)}
                  >
                    Bearbeiten
                  </button>
                </details>
              ))
            ) : (
              <Empty>Noch keine Messungen.</Empty>
            )}
          </section>
        </section>
        <aside>
          <div className="card body-map-card">
            <span className="eyebrow">DEINE MASSE</span>
            <h2>Alles im Blick.</h2>
            <BodyMap />
            <div className="body-values">
              {[
                [
                  "Brust",
                  data.measurements.find((m: any) => m.chest_cm != null)
                    ?.chest_cm,
                ],
                [
                  "Taille",
                  data.measurements.find((m: any) => m.waist_cm != null)
                    ?.waist_cm,
                ],
                [
                  "Hüfte",
                  data.measurements.find((m: any) => m.hips_cm != null)
                    ?.hips_cm,
                ],
              ].map(([l, v]) => (
                <div key={String(l)}>
                  <span>{l}</span>
                  <b>{v != null ? `${fmt(v, 1)} cm` : "—"}</b>
                </div>
              ))}
            </div>
            <button
              className="btn btn-secondary full"
              onClick={() => setEditing({})}
            >
              <Plus size={16} /> Umfänge erfassen
            </button>
          </div>
          <Link href="/account" className="card profile-shortcut">
            <span className="list-icon">
              <Heart size={18} />
            </span>
            <div>
              <b>Dein Profil</b>
              <small>Größe, Alter und Ziel anpassen</small>
            </div>
            <ArrowRight size={17} />
          </Link>
        </aside>
      </div>
      {editing && (
        <MeasurementEditor
          item={editing}
          date={today()}
          onClose={() => setEditing(null)}
        />
      )}
      {goal && (
        <GoalEditor
          measurements={data.measurements}
          onClose={() => setGoal(false)}
        />
      )}
    </>
  );
}
export function MeasurementEditor({
  item,
  date,
  onClose,
}: {
  item?: any;
  date: string;
  onClose: () => void;
}) {
  const { run, notify } = useFeedback();
  const [busy, setBusy] = useState(false);
  const field = (config: (typeof fields)[number]) => (
    <NumberField
      key={config[0]}
      name={config[0]}
      label={config[1]}
      min={config[2]}
      max={config[3]}
      defaultValue={item?.[config[0]] ?? ""}
    />
  );
  return (
    <Modal
      title={item?.id ? "Messung bearbeiten" : "Messung erfassen"}
      onClose={onClose}
    >
      <form
        className="form-stack"
        onSubmit={async (e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          const values = Object.fromEntries(
            fields.map(([k]) => [k, f.get(k) === "" ? null : Number(f.get(k))]),
          );
          if (Object.values(values).every((v) => v === null)) {
            notify("Bitte mindestens einen Messwert eintragen.");
            return;
          }
          setBusy(true);
          const payload = {
            ...values,
            measured_at: String(f.get("date")),
            notes: String(f.get("notes")) || null,
          };
          const ok = await run(
            () =>
              item?.id
                ? updateMeasurement(item.id, payload)
                : saveMeasurement(payload),
            "Messung gespeichert.",
          );
          setBusy(false);
          if (ok) onClose();
        }}
      >
        <label>
          Datum
          <input
            type="date"
            name="date"
            defaultValue={item?.measured_at || date}
            required
          />
        </label>
        <div className="form-grid">{fields.slice(0, 3).map(field)}</div>
        <details open={Boolean(item?.id)}>
          <summary>Weitere Umfänge</summary>
          <div className="form-grid">{fields.slice(3).map(field)}</div>
        </details>
        <label>
          Notiz
          <textarea
            name="notes"
            defaultValue={item?.notes || ""}
            maxLength={2000}
          />
        </label>
        <button className="btn btn-primary" disabled={busy}>
          Speichern
        </button>
      </form>
    </Modal>
  );
}
function GoalEditor({
  measurements,
  onClose,
}: {
  measurements: any[];
  onClose: () => void;
}) {
  const { run } = useFeedback();
  const [busy, setBusy] = useState(false);
  return (
    <Modal title="Dein nächstes Ziel" onClose={onClose}>
      <form
        className="form-stack"
        onSubmit={async (e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          const metric = String(f.get("metric"));
          setBusy(true);
          const ok = await run(
            () =>
              saveMeasurementGoal({
                metric,
                start_value:
                  measurements.find((m) => m[metric] != null)?.[metric] ?? null,
                target_value: Number(f.get("value")),
                starts_on: today(),
                target_date: String(f.get("date")) || null,
                milestones: [],
              }),
            "Ziel gespeichert.",
          );
          setBusy(false);
          if (ok) onClose();
        }}
      >
        <label>
          Messwert
          <select name="metric">
            {fields.map(([k, l]) => (
              <option value={k} key={k}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <NumberField name="value" label="Zielwert" min={1} required />
        <label>
          Zieldatum · optional
          <input name="date" type="date" min={today()} />
        </label>
        <button className="btn btn-primary" disabled={busy}>
          Ziel speichern
        </button>
      </form>
    </Modal>
  );
}
function BodyMap() {
  return (
    <svg
      className="body-map"
      viewBox="0 0 200 290"
      fill="none"
      aria-label="Schematische Körperansicht"
    >
      <circle cx="100" cy="27" r="18" />
      <path d="m87 46-3 16-27 10-20 69 10 7 25-55 4 65-6 96 15 3 15-82 15 82 15-3-6-96 4-65 25 55 10-7-20-69-27-10-3-16" />
      <path d="M72 92h56M76 132h48M75 160h50" strokeDasharray="3 5" />
      <circle cx="128" cy="92" r="4" className="measure-dot" />
      <circle cx="124" cy="132" r="4" className="measure-dot" />
      <circle cx="125" cy="160" r="4" className="measure-dot" />
    </svg>
  );
}
function WeightChart({ rows }: { rows: any[] }) {
  return (
    <div className="chart">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={rows.map((r) => ({
            ...r,
            label: parseISO(r.measured_at).toLocaleDateString("de-DE", {
              day: "numeric",
              month: "short",
            }),
          }))}
        >
          <defs>
            <linearGradient id="weight-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#427858" stopOpacity={0.2} />
              <stop offset="1" stopColor="#427858" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="#e5ebe5" />
          <XAxis
            dataKey="label"
            axisLine={false}
            tickLine={false}
            minTickGap={35}
            tick={{ fontSize: 11, fill: "#65746b" }}
          />
          <YAxis
            domain={["dataMin - 1", "dataMax + 1"]}
            axisLine={false}
            tickLine={false}
            width={38}
            tick={{ fontSize: 11, fill: "#65746b" }}
          />
          <Tooltip formatter={(v) => [`${v} kg`, "Gewicht"]} />
          <Area
            isAnimationActive={false}
            type="monotone"
            dataKey="weight_kg"
            stroke="#255d3d"
            strokeWidth={2.5}
            fill="url(#weight-fill)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
export function InsightsPage({ data }: { data: any }) {
  const complete = data.sessions.filter((s: any) => s.finished_at);
  const meals = data.meals.filter(
    (m: any) => !m.is_planned && m.review_status === "approved",
  );
  const days = eachDayOfInterval({
    start: parseISO(data.from),
    end: parseISO(data.to),
  }).map((date) => {
    const key = format(date, "yyyy-MM-dd");
    const entries = meals.filter((m: any) => m.entry_date === key);
    const sessions = complete.filter(
      (s: any) => s.started_at.slice(0, 10) === key,
    );
    const target = data.targets
      .filter((t: any) => t.effective_from <= key)
      .at(-1);
    return {
      date: key,
      label: date.toLocaleDateString("de-DE", {
        day: "numeric",
        month: "short",
      }),
      kcal: entries.length
        ? entries.reduce((sum: number, m: any) => sum + num(m.kcal), 0)
        : null,
      target: target?.kcal ?? null,
      volume: sessions.length
        ? sessions.reduce((sum: number, s: any) => sum + num(s.total_volume), 0)
        : null,
    };
  });
  const logged = days.filter((d) => d.kcal !== null);
  const average = logged.length
    ? logged.reduce((sum, d) => sum + num(d.kcal), 0) / logged.length
    : null;
  const sleep = data.journal.filter((j: any) => j.sleep_hours != null);
  const mood = data.journal.filter((j: any) => j.mood != null);
  const energy = data.journal.filter((j: any) => j.energy != null);
  const measurementWeights = data.measurements.filter(
    (m: any) => m.weight_kg != null,
  );
  const range =
    measurementWeights.length > 1
      ? num(measurementWeights.at(-1).weight_kg) -
        num(measurementWeights[0].weight_kg)
      : null;
  const todayDate = parseISO(data.to);
  return (
    <>
      <PageHeading
        eyebrow="DEINE DATEN. DEIN FORTSCHRITT."
        title="Dein Fortschritt."
        action={
          <div className="period-tabs">
            {[7, 30, 90].map((n) => (
              <Link
                key={n}
                href={`/insights?from=${format(subDays(todayDate, n - 1), "yyyy-MM-dd")}&to=${data.to}`}
                className={days.length === n ? "selected" : ""}
              >
                {n} Tage
              </Link>
            ))}
          </div>
        }
      />
      <form className="range-form">
        <label>
          Von
          <input name="from" type="date" defaultValue={data.from} required />
        </label>
        <label>
          Bis
          <input name="to" type="date" defaultValue={data.to} required />
        </label>
        <button className="btn btn-secondary btn-small">Anzeigen</button>
      </form>
      <div className="stats-grid four">
        <Stat
          label="Trainings"
          value={complete.length}
          detail={`${fmt(complete.reduce((sum: number, s: any) => sum + num(s.duration_seconds), 0) / 60)} Minuten insgesamt`}
        />
        <Stat
          label="Ø Energiezufuhr"
          value={average === null ? "—" : fmt(average)}
          unit="kcal"
          detail={`${logged.length} Tage mit Einträgen`}
        />
        <Stat
          label="Trainingsvolumen"
          value={fmt(
            complete.reduce(
              (sum: number, s: any) => sum + num(s.total_volume),
              0,
            ),
          )}
          unit="kg"
        />
        <Stat
          label="Gewichtsänderung"
          value={
            range === null ? "—" : `${range > 0 ? "+" : ""}${fmt(range, 1)}`
          }
          unit="kg"
          detail="Im gewählten Zeitraum"
        />
      </div>
      <section className="card activity-card">
        <SectionTitle
          title="Dranbleiben zählt."
          label="TRAININGSAKTIVITÄT"
          action={<span className="pill neutral">{data.to.slice(0, 4)}</span>}
        />
        <ActivityGrid
          sessions={data.yearSessions || []}
          year={Number(data.to.slice(0, 4))}
        />
      </section>
      <div className="insights-grid">
        <section className="card">
          <SectionTitle title="Energie & Tagesziel" label="ERNÄHRUNG" />
          {logged.length ? (
            <TrendChart rows={days} kind="kcal" />
          ) : (
            <Empty>Erfasse Mahlzeiten, um deinen Verlauf zu sehen.</Empty>
          )}
        </section>
        <section className="card">
          <SectionTitle title="Deine Trainingsbelastung" label="TRAINING" />
          {complete.length ? (
            <TrendChart rows={days} kind="volume" />
          ) : (
            <Empty>
              Dein erstes abgeschlossenes Training startet den Verlauf.
            </Empty>
          )}
        </section>
        <section className="card">
          <SectionTitle title="Dein Körper verändert sich" label="BODY" />
          {measurementWeights.length > 1 ? (
            <WeightChart rows={measurementWeights} />
          ) : (
            <Empty>Mindestens zwei Gewichtsmessungen im Zeitraum nötig.</Empty>
          )}
        </section>
        <section className="card wellbeing-insights">
          <SectionTitle title="Wie es dir geht" label="WOHLBEFINDEN" />
          <div className="wellbeing-stats">
            <Stat
              label="Ø Schlaf"
              value={
                sleep.length
                  ? fmt(
                      sleep.reduce(
                        (s: number, j: any) => s + num(j.sleep_hours),
                        0,
                      ) / sleep.length,
                      1,
                    )
                  : "—"
              }
              unit="h"
            />
            <Stat
              label="Ø Stimmung"
              value={
                mood.length
                  ? fmt(
                      mood.reduce((s: number, j: any) => s + num(j.mood), 0) /
                        mood.length,
                      1,
                    )
                  : "—"
              }
              unit="/ 5"
            />
            <Stat
              label="Ø Energie"
              value={
                energy.length
                  ? fmt(
                      energy.reduce(
                        (s: number, j: any) => s + num(j.energy),
                        0,
                      ) / energy.length,
                      1,
                    )
                  : "—"
              }
              unit="/ 5"
            />
            <Stat
              label="Wasser erfasst"
              value={fmt(
                data.water.reduce(
                  (s: number, w: any) => s + num(w.amount_ml),
                  0,
                ) / 1000,
                1,
              )}
              unit="L"
            />
          </div>
          <Link href="/" className="text-btn">
            Zum täglichen Check-in <ArrowRight size={14} />
          </Link>
        </section>
      </div>
    </>
  );
}
function TrendChart({ rows, kind }: { rows: any[]; kind: "kcal" | "volume" }) {
  return (
    <div className="chart">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={rows}>
          <CartesianGrid stroke="#e5ebe5" vertical={false} />
          <XAxis
            dataKey="label"
            minTickGap={35}
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 10, fill: "#65746b" }}
          />
          <YAxis
            width={42}
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 10, fill: "#65746b" }}
          />
          <Tooltip />
          <Bar
            isAnimationActive={false}
            name={kind === "kcal" ? "Gegessen · kcal" : "Volumen · kg"}
            dataKey={kind}
            fill="#427858"
            radius={[4, 4, 0, 0]}
            maxBarSize={25}
          />
          {kind === "kcal" && (
            <Line
              isAnimationActive={false}
              name="Tagesziel · kcal"
              dataKey="target"
              stroke="#b6a57c"
              strokeDasharray="4 4"
              dot={false}
              strokeWidth={2}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
function ActivityGrid({ sessions, year }: { sessions: any[]; year: number }) {
  const first = new Date(year, 0, 1);
  const start = startOfWeek(first, { weekStartsOn: 1 });
  const end = new Date(year, 11, 31);
  const days = eachDayOfInterval({ start, end });
  const count = (date: string) =>
    sessions.filter((s) => s.finished_at && s.started_at.slice(0, 10) === date)
      .length;
  return (
    <>
      <div className="activity-scroll">
        <div className="activity-weekdays">
          <span>Mo</span>
          <span>Mi</span>
          <span>Fr</span>
        </div>
        <div className="activity-grid">
          {days.map((d) => {
            const key = format(d, "yyyy-MM-dd");
            const n = count(key);
            return (
              <div
                key={key}
                className={`activity-cell level-${Math.min(n, 3)} ${d.getFullYear() !== year || key > today() ? "outside" : ""}`}
                title={`${d.toLocaleDateString("de-DE")}: ${n} Trainings`}
                aria-label={`${d.toLocaleDateString("de-DE")}: ${n} Trainings`}
              />
            );
          })}
        </div>
      </div>
      <div className="activity-footer">
        <span>
          {sessions.filter((s) => s.finished_at).length} abgeschlossene
          Trainings in {year}
        </span>
        <span>
          Weniger <i className="level-0" />
          <i className="level-1" />
          <i className="level-2" />
          <i className="level-3" /> Mehr
        </span>
      </div>
    </>
  );
}
