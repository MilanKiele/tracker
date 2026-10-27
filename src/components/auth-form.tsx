"use client";

import Link from "next/link";
import { useState } from "react";
import { useFormStatus } from "react-dom";
import { ArrowRight, Eye, EyeOff, Leaf, LoaderCircle } from "lucide-react";
import { login, register, requestPasswordReset } from "@/app/actions";

export function AuthForm({
  mode,
  error,
  message,
}: {
  mode: "login" | "register" | "reset";
  error?: string;
  message?: string;
}) {
  const [show, setShow] = useState(false);
  const configured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
  );
  return (
    <main className="auth-page">
      <section className="auth-card">
        <Link href="/" className="brand auth-brand">
          <span className="brand-mark">
            <Leaf size={21} />
          </span>
          everwell.
        </Link>
        <div className="auth-intro">
          <span className="eyebrow">DEIN ALLTAG. DEIN RHYTHMUS.</span>
          <h1>
            {mode === "login"
              ? "Schön, dass du da bist."
              : mode === "register"
                ? "Dein neuer Start."
                : "Wieder reinkommen."}
          </h1>
          <p>
            {mode === "reset"
              ? "Wir senden dir einen Link zum Zurücksetzen."
              : "Training, Ernährung und Fortschritt. An einem Ort."}
          </p>
        </div>
        {!configured && (
          <div className="auth-setup">
            Supabase ist noch nicht verbunden. Projekt-URL und öffentlichen
            Schlüssel in der Umgebung hinterlegen.
          </div>
        )}
        {error && (
          <div className="auth-error" role="alert">
            {error}
          </div>
        )}
        {message && (
          <div className="auth-message" role="status">
            {message}
          </div>
        )}
        <form
          className="auth-form"
          action={
            mode === "login"
              ? login
              : mode === "register"
                ? register
                : requestPasswordReset
          }
        >
          {mode === "register" && (
            <label>
              Name
              <input
                name="name"
                autoComplete="name"
                minLength={2}
                maxLength={80}
                required
              />
            </label>
          )}
          <label>
            E-Mail
            <input name="email" type="email" autoComplete="email" required />
          </label>
          {mode !== "reset" && (
            <label>
              Passwort
              <div className="password-field">
                <input
                  name="password"
                  type={show ? "text" : "password"}
                  minLength={8}
                  maxLength={128}
                  autoComplete={
                    mode === "login" ? "current-password" : "new-password"
                  }
                  required
                />
                <button
                  type="button"
                  aria-label={show ? "Passwort verbergen" : "Passwort anzeigen"}
                  onClick={() => setShow(!show)}
                >
                  {show ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </label>
          )}
          {mode === "login" && (
            <Link href="/forgot-password" className="auth-forgot">
              Passwort vergessen?
            </Link>
          )}
          <AuthSubmit disabled={!configured}>
            {mode === "login"
              ? "Anmelden"
              : mode === "register"
                ? "Konto erstellen"
                : "Link senden"}
          </AuthSubmit>
        </form>
        <div className="auth-switch">
          {mode === "login" ? (
            <>
              Noch kein Konto? <Link href="/register">Registrieren</Link>
            </>
          ) : (
            <Link href="/login">Zur Anmeldung</Link>
          )}
        </div>
      </section>
    </main>
  );
}
function AuthSubmit({
  disabled,
  children,
}: {
  disabled: boolean;
  children: React.ReactNode;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      className="btn btn-primary auth-submit"
      disabled={disabled || pending}
    >
      {pending ? (
        <LoaderCircle size={17} className="spin" />
      ) : (
        <ArrowRight size={17} />
      )}{" "}
      {children}
    </button>
  );
}
