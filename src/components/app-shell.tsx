"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, Apple, BarChart3, Bell, CalendarDays, ChevronDown, CircleHelp, Dumbbell, Leaf, LogOut, Menu, Plus, Settings2, UserRound, Weight, X } from "lucide-react";
import { useState } from "react";

const nav = [
  { href: "/", label: "Today", icon: CalendarDays },
  { href: "/train", label: "Train", icon: Dumbbell },
  { href: "/nutrition", label: "Nutrition", icon: Apple },
  { href: "/body", label: "Body", icon: Weight },
  { href: "/insights", label: "Insights", icon: BarChart3 },
];
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname(); const [menuOpen, setMenuOpen] = useState(false);
  const current = nav.find((item) => item.href === pathname)?.label ?? "Today";
  return <div className="app-frame">
    <aside className="sidebar">
      <Link href="/" className="brand"><span className="brand-mark"><Leaf size={19} /></span><span>everwell<span className="brand-dot">.</span></span></Link>
      <div className="workspace-label">YOUR SPACE</div>
      <nav className="side-nav">{nav.map(({ href, label, icon: Icon }) => <Link key={href} className={`nav-link ${pathname === href ? "active" : ""}`} href={href}><Icon size={18} strokeWidth={1.8} />{label}{label === "Today" && <span className="nav-live" />}</Link>)}</nav>
      <div className="sidebar-bottom">
        <div className="sidebar-streak"><div className="streak-icon">✳</div><div><b>2 week rhythm</b><small>You’re showing up for you.</small></div></div>
        <button className="profile-chip" onClick={() => setMenuOpen(!menuOpen)}><span className="avatar">J</span><span className="profile-name"><b>Jamie Parker</b><small>Personal space</small></span><ChevronDown size={15} /></button>
      </div>
    </aside>
    <div className="main-column">
      <header className="topbar"><button className="mobile-menu icon-button" aria-label="Open navigation" onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <X size={20} /> : <Menu size={20} />}</button><div className="breadcrumbs"><span>Workspace</span><span className="crumb-slash">/</span><b>{current}</b></div><div className="top-actions"><button className="date-pill"><CalendarDays size={15}/><span>Tuesday, Oct 27</span><ChevronDown size={13}/></button><button className="icon-button notification" aria-label="Notifications"><Bell size={18}/><i /></button><button className="avatar top-avatar">J</button></div></header>
      {menuOpen && <div className="mobile-drawer"><div className="mobile-drawer-head"><span className="brand"><span className="brand-mark"><Leaf size={19}/></span>everwell<span className="brand-dot">.</span></span><button className="icon-button" onClick={() => setMenuOpen(false)}><X size={18}/></button></div>{nav.map(({ href, label, icon: Icon }) => <Link onClick={() => setMenuOpen(false)} key={href} className={`nav-link ${pathname === href ? "active" : ""}`} href={href}><Icon size={19}/>{label}</Link>)}<div className="drawer-footer"><UserRound size={17}/> Jamie Parker <span>Personal space</span></div></div>}
      <main className="page-content">{children}</main>
      <footer className="desktop-footer"><span>Small steps, steady progress.</span><span><CircleHelp size={14}/> Made for your kind of strong</span></footer>
    </div>
    <nav className="bottom-nav">{nav.map(({ href, label, icon: Icon }) => <Link key={href} className={pathname === href ? "selected" : ""} href={href}><Icon size={20} strokeWidth={1.9}/><span>{label}</span></Link>)}</nav>
  </div>;
}
export function PageHeading({ eyebrow, title, subtitle, action }: { eyebrow: string; title: string; subtitle: string; action?: React.ReactNode }) { return <div className="page-heading"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{subtitle}</p></div>{action && <div className="heading-action">{action}</div>}</div>; }
export function AddButton({ children = "Add entry", onClick }: { children?: React.ReactNode; onClick?: () => void }) { return <button className="button button-primary" onClick={onClick}><Plus size={17}/>{children}</button>; }
