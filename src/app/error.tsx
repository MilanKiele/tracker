"use client";
import { useRouter } from "next/navigation";
export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();
  return (
    <main className="auth-page">
      <section className="auth-card">
        <span className="eyebrow">VERBINDUNG UNTERBROCHEN</span>
        <h1>Deine Daten sind gerade nicht erreichbar.</h1>
        <p>
          Bitte Verbindung und Supabase-Konfiguration prüfen und erneut
          versuchen.
        </p>
        <button
          className="btn btn-primary"
          onClick={() => {
            router.refresh();
            reset();
          }}
        >
          Erneut laden
        </button>
      </section>
    </main>
  );
}
