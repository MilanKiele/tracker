"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Eye, EyeOff, Leaf } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
export function ResetPasswordForm() {
  const [password, setPassword] = useState(""),
    [error, setError] = useState(""),
    [show, setShow] = useState(false),
    [pending, setPending] = useState(false);
  const router = useRouter();
  const configured = Boolean(
    (process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL) &&
    (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
  );
  return (
    <main className="auth-page">
      <div className="auth-card">
        <Link href="/" className="brand auth-brand">
          <span className="brand-mark">
            <Leaf size={19} />
          </span>
          <span>
            everwell<span className="brand-dot">.</span>
          </span>
        </Link>
        <div className="auth-intro">
          <div className="eyebrow">DEIN NEUES PASSWORT</div>
          <h1>Neues Passwort festlegen.</h1>
          <p>Mindestens acht Zeichen.</p>
        </div>
        {!configured && (
          <div className="auth-setup">Supabase muss zuerst verbunden sein.</div>
        )}
        {error && <div className="auth-error">{error}</div>}
        <form
          className="auth-form"
          onSubmit={async (e) => {
            e.preventDefault();
            setPending(true);
            setError("");
            const { error } = await createClient().auth.updateUser({
              password,
            });
            setPending(false);
            if (error) {
              setError(error.message);
              return;
            }
            router.push(
              "/login?message=Your%20password%20has%20been%20updated.",
            );
          }}
        >
          <label>
            Neues Passwort
            <div className="password-field">
              <input
                type={show ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={8}
                maxLength={128}
                required
                autoComplete="new-password"
                placeholder="Mindestens 8 Zeichen"
              />
              <button
                type="button"
                onClick={() => setShow(!show)}
                aria-label={show ? "Passwort verbergen" : "Passwort anzeigen"}
              >
                {show ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </label>
          <button
            className="button button-primary auth-submit"
            disabled={pending || !configured}
          >
            {pending ? "Speichert …" : "Passwort speichern"}
            <ArrowRight size={15} />
          </button>
        </form>
        <div className="auth-switch">
          <Link href="/login">Zur Anmeldung</Link>
        </div>
      </div>
    </main>
  );
}
