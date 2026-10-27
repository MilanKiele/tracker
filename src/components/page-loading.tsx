import { Leaf } from "lucide-react";
import Link from "next/link";

const pages = [
  ["/", "Heute"],
  ["/train", "Training"],
  ["/nutrition", "Essen"],
  ["/body", "Körper"],
  ["/insights", "Einblicke"],
] as const;

export function PageLoading({ title }: { title: string }) {
  return (
    <div className="loading-frame" role="status" aria-label={`${title} wird geladen`}>
      <header className="loading-header">
        <span className="loading-mark"><Leaf size={20} /></span>
        <b>everwell.</b>
        <span>{title}</span>
      </header>
      <nav className="loading-nav" aria-label="Hauptnavigation">
        {pages.map(([href, label]) => (
          <Link href={href} key={href} aria-current={label === title ? "page" : undefined}>
            {label}
          </Link>
        ))}
        <Link href="/account" aria-current={title === "Konto" ? "page" : undefined}>Konto</Link>
      </nav>
      <main className="loading-content" aria-hidden="true">
        <i className="loading-bar short" />
        <i className="loading-bar title" />
        <div className="loading-cards">
          <i /><i /><i /><i />
        </div>
        <i className="loading-panel" />
        <p>Deine Daten werden geladen …</p>
      </main>
    </div>
  );
}
