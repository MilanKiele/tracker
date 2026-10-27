"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Apple, BarChart3, Bell, CalendarDays, ChevronDown, CircleHelp, Dumbbell, Leaf, LogOut, Menu, UserRound, Weight, X } from "lucide-react";
import { useState } from "react";
import { logout } from "@/app/actions";

const nav = [
  { href: "/", label: "Today", icon: CalendarDays },
  { href: "/train", label: "Train", icon: Dumbbell },
  { href: "/nutrition", label: "Nutrition", icon: Apple },
  { href: "/body", label: "Body", icon: Weight },
  { href: "/insights", label: "Insights", icon: BarChart3 },
];
export function AppShell({ children, profile, email }: { children: React.ReactNode; profile?: { full_name?: string | null }; email?: string }) {
  const pathname = usePathname(); const [menuOpen, setMenuOpen] = useState(false);
  const current = nav.find((item) => item.href === pathname)?.label ?? (pathname === "/account" ? "Account" : "Today");
  const name = profile?.full_name || email?.split("@")[0] || "Your account";
  const initials = name.split(/\s+/).map((part) => part[0]).slice(0, 2).join("").toUpperCase();
  return <div className="app-frame">
    <aside className="sidebar">
      <Link href="/" className="brand"><span className="brand-mark"><Leaf size={19} /></span><span>everwell<span className="brand-dot">.</span></span></Link>
      <div className="workspace-label">YOUR SPACE</div>
      <nav className="side-nav">{nav.map(({ href, label, icon: Icon }) => <Link key={href} className={`nav-link ${pathname === href ? "active" : ""}`} href={href}><Icon size={18} strokeWidth={1.8} />{label}</Link>)}</nav>
      <div className="sidebar-bottom"><div className="sidebar-streak"><div className="streak-icon">✳</div><div><b>Your rhythm</b><small>Progress from your own entries.</small></div></div>
        <button className="profile-chip" onClick={() => setMenuOpen(!menuOpen)}><span className="avatar">{initials}</span><span className="profile-name"><b>{name}</b><small>{email || "Account settings"}</small></span><ChevronDown size={15} /></button>
        {menuOpen && <div className="profile-menu"><Link href="/account" onClick={() => setMenuOpen(false)}><UserRound size={14}/> Account settings</Link><form action={logout}><button><LogOut size={14}/> Sign out</button></form></div>}
      </div>
    </aside>
    <div className="main-column">
      <header className="topbar"><button className="mobile-menu icon-button" aria-label="Open navigation" onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <X size={20} /> : <Menu size={20} />}</button><div className="breadcrumbs"><span>Workspace</span><span className="crumb-slash">/</span><b>{current}</b></div><div className="top-actions"><Link className="icon-button notification" aria-label="Account and notifications" href="/account#notifications"><Bell size={18}/></Link><Link href="/account" className="avatar top-avatar">{initials}</Link></div></header>
      {menuOpen && <div className="mobile-drawer"><div className="mobile-drawer-head"><span className="brand"><span className="brand-mark"><Leaf size={19}/></span>everwell<span className="brand-dot">.</span></span><button className="icon-button" onClick={() => setMenuOpen(false)}><X size={18}/></button></div>{nav.map(({ href, label, icon: Icon }) => <Link onClick={() => setMenuOpen(false)} key={href} className={`nav-link ${pathname === href ? "active" : ""}`} href={href}><Icon size={19}/>{label}</Link>)}<Link className="nav-link" href="/account" onClick={() => setMenuOpen(false)}><UserRound size={19}/>Account</Link><div className="drawer-footer"><UserRound size={17}/> {name} <span>{email}</span></div><form action={logout}><button className="drawer-logout"><LogOut size={15}/> Sign out</button></form></div>}
      <main className="page-content">{children}</main>
      <footer className="desktop-footer"><span>Small steps, steady progress.</span><span><CircleHelp size={14}/> Made for your kind of strong</span></footer>
    </div>
    <nav className="bottom-nav">{nav.map(({ href, label, icon: Icon }) => <Link key={href} className={pathname === href ? "selected" : ""} href={href}><Icon size={20} strokeWidth={1.9}/><span>{label}</span></Link>)}</nav>
  </div>;
}
export function PageHeading({ eyebrow, title, subtitle, action }: { eyebrow: string; title: string; subtitle: string; action?: React.ReactNode }) { return <div className="page-heading"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{subtitle}</p></div>{action && <div className="heading-action">{action}</div>}</div>; }
