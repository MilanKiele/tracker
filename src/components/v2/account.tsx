"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  Check,
  Download,
  Leaf,
  LogOut,
  Smartphone,
  Trash2,
} from "lucide-react";
import {
  exportMyData,
  logout,
  markNotificationRead,
  removePushSubscription,
  saveNotificationSettings,
  saveProfile,
  savePushSubscription,
} from "@/app/actions";
import { PageHeading } from "@/components/app-shell";
import { ActionButton, Empty, fmt, SectionTitle, useFeedback } from "./ui";

export function AccountPage({ data }: { data: any }) {
  const { context, targets, settings, subscriptions, events } = data;
  return (
    <>
      <PageHeading
        eyebrow="DEIN BEREICH"
        title="Dein Konto."
        subtitle={context.user?.email}
      />
      <div className="account-layout">
        <section>
          <section className="card">
            <SectionTitle title="Über dich" />
            <ProfileForm profile={context.profile} />
          </section>
          <section className="card" id="notifications">
            <SectionTitle
              title="Benachrichtigungen"
              action={<Bell size={18} />}
            />
            <PushSettings settings={settings} subscriptions={subscriptions} />
          </section>
          <section className="card">
            <SectionTitle title="Letzte Erinnerungen" />
            {events.length ? (
              events.map((event: any) => (
                <div className="notification-row" key={event.id}>
                  <div>
                    <b>{event.title}</b>
                    <p>{event.body}</p>
                    <small>
                      {new Date(event.created_at).toLocaleString("de-DE")}
                    </small>
                  </div>
                  {!event.read_at && (
                    <ActionButton
                      className="icon-btn"
                      action={() => markNotificationRead(event.id)}
                    >
                      <Check size={17} />
                      <span className="sr-only">Als gelesen markieren</span>
                    </ActionButton>
                  )}
                </div>
              ))
            ) : (
              <Empty>Hier erscheinen deine Erinnerungen.</Empty>
            )}
          </section>
        </section>
        <aside>
          <div className="card">
            <SectionTitle title="Tagesziele" />
            {targets.length ? (
              targets.slice(0, 5).map((target: any) => (
                <div className="target-history" key={target.id}>
                  <b>{fmt(target.kcal)} kcal</b>
                  <small>
                    {target.effective_from} ·{" "}
                    {target.is_manual ? "Manuell" : "Profil-Schätzung"}
                  </small>
                  <p>
                    P {fmt(target.protein_g)} · KH {fmt(target.carbs_g)} · F{" "}
                    {fmt(target.fat_g)} g
                  </p>
                </div>
              ))
            ) : (
              <Empty>Profil ausfüllen oder Ziele in Nutrition setzen.</Empty>
            )}
          </div>
          <section className="card">
            <SectionTitle title="Deine Daten" />
            <ActionButton
              className="btn btn-secondary full"
              action={async () => {
                const csv = await exportMyData();
                const url = URL.createObjectURL(
                  new Blob([csv], { type: "text/csv;charset=utf-8" }),
                );
                const a = document.createElement("a");
                a.href = url;
                a.download = "everwell-export.csv";
                a.click();
                setTimeout(() => URL.revokeObjectURL(url), 1000);
              }}
            >
              <Download size={16} /> Exportieren
            </ActionButton>
          </section>
          <form action={logout}>
            <button className="btn btn-secondary full">
              <LogOut size={16} /> Abmelden
            </button>
          </form>
        </aside>
      </div>
    </>
  );
}
export function ProfileForm({
  profile = {},
  onboarding = false,
}: {
  profile?: any;
  onboarding?: boolean;
}) {
  const { run } = useFeedback();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="form-stack"
      onSubmit={async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        setBusy(true);
        const ok = await run(
          () =>
            saveProfile({
              full_name: String(f.get("full_name")),
              sex: String(f.get("sex")),
              birth_date: String(f.get("birth_date")) || null,
              height_cm: Number(f.get("height_cm")),
              weight_kg: Number(f.get("weight_kg")),
              activity_level: String(f.get("activity_level")),
              goal: String(f.get("goal")),
              unit_system: "metric",
            }),
          "Profil gespeichert.",
        );
        setBusy(false);
        if (ok && onboarding) {
          router.push("/");
          router.refresh();
        }
      }}
    >
      <label>
        Name
        <input
          name="full_name"
          defaultValue={profile.full_name || ""}
          required
          minLength={2}
          maxLength={80}
          autoComplete="name"
        />
      </label>
      <div className="form-grid">
        <label>
          Geburtsdatum
          <input
            type="date"
            name="birth_date"
            defaultValue={profile.birth_date || ""}
            required
          />
        </label>
        <label>
          Geschlecht
          <select name="sex" defaultValue={profile.sex || "prefer_not_to_say"}>
            <option value="prefer_not_to_say">Keine Angabe</option>
            <option value="female">Weiblich</option>
            <option value="male">Männlich</option>
            <option value="intersex">Intersex</option>
          </select>
        </label>
        <label>
          Größe · cm
          <input
            type="number"
            name="height_cm"
            min="80"
            max="250"
            step=".1"
            defaultValue={profile.height_cm ?? ""}
            required
          />
        </label>
        <label>
          Gewicht · kg
          <input
            type="number"
            name="weight_kg"
            min="25"
            max="400"
            step=".1"
            defaultValue={profile.weight_kg ?? ""}
            required
          />
        </label>
        <label>
          Aktivität
          <select
            name="activity_level"
            defaultValue={profile.activity_level || "moderate"}
          >
            <option value="sedentary">Überwiegend sitzend</option>
            <option value="light">Leicht aktiv</option>
            <option value="moderate">Moderat aktiv</option>
            <option value="active">Sehr aktiv</option>
            <option value="very_active">Hoch aktiv</option>
          </select>
        </label>
        <label>
          Dein Ziel
          <select name="goal" defaultValue={profile.goal || "maintain"}>
            <option value="cut">Abnehmen</option>
            <option value="maintain">Gewicht halten</option>
            <option value="bulk">Aufbauen</option>
          </select>
        </label>
      </div>
      <small className="muted">
        Daraus berechnen wir ein geschätztes Tagesziel. In Nutrition kannst du
        es anpassen.
      </small>
      <button className="btn btn-primary" disabled={busy}>
        {busy ? "Speichert …" : onboarding ? "Los geht’s" : "Profil speichern"}
      </button>
    </form>
  );
}
export function OnboardingForm() {
  return <FeedbackShell />;
}
function FeedbackShell() {
  return (
    <main className="auth-page">
      <section className="auth-card">
        <div className="brand">
          <span className="brand-mark">
            <Leaf size={22} />
          </span>
          everwell.
        </div>
        <h1>Dein Startpunkt.</h1>
        <p className="muted">Ein paar Angaben. Dann geht’s los.</p>
        <ProfileForm onboarding />
      </section>
    </main>
  );
}
function PushSettings({
  settings,
  subscriptions,
}: {
  settings: any;
  subscriptions: any[];
}) {
  const [reminder, setReminder] = useState(Boolean(settings?.reminder_enabled));
  const [missed, setMissed] = useState(
    Boolean(settings?.missed_workout_enabled),
  );
  const { run, notify } = useFeedback();
  const [busy, setBusy] = useState(false);
  async function enable() {
    setBusy(true);
    await run(async () => {
      if (
        !("serviceWorker" in navigator) ||
        !("PushManager" in window) ||
        !("Notification" in window)
      )
        throw new Error(
          "Push wird hier nicht unterstützt. Auf dem iPhone die App zuerst zum Home-Bildschirm hinzufügen.",
        );
      const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!key)
        throw new Error("Push-Schlüssel fehlt in der Vercel-Konfiguration.");
      if ((await Notification.requestPermission()) !== "granted")
        throw new Error("Benachrichtigungen sind im Browser nicht erlaubt.");
      await navigator.serviceWorker.register("/sw.js");
      const registration = await navigator.serviceWorker.ready;
      const raw = atob(key.replace(/-/g, "+").replace(/_/g, "/"));
      const bytes = Uint8Array.from(raw, (c) => c.charCodeAt(0));
      const sub =
        (await registration.pushManager.getSubscription()) ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: bytes,
        }));
      const json = sub.toJSON();
      if (!json.endpoint || !json.keys)
        throw new Error("Push-Abonnement unvollständig.");
      await savePushSubscription({
        endpoint: json.endpoint,
        keys: json.keys,
        device_label: /Mobile/.test(navigator.userAgent)
          ? "Smartphone"
          : "Browser",
      });
      notify("Benachrichtigungen auf diesem Gerät aktiviert.");
    });
    setBusy(false);
  }
  return (
    <>
      <div className="toggle-row">
        <span>
          <b>Täglicher Check-in</b>
          <small>Einmal täglich · 07:00 UTC auf Vercel Hobby</small>
        </span>
        <input
          type="checkbox"
          aria-label="Täglicher Check-in"
          checked={reminder}
          onChange={(e) => setReminder(e.target.checked)}
        />
      </div>
      <div className="toggle-row">
        <span>
          <b>Training verpasst</b>
          <small>Erinnerung am nächsten täglichen Lauf</small>
        </span>
        <input
          type="checkbox"
          aria-label="Verpasstes Training"
          checked={missed}
          onChange={(e) => setMissed(e.target.checked)}
        />
      </div>
      <form
        className="form-stack"
        onSubmit={async (e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          await run(
            () =>
              saveNotificationSettings({
                push_enabled: subscriptions.length > 0,
                reminder_enabled: reminder,
                missed_workout_enabled: missed,
                reminder_time: settings?.reminder_time || "07:00",
                timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                quiet_hours_start: String(f.get("start")) || null,
                quiet_hours_end: String(f.get("end")) || null,
              }),
            "Einstellungen gespeichert.",
          );
        }}
      >
        <details>
          <summary>Ruhezeiten</summary>
          <div className="form-grid">
            <label>
              Von
              <input
                type="time"
                name="start"
                defaultValue={settings?.quiet_hours_start || ""}
              />
            </label>
            <label>
              Bis
              <input
                type="time"
                name="end"
                defaultValue={settings?.quiet_hours_end || ""}
              />
            </label>
          </div>
          <small className="muted">
            Liegt der tägliche Lauf in deiner Ruhezeit, entfällt die Erinnerung.
          </small>
        </details>
        <div className="inline-actions">
          <button className="btn btn-primary">Speichern</button>
          <button
            className="btn btn-secondary"
            type="button"
            onClick={enable}
            disabled={busy}
          >
            <Smartphone size={16} />
            {busy ? "Verbindet …" : "Gerät aktivieren"}
          </button>
        </div>
      </form>
      {subscriptions.map((s: any) => (
        <div className="device-row" key={s.id}>
          <Smartphone size={17} />
          <span>{s.device_label || "Gerät"}</span>
          <ActionButton
            className="icon-btn"
            action={() => removePushSubscription(s.id)}
            message="Gerät entfernt."
          >
            <Trash2 size={15} />
            <span className="sr-only">Gerät entfernen</span>
          </ActionButton>
        </div>
      ))}
    </>
  );
}
