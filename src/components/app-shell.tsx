"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Apple,
  BarChart3,
  Bell,
  CalendarDays,
  ChevronRight,
  Dumbbell,
  Leaf,
  LogOut,
  Sparkles,
  UserRound,
  Weight,
} from "lucide-react";
import { logout } from "@/app/actions";
import { FeedbackProvider } from "@/components/v2/ui";
import { AiProvider, useAi } from "@/components/v2/ai-flow";

const nav = [
  { href: "/", label: "Heute", icon: CalendarDays },
  { href: "/train", label: "Training", icon: Dumbbell },
  { href: "/nutrition", label: "Essen", icon: Apple },
  { href: "/body", label: "Körper", icon: Weight },
  { href: "/insights", label: "Einblicke", icon: BarChart3 },
];
export function AppShell({
  children,
  profile,
  email,
}: {
  children: React.ReactNode;
  profile?: { full_name?: string | null };
  email?: string;
}) {
  return (
    <FeedbackProvider>
      <AiProvider>
        <Shell profile={profile} email={email}>
          {children}
        </Shell>
      </AiProvider>
    </FeedbackProvider>
  );
}
function Shell({
  children,
  profile,
  email,
}: {
  children: React.ReactNode;
  profile?: { full_name?: string | null };
  email?: string;
}) {
  const path = usePathname();
  const { openAi } = useAi();
  const name = profile?.full_name || email?.split("@")[0] || "Mein Konto";
  const initials = name
    .split(/\s+/)
    .map((part) => part[0])
    .slice(0, 2)
    .join("");
  return (
    <div className="app-frame">
      <a className="skip-link" href="#main">
        Zum Inhalt
      </a>
      <aside className="sidebar">
        <Link href="/" className="brand">
          <span className="brand-mark">
            <Leaf size={21} />
          </span>
          everwell<span className="brand-dot">.</span>
        </Link>
        <div className="sidebar-label">DEIN ALLTAG. DEIN RHYTHMUS.</div>
        <nav className="side-nav" aria-label="Hauptnavigation">
          {nav.map(({ href, label, icon: Icon }) => (
            <Link
              href={href}
              key={href}
              className={`nav-link ${path === href ? "active" : ""}`}
              aria-current={path === href ? "page" : undefined}
            >
              <Icon size={20} />
              <span>{label}</span>
              {path === href && <i />}
            </Link>
          ))}
        </nav>
        <button
          className="sidebar-ai"
          onClick={() => openAi(path === "/train" ? "plan" : "food")}
        >
          <span>
            <Sparkles size={19} /> Dein KI-Assistent
          </span>
          <small>Beschreiben. Anpassen. Loslegen.</small>
          <ChevronRight size={16} />
        </button>
        <div className="sidebar-bottom">
          <Link href="/account" className="account-link">
            <span className="avatar">{initials}</span>
            <span>
              <b>{name}</b>
              <small>Konto & Einstellungen</small>
            </span>
            <ChevronRight size={16} />
          </Link>
          <form action={logout}>
            <button className="logout-link">
              <LogOut size={15} /> Abmelden
            </button>
          </form>
        </div>
      </aside>
      <div className="main-column">
        <header className="topbar">
          <div className="mobile-brand">
            <Leaf size={22} />
            <b>everwell.</b>
          </div>
          <div className="breadcrumb">
            Mein Workspace <ChevronRight size={13} />
            <strong>
              {nav.find((item) => item.href === path)?.label ?? "Konto"}
            </strong>
          </div>
          <div className="top-actions">
            <span className="private-pill">
              <i /> Dein privater Bereich
            </span>
            <Link
              href="/account#notifications"
              className="icon-btn"
              aria-label="Benachrichtigungen"
            >
              <Bell size={19} />
            </Link>
          <button
            className="icon-btn mobile-ai-btn"
            aria-label="KI-Assistent öffnen"
            onClick={() => openAi(path === "/train" ? "plan" : "food")}
          >
            <Sparkles size={19} />
          </button>
            <Link href="/account" className="avatar" aria-label="Konto öffnen">
              {initials || <UserRound size={16} />}
            </Link>
          </div>
        </header>
        <main id="main" className="page-content">
          {children}
        </main>
        <footer className="page-footer">
          <Leaf size={14} />
          <span>Schritt für Schritt. Für dich.</span>
          <Link href="/account">Einstellungen</Link>
        </footer>
      </div>
      <nav className="bottom-nav" aria-label="Hauptnavigation">
        {nav.map(({ href, label, icon: Icon }) => (
          <Link
            href={href}
            key={href}
            className={path === href ? "active" : ""}
            aria-current={path === href ? "page" : undefined}
          >
            <Icon size={21} />
            <span>{label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
export function PageHeading({
  eyebrow,
  title,
  subtitle,
  action,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {action && <div className="heading-action">{action}</div>}
    </div>
  );
}
