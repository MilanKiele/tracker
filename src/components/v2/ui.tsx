"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { Check, LoaderCircle, X } from "lucide-react";

const FeedbackContext = createContext<{
  notify: (message: string) => void;
  run: (action: () => Promise<unknown>, message?: string) => Promise<boolean>;
}>({ notify: () => {}, run: async () => false });
export function FeedbackProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function notify(message: string) {
    if (timer.current) clearTimeout(timer.current);
    setToast(message);
    timer.current = setTimeout(() => setToast(""), 6000);
  }
  async function run(action: () => Promise<unknown>, message?: string) {
    try {
      await action();
      if (message) notify(message);
      return true;
    } catch (error) {
      notify(
        error instanceof Error
          ? error.message
          : "Speichern nicht möglich. Bitte erneut versuchen.",
      );
      return false;
    }
  }
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  return (
    <FeedbackContext value={{ notify, run }}>
      {children}
      {toast && (
        <div className="toast" role="status">
          <Check size={17} />
          <span>{toast}</span>
          <button onClick={() => setToast("")} aria-label="Meldung schließen">
            <X size={16} />
          </button>
        </div>
      )}
    </FeedbackContext>
  );
}
export const useFeedback = () => useContext(FeedbackContext);
export function ActionButton({
  action,
  children,
  message,
  className = "btn",
  disabled = false,
}: {
  action: () => Promise<unknown>;
  children: React.ReactNode;
  message?: string;
  className?: string;
  disabled?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const { run } = useFeedback();
  return (
    <button
      type="button"
      className={className}
      disabled={busy || disabled}
      onClick={async () => {
        setBusy(true);
        await run(action, message);
        setBusy(false);
      }}
    >
      {busy ? <LoaderCircle size={16} className="spin" /> : null}
      {children}
    </button>
  );
}
export function Modal({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    const focused = document.activeElement as HTMLElement | null;
    dialog?.showModal();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      dialog?.close();
      document.body.style.overflow = overflow;
      focused?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={`dialog ${wide ? "dialog-wide" : ""}`}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      aria-label={title}
    >
      <div className="dialog-header">
        <h2>{title}</h2>
        <button className="icon-btn" onClick={onClose} aria-label="Schließen">
          <X size={20} />
        </button>
      </div>
      <div className="dialog-body">{children}</div>
    </dialog>
  );
}
export function Empty({
  children,
  action,
}: {
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="empty">
      <p>{children}</p>
      {action}
    </div>
  );
}
export function SectionTitle({
  title,
  action,
  label,
}: {
  title: string;
  action?: React.ReactNode;
  label?: string;
}) {
  return (
    <div className="section-heading">
      <div>
        {label && <span className="eyebrow">{label}</span>}
        <h2>{title}</h2>
      </div>
      {action}
    </div>
  );
}
export function Stat({
  label,
  value,
  unit,
  detail,
}: {
  label: string;
  value: React.ReactNode;
  unit?: string;
  detail?: React.ReactNode;
}) {
  return (
    <div className="stat">
      <span>{label}</span>
      <strong>
        {value}
        <small>{unit}</small>
      </strong>
      {detail && <small>{detail}</small>}
    </div>
  );
}
export function Progress({
  value,
  max = 100,
}: {
  value: number;
  max?: number;
}) {
  return (
    <div
      className="progress"
      role="progressbar"
      aria-valuenow={Math.min(max, Math.max(0, Math.round(value)))}
      aria-valuemax={max}
      aria-valuemin={0}
    >
      <i
        style={{
          width: `${Math.min(100, Math.max(0, (value / Math.max(max, 1)) * 100))}%`,
        }}
      />
    </div>
  );
}
export function NumberField({
  label,
  name,
  defaultValue,
  required = false,
  min = 0,
  max = 10000,
  step = ".1",
}: {
  label: string;
  name: string;
  defaultValue?: number | string;
  required?: boolean;
  min?: number;
  max?: number;
  step?: string;
}) {
  return (
    <label>
      {label}
      <input
        name={name}
        type="number"
        min={min}
        max={max}
        step={step}
        defaultValue={defaultValue}
        required={required}
      />
    </label>
  );
}
export const today = () =>
  new Date().toLocaleDateString("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
export const num = (value: unknown) => Number(value || 0);
export const fmt = (value: unknown, digits = 0) =>
  new Intl.NumberFormat("de-DE", { maximumFractionDigits: digits }).format(
    num(value),
  );
export const slots = {
  breakfast: "Frühstück",
  lunch: "Mittagessen",
  dinner: "Abendessen",
  snack: "Snack",
};
