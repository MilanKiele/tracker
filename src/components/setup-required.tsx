import Link from "next/link";
import { Leaf } from "lucide-react";
export function SetupRequired() {
  return (
    <main className="setup-page">
      <section className="setup-card">
        <span className="brand-mark">
          <Leaf size={22} />
        </span>
        <h1>Workspace verbinden.</h1>
        <p>
          Für deine gespeicherten Daten fehlt noch die Supabase-Konfiguration.
        </p>
        <pre>{`NEXT_PUBLIC_SUPABASE_URL=…\nNEXT_PUBLIC_SUPABASE_ANON_KEY=…`}</pre>
        <ol>
          <li>Variablen lokal oder in Vercel hinterlegen.</li>
          <li>
            Migrationen 001–004 im bestehenden Supabase-Projekt ausführen.
          </li>
          <li>App neu starten bzw. neu deployen.</li>
        </ol>
        <Link href="/login" className="btn btn-primary">
          Zur Anmeldung
        </Link>
      </section>
    </main>
  );
}
