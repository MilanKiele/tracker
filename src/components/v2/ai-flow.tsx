"use client";
/* eslint-disable @next/next/no-img-element */

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Camera,
  Check,
  Images,
  ImagePlus,
  LoaderCircle,
  MessagesSquare,
  Plus,
  Send,
  Sparkles,
  X,
} from "lucide-react";
import { applyAiAction, importFood, importPlan } from "@/app/ai-actions";
import {
  scaleFood,
  type AiResult,
  type FoodDraft,
  type PlanDraft,
} from "@/lib/ai/schema";
import { fmt, slots, useFeedback } from "./ui";

type Mode = "plan" | "food";
const AiContext = createContext<{
  openAi: (mode: Mode, date?: string) => void;
}>({ openAi: () => {} });
export const useAi = () => useContext(AiContext);
export function AiProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  return (
    <AiContext
      value={{
        openAi: (mode, date) =>
          router.push(`/assistant?mode=${mode}${date ? `&date=${date}` : ""}`),
      }}
    >
      {children}
    </AiContext>
  );
}

export async function resizePhoto(file: File): Promise<string> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type))
    throw new Error(
      "Bitte ein JPG-, PNG- oder WebP-Foto auswählen. HEIC vorher als JPG exportieren.",
    );
  if (file.size > 20000000)
    throw new Error("Bitte ein Foto unter 20 MB auswählen.");
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    const scale = Math.min(1, 1280 / Math.max(image.width, image.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(image.width * scale);
    canvas.height = Math.round(image.height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Foto konnte nicht vorbereitet werden.");
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    const result = canvas.toDataURL("image/jpeg", 0.8);
    if (result.length > 2800000)
      throw new Error(
        "Das Foto ist zu groß. Bitte ein kleineres Bild verwenden.",
      );
    return result;
  } finally {
    URL.revokeObjectURL(url);
  }
}

type Message = { role: "user" | "assistant"; content: string; display: string };
type Conversation = { id: string; title: string; mode: Mode; updated_at: string };
type SavedPhoto = { id: string; label: string; created_at: string; url: string };
type ChatNotification = { id: string; title: string; body: string; created_at: string; read_at: string | null };
export function AssistantWorkspace({
  initialMode,
  initialDate,
}: {
  initialMode: Mode;
  initialDate: string;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [activeMode, setActiveMode] = useState(initialMode);
  const [conversationId, setConversationId] = useState("");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [notifications, setNotifications] = useState<ChatNotification[]>([]);
  const [notificationSettings, setNotificationSettings] = useState<Record<string, unknown> | null>(null);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [savedPhotos, setSavedPhotos] = useState<SavedPhoto[]>([]);
  const [photosLoaded, setPhotosLoaded] = useState(false);
  const [showSavedPhotos, setShowSavedPhotos] = useState(false);
  const [loadingPhotos, setLoadingPhotos] = useState(false);
  const [savingPhoto, setSavingPhoto] = useState(false);
  const [deletingPhotoId, setDeletingPhotoId] = useState("");
  const [photoError, setPhotoError] = useState("");
  const [question, setQuestion] = useState("");
  const [image, setImage] = useState("");
  const [result, setResult] = useState<AiResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [date, setDate] = useState(initialDate);
  const [slot, setSlot] = useState("lunch");
  const [destination, setDestination] = useState("diary");
  const [portions, setPortions] = useState<number[]>([]);
  const [included, setIncluded] = useState<boolean[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const controller = useRef<AbortController | null>(null);
  const mutation = useRef("");
  const router = useRouter();
  const { notify } = useFeedback();
  useEffect(() => () => controller.current?.abort(), []);
  async function refreshConversations() {
    try {
      const response = await fetch("/api/assistant", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Verläufe nicht verfügbar.");
      setConversations(data.conversations ?? []);
      setNotifications(data.notifications ?? []);
      setNotificationSettings(data.settings ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Verläufe nicht verfügbar.");
    } finally {
      setLoadingConversations(false);
    }
  }
  useEffect(() => {
    void Promise.resolve().then(refreshConversations);
  }, []);
  function startNewConversation() {
    setConversationId("");
    setMessages([]);
    setResult(null);
    setImage("");
    setError("");
    setActiveMode(initialMode);
  }
  async function openConversation(conversation: Conversation) {
    setLoadingConversations(true);
    setError("");
    try {
      const response = await fetch(`/api/assistant?conversation_id=${conversation.id}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Gespräch konnte nicht geladen werden.");
      setConversationId(conversation.id);
      setActiveMode(data.conversation.mode);
      setMessages((data.messages ?? []).map((item: { role: Message["role"]; content: string }) => {
        let display = item.content;
        if (item.role === "assistant") {
          try { display = JSON.parse(item.content).message ?? item.content; } catch { /* older plain text */ }
        }
        return { role: item.role, content: item.content, display };
      }));
      setResult(null);
      setImage("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gespräch konnte nicht geladen werden.");
    } finally {
      setLoadingConversations(false);
    }
  }
  async function refreshPhotos() {
    setLoadingPhotos(true);
    setPhotoError("");
    try {
      const response = await fetch("/api/assistant/photos", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Fotoarchiv nicht verfügbar.");
      setSavedPhotos(data.photos ?? []);
      setPhotosLoaded(true);
    } catch (e) {
      setPhotoError(e instanceof Error ? e.message : "Fotoarchiv nicht verfügbar.");
    } finally {
      setLoadingPhotos(false);
    }
  }
  async function archivePhoto(imageData: string) {
    setSavingPhoto(true);
    setPhotoError("");
    try {
      const response = await fetch("/api/assistant/photos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image: imageData,
          label: `Essensfoto · ${new Date().toLocaleDateString("de-DE")}`,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Foto konnte nicht gespeichert werden.");
      if (data.photo?.url) {
        setSavedPhotos((items) => [data.photo, ...items.filter((item) => item.id !== data.photo.id)].slice(0, 24));
      }
    } catch (e) {
      setPhotoError(e instanceof Error ? e.message : "Foto konnte nicht gespeichert werden.");
    } finally {
      setSavingPhoto(false);
    }
  }
  async function selectSavedPhoto(photo: SavedPhoto) {
    setSavingPhoto(true);
    setPhotoError("");
    try {
      const response = await fetch(`/api/assistant/photos?id=${photo.id}`, { cache: "no-store" });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Foto konnte nicht geladen werden.");
      }
      const blob = await response.blob();
      setImage(await resizePhoto(new File([blob], "essensfoto.jpg", { type: "image/jpeg" })));
      setShowSavedPhotos(false);
    } catch (e) {
      setPhotoError(e instanceof Error ? e.message : "Foto konnte nicht geladen werden.");
    } finally {
      setSavingPhoto(false);
    }
  }
  async function removeSavedPhoto(id: string) {
    setDeletingPhotoId(id);
    setPhotoError("");
    try {
      const response = await fetch(`/api/assistant/photos?id=${id}`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Foto konnte nicht gelöscht werden.");
      setSavedPhotos((items) => items.filter((item) => item.id !== id));
    } catch (e) {
      setPhotoError(e instanceof Error ? e.message : "Foto konnte nicht gelöscht werden.");
    } finally {
      setDeletingPhotoId("");
    }
  }
  async function ask(history: Message[]) {
    setBusy(true);
    setError("");
    controller.current = new AbortController();
    try {
      const response = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: activeMode,
          conversation_id: conversationId || undefined,
          context_date: date,
          messages: history
            .slice(-10)
            .map(({ role, content }) => ({ role, content })),
          image: image || undefined,
        }),
        signal: controller.current.signal,
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "Die KI ist gerade nicht erreichbar.");
      const next = data.result as AiResult;
      if (data.conversation_id) setConversationId(data.conversation_id);
      setResult(next);
      mutation.current = crypto.randomUUID();
      setMessages([
        ...history,
        {
          role: "assistant",
          content: JSON.stringify(next),
          display: next.message,
        },
      ]);
      if (next.kind === "food") {
        setPortions(next.foods.map(() => 1));
        setIncluded(next.foods.map(() => true));
      }
      void refreshConversations();
    } catch (e) {
      if (!(e instanceof Error && e.name === "AbortError"))
        setError(e instanceof Error ? e.message : "Verbindung fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  }
  async function photo(file?: File) {
    if (!file) return;
    try {
      const imageData = await resizePhoto(file);
      setImage(imageData);
      setError("");
      void archivePhoto(imageData);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Foto nicht lesbar.");
    }
  }
  async function save() {
    if (!result) return;
    setSaving(true);
    setError("");
    try {
      if (result.kind === "plan") {
        await importPlan({
          mutation_id: mutation.current,
          plan: result.plan,
        });
        notify("Plan gespeichert. Du kannst ihn unter Training öffnen.");
      }
      if (result.kind === "food") {
        const foods = result.foods
          .filter((_, i) => included[i])
          .map((food) => {
            const index = result.foods.indexOf(food);
            const factor = portions[index];
            return scaleFood(food, factor);
          });
        if (!foods.length)
          throw new Error("Bitte mindestens eine Speise auswählen.");
        await importFood({
          mutation_id: mutation.current,
          foods,
          date,
          slot,
          destination,
        });
        notify(
          destination === "library"
            ? "In deiner Speiseauswahl gespeichert."
            : destination === "calendar"
              ? "Im Kalender geplant."
              : "Zu deinem Tagesbedarf hinzugefügt.",
        );
      }
      if (result.kind === "action") {
        await applyAiAction(result.action);
        notify("Änderung übernommen.");
      }
      setResult(null);
      router.refresh();
    } catch (e) {
      setError(
        e instanceof Error && e.name === "ZodError"
          ? "Bitte die Portion und ihre Nährwerte prüfen."
          : e instanceof Error
            ? e.message
            : "Speichern fehlgeschlagen.",
      );
    } finally {
      setSaving(false);
    }
  }
  return (
    <div className="assistant-workspace">
      <aside className="assistant-chat-sidebar">
        <div className="assistant-chat-sidebar-head">
          <b>Deine Chats</b>
          <button type="button" className="icon-btn" aria-label="Neuer Chat" onClick={startNewConversation}>
            <Plus size={17} />
          </button>
        </div>
        <button type="button" className="btn btn-secondary full assistant-new-chat" onClick={startNewConversation}>
          <Plus size={16} /> Neuer Chat
        </button>
        <div className="assistant-chat-list" aria-label="Gespeicherte Gespräche">
          {loadingConversations && <small>Chats werden geladen …</small>}
          {!loadingConversations && !conversations.length && <small>Noch keine Chats. Starte dein erstes Gespräch.</small>}
          {conversations.map((conversation) => (
            <button type="button" key={conversation.id} className={`assistant-chat-item ${conversationId === conversation.id ? "active" : ""}`} onClick={() => void openConversation(conversation)}>
              <MessagesSquare size={15} />
              <span><b>{conversation.title}</b><small>{conversation.mode === "plan" ? "Training" : "Everwell"} · {new Date(conversation.updated_at).toLocaleDateString("de-DE")}</small></span>
            </button>
          ))}
        </div>
      </aside>
      <section className="assistant-thread">
        <header className="assistant-thread-head">
          <div><span className="ai-mark"><Sparkles size={18} /></span><span><b>Everwell Assistent</b><small>Dein Training, Essen und Körper in einem Chat</small></span></div>
        </header>
        <div className="assistant-thread-body">
      {!!notifications.length && (
        <section className="chat-notifications" aria-label="Benachrichtigungen">
          <div><b>Benachrichtigungen</b><small>{notifications.filter((n) => !n.read_at).length} ungelesen</small></div>
          {notifications.slice(0, 4).map((item) => (
            <button key={item.id} className={item.read_at ? "read" : "unread"} onClick={() => setQuestion(`Markiere die Benachrichtigung mit ID ${item.id} als gelesen.`)}>
              <b>{item.title}</b><span>{item.body}</span>
            </button>
          ))}
          <small>Push {notificationSettings?.push_enabled ? "aktiviert" : "nicht aktiviert"} · Erinnerungen {notificationSettings?.reminder_enabled ? "an" : "aus"}</small>
        </section>
      )}
      {messages.length === 0 && (
        <div className="prompt-chips">
          {[
            "Was steht heute an?",
            "Erstelle einen Trainingsplan für 3 Tage",
            "Trage mein Gewicht von heute ein",
            "Füge mein Mittagessen hinzu",
            "Wie läuft meine Woche?",
          ].map((text) => (
            <button key={text} onClick={() => setQuestion(text)}>
              {text}
            </button>
          ))}
        </div>
      )}
      <div className="chat-history">
        {messages.map((message, i) => (
          <div className={`chat-message ${message.role}`} key={i}>
            {message.role === "assistant" && <Sparkles size={14} />}
            <p>{message.display}</p>
          </div>
        ))}
      </div>
      {result?.kind === "plan" && (
        <PlanPreview
          plan={result.plan}
          onChange={(plan) => setResult({ ...result, plan })}
        />
      )}
      {result?.kind === "food" && (
        <div className="food-results">
          <div className="result-label">
            <span className="pill">
              <Sparkles size={12} /> KI-Schätzung
            </span>
            <small>Ganze Portion vorausgewählt</small>
          </div>
          {result.foods.map((food, index) => (
            <FoodPreview
              key={index}
              food={food}
              included={included[index]}
              portion={portions[index] ?? 1}
              onInclude={(value) =>
                setIncluded((items) =>
                  items.map((item, i) => (i === index ? value : item)),
                )
              }
              onPortion={(value) =>
                setPortions((items) =>
                  items.map((item, i) => (i === index ? value : item)),
                )
              }
              onChange={(value) =>
                setResult({
                  ...result,
                  foods: result.foods.map((item, i) =>
                    i === index ? value : item,
                  ),
                })
              }
            />
          ))}
        </div>
      )}
      {result?.kind === "action" && (
        <div className="action-proposal">
          <b>Vorschlag zur Bestätigung</b>
          <pre>{JSON.stringify(result.action, null, 2)}</pre>
        </div>
      )}
      {result && result.kind !== "message" && (
        <div className="save-proposal">
          {result.kind === "food" && (
            <div className="form-grid">
              <label>
                Hinzufügen zu
                <select
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                >
                  <option value="diary">Tagesbedarf</option>
                  <option value="calendar">Kalender · geplant</option>
                  <option value="library">Nur Speiseauswahl</option>
                </select>
              </label>
              {destination !== "library" && (
                <>
                  <label>
                    Datum
                    <input
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      required
                    />
                  </label>
                  <label>
                    Mahlzeit
                    <select
                      value={slot}
                      onChange={(e) => setSlot(e.target.value)}
                    >
                      {Object.entries(slots).map(([key, label]) => (
                        <option value={key} key={key}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </label>
                </>
              )}
            </div>
          )}
          <button
            className="btn btn-primary full"
            disabled={busy || saving}
            onClick={save}
          >
            {saving ? (
              <LoaderCircle size={17} className="spin" />
            ) : (
              <Check size={17} />
            )}{" "}
            {result.kind === "plan" ? "Plan übernehmen" : "Hinzufügen"}
          </button>
        </div>
      )}
      {error && (
        <div className="error-box" role="alert">
          {error}
          {messages.at(-1)?.role === "user" && (
            <button
              className="text-btn"
              disabled={busy}
              onClick={() => ask(messages)}
            >
              Erneut versuchen
            </button>
          )}
        </div>
      )}
      <form
        className="ai-composer"
        onSubmit={(event) => {
          event.preventDefault();
          const text =
            question.trim() ||
            (image
              ? "Erkenne das Essen auf diesem Foto und analysiere die ganze sichtbare Portion."
              : "");
          if (!text) return;
          const history = [
            ...messages,
            {
              role: "user" as const,
              content: text,
              display: question.trim() || "Foto analysieren",
            },
          ];
          setMessages(history);
          setQuestion("");
          void ask(history);
        }}
      >
        {image && (
          <div className="photo-preview">
            <img src={image} alt="Ausgewähltes Essensfoto" />
            <button
              type="button"
              className="icon-btn"
              aria-label="Foto entfernen"
              onClick={() => setImage("")}
            >
              <X size={15} />
            </button>
          </div>
        )}
        <>
            <input
              ref={cameraRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              capture="environment"
              hidden
              onChange={(e) => {
                void photo(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              hidden
              onChange={(e) => {
                void photo(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
            <div className="photo-actions">
              <button
                type="button"
                className="btn btn-secondary"
                disabled={busy}
                onClick={() => cameraRef.current?.click()}
              >
                <Camera size={17} /> Fotografieren
              </button>
              <button
                type="button"
                className="icon-btn"
                disabled={busy}
                aria-label="Foto aus Galerie wählen"
                onClick={() => fileRef.current?.click()}
              >
                <ImagePlus size={19} />
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-small"
                disabled={savingPhoto}
                onClick={() => {
                  const next = !showSavedPhotos;
                  setShowSavedPhotos(next);
                  if (next && !photosLoaded) void refreshPhotos();
                }}
              >
                <Images size={15} /> Mein Fotoarchiv{photosLoaded && savedPhotos.length ? ` · ${savedPhotos.length}` : ""}
              </button>
            </div>
            {savingPhoto && <small className="photo-status">Foto wird gespeichert oder geladen …</small>}
            {photoError && <div className="error-box" role="alert">{photoError}</div>}
            {showSavedPhotos && (
              <section className="saved-photo-library" aria-label="Gespeicherte Essensfotos">
                <div className="saved-photo-heading">
                  <b>Zuletzt verwendete Fotos</b>
                  <small>Antippen zum erneuten Analysieren</small>
                </div>
                {loadingPhotos && <small>Fotoarchiv wird geladen …</small>}
                {!loadingPhotos && savedPhotos.length === 0 && !photoError && (
                  <small>Deine ausgewählten Fotos erscheinen hier.</small>
                )}
                <div className="saved-photo-grid">
                  {savedPhotos.map((saved) => (
                    <div className="saved-photo-card" key={saved.id}>
                      <button type="button" onClick={() => void selectSavedPhoto(saved)} disabled={savingPhoto}>
                        <img src={saved.url} alt={saved.label} />
                        <span>{saved.label}</span>
                      </button>
                      <button
                        type="button"
                        className="saved-photo-delete"
                        aria-label={`${saved.label} löschen`}
                        disabled={deletingPhotoId === saved.id}
                        onClick={() => void removeSavedPhoto(saved.id)}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            )}
        </>
        <div className="composer-input">
          <textarea
            aria-label="Nachricht an KI"
            placeholder={
              "Was möchtest du heute ändern oder hinzufügen?"
            }
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            maxLength={2000}
            rows={2}
          />
          <button
            className="btn btn-primary"
            aria-label="Nachricht senden"
            disabled={busy || saving || (!question.trim() && !image)}
          >
            {busy ? (
              <LoaderCircle className="spin" size={18} />
            ) : (
              <Send size={18} />
            )}
          </button>
        </div>
        <small className="ai-privacy">
          Gespräche und Essensfotos bleiben in deinem privaten Konto. Fotos
          werden zur Analyse an OpenRouter gesendet.
        </small>
      </form>
        </div>
      </section>
    </div>
  );
}
function PlanPreview({
  plan,
  onChange,
}: {
  plan: PlanDraft;
  onChange: (plan: PlanDraft) => void;
}) {
  return (
    <div className="plan-preview">
      <label className="title-input">
        Planname
        <input
          value={plan.name}
          onChange={(e) => onChange({ ...plan, name: e.target.value })}
          maxLength={100}
        />
      </label>
      {plan.days.map((day, i) => (
        <details className="draft-day" key={i} open={i === 0}>
          <summary>
            <span>
              <b>{day.name}</b>
              <small>
                {
                  [
                    "Montag",
                    "Dienstag",
                    "Mittwoch",
                    "Donnerstag",
                    "Freitag",
                    "Samstag",
                    "Sonntag",
                  ][day.weekday]
                }{" "}
                · {day.exercises.length} Übungen
              </small>
            </span>
            <span>Bearbeiten</span>
          </summary>
          <div className="form-grid">
            <label>
              Name
              <input
                value={day.name}
                maxLength={80}
                onChange={(e) =>
                  onChange({
                    ...plan,
                    days: plan.days.map((d, j) =>
                      j === i ? { ...d, name: e.target.value } : d,
                    ),
                  })
                }
              />
            </label>
            <label>
              Wochentag
              <select
                value={day.weekday}
                onChange={(e) =>
                  onChange({
                    ...plan,
                    days: plan.days.map((d, j) =>
                      j === i ? { ...d, weekday: Number(e.target.value) } : d,
                    ),
                  })
                }
              >
                {[
                  "Montag",
                  "Dienstag",
                  "Mittwoch",
                  "Donnerstag",
                  "Freitag",
                  "Samstag",
                  "Sonntag",
                ].map((name, dayIndex) => (
                  <option key={name} value={dayIndex}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {day.exercises.map((exercise, j) => (
            <div className="draft-exercise" key={j}>
              <label>
                Übung
                <input
                  value={exercise.name}
                  onChange={(e) =>
                    onChange({
                      ...plan,
                      days: plan.days.map((d, di) =>
                        di === i
                          ? {
                              ...d,
                              exercises: d.exercises.map((ex, ei) =>
                                ei === j ? { ...ex, name: e.target.value } : ex,
                              ),
                            }
                          : d,
                      ),
                    })
                  }
                />
              </label>
              <div className="form-grid three">
                {(
                  [
                    ["sets", "Sätze"],
                    [
                      exercise.duration_seconds ? "duration_seconds" : "reps",
                      exercise.duration_seconds ? "Sekunden" : "Wdh.",
                    ],
                    ["rest_seconds", "Pause (s)"],
                  ] as const
                ).map(([key, label]) => (
                  <label key={key}>
                    {label}
                    <input
                      type="number"
                      min={key === "rest_seconds" ? 0 : 1}
                      value={exercise[key] ?? 0}
                      onChange={(e) =>
                        onChange({
                          ...plan,
                          days: plan.days.map((d, di) =>
                            di === i
                              ? {
                                  ...d,
                                  exercises: d.exercises.map((ex, ei) =>
                                    ei === j
                                      ? { ...ex, [key]: Number(e.target.value) }
                                      : ex,
                                  ),
                                }
                              : d,
                          ),
                        })
                      }
                    />
                  </label>
                ))}
              </div>
            </div>
          ))}
        </details>
      ))}
    </div>
  );
}
function FoodPreview({
  food,
  onChange,
  portion,
  onPortion,
  included,
  onInclude,
}: {
  food: FoodDraft;
  onChange: (value: FoodDraft) => void;
  portion: number;
  onPortion: (value: number) => void;
  included: boolean;
  onInclude: (value: boolean) => void;
}) {
  return (
    <div className={`food-preview ${included ? "" : "excluded"}`}>
      <div className="food-preview-heading">
        <input
          type="checkbox"
          aria-label={`${food.name} hinzufügen`}
          checked={included ?? true}
          onChange={(e) => onInclude(e.target.checked)}
        />
        <input
          className="food-name-input"
          aria-label="Name der Speise"
          value={food.name}
          onChange={(e) => onChange({ ...food, name: e.target.value })}
        />
        <strong>
          {fmt(food.kcal * portion)} <small>kcal</small>
        </strong>
      </div>
      <div className="food-preview-macros">
        <span>{fmt(food.grams * portion)} g</span>
        <span>{fmt(food.protein_g * portion)} g Protein</span>
        <span>{fmt(food.carbs_g * portion)} g KH</span>
        <span>{fmt(food.fat_g * portion)} g Fett</span>
      </div>
      <div className="portion-control">
        <span>Portion</span>
        {[0.5, 1, 2].map((value) => (
          <button
            className={portion === value ? "selected" : ""}
            key={value}
            onClick={() => onPortion(value)}
          >
            {value === 0.5 ? "½" : value === 1 ? "Ganz" : "2×"}
          </button>
        ))}
        <input
          type="number"
          aria-label="Portionsfaktor"
          min=".05"
          max="10"
          step=".05"
          value={portion}
          onChange={(e) => onPortion(Number(e.target.value))}
        />
      </div>
      <details>
        <summary>
          Werte anpassen{food.confidence === "low" ? " · unsicher" : ""}
        </summary>
        <p className="muted">{food.notes}</p>
        <div className="form-grid three">
          {(
            [
              ["grams", "Gramm"],
              ["kcal", "kcal"],
              ["protein_g", "Protein g"],
              ["carbs_g", "KH g"],
              ["fat_g", "Fett g"],
              ["fiber_g", "Ballaststoffe g"],
              ["sugar_g", "Zucker g"],
              ["salt_g", "Salz g"],
            ] as const
          ).map(([key, label]) => (
            <label key={key}>
              {label}
              <input
                type="number"
                min="0"
                step=".1"
                value={food[key] ?? ""}
                onChange={(e) =>
                  onChange({ ...food, [key]: Number(e.target.value) })
                }
              />
            </label>
          ))}
        </div>
      </details>
    </div>
  );
}
