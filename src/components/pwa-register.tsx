"use client";

import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";
type InstallPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};
export function PwaRegister() {
  const [installEvent, setInstallEvent] = useState<InstallPrompt | null>(null);
  useEffect(() => {
    if ("serviceWorker" in navigator)
      void navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    const onInstall = (event: Event) => {
      event.preventDefault();
      try {
        if (localStorage.getItem("everwell-install-dismissed") === "true")
          return;
      } catch {
        /* Storage may be disabled. */
      }
      setInstallEvent(event as InstallPrompt);
    };
    const installed = () => setInstallEvent(null);
    window.addEventListener("beforeinstallprompt", onInstall);
    window.addEventListener("appinstalled", installed);
    return () => {
      window.removeEventListener("beforeinstallprompt", onInstall);
      window.removeEventListener("appinstalled", installed);
    };
  }, []);
  if (!installEvent) return null;
  return (
    <aside className="pwa-install-banner" aria-label="App installieren">
      <span>
        <b>Everwell als App</b>
        <small>Direkt auf deinem Home-Bildschirm.</small>
      </span>
      <button
        onClick={async () => {
          await installEvent.prompt();
          await installEvent.userChoice;
          setInstallEvent(null);
        }}
      >
        <Download size={15} /> Installieren
      </button>
      <button
        className="pwa-close"
        aria-label="Hinweis schließen"
        onClick={() => {
          setInstallEvent(null);
          try {
            localStorage.setItem("everwell-install-dismissed", "true");
          } catch {
            /* Optional preference. */
          }
        }}
      >
        <X size={15} />
      </button>
    </aside>
  );
}
