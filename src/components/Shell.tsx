"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { useEffect, useState } from "react";

interface NavItem {
  href: string;
  label: string;
  icon: string;
}

const ICONS: Record<string, string> = {
  home: "M3 10.5 12 3l9 7.5V21h-6v-6H9v6H3z",
  users: "M16 11a4 4 0 1 0-8 0 4 4 0 0 0 8 0zM4 21a8 8 0 0 1 16 0z",
  plus: "M12 4v16M4 12h16",
  clock: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2",
  play: "M4 5h16v14H4zM10 9v6l5-3z",
  cog: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM4 12h2m12 0h2M12 4v2m0 12v2M6.3 6.3l1.4 1.4m8.6 8.6 1.4 1.4m0-11.4-1.4 1.4m-8.6 8.6-1.4 1.4",
};

function Icon({ name }: { name: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d={ICONS[name]} />
    </svg>
  );
}

function ThemeToggle() {
  const [dark, setDark] = useState(false);
  useEffect(() => setDark(document.documentElement.classList.contains("dark")), []);
  const toggle = () => {
    const next = !dark;
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("prama-theme", next ? "dark" : "light");
    } catch {}
    setDark(next);
  };
  return (
    <button type="button" onClick={toggle} className="btn-secondary btn-sm" aria-pressed={dark}>
      {dark ? "Tema chiaro" : "Tema scuro"}
    </button>
  );
}

export function Shell({ user, isAdmin, children }: { user: { name: string; roleLabel: string; zone: string | null }; isAdmin: boolean; children: React.ReactNode }) {
  const pathname = usePathname();
  const items: NavItem[] = [
    { href: "/", label: "Dashboard", icon: "home" },
    { href: "/atleti", label: "Atleti", icon: "users" },
    { href: "/osservazioni/nuova", label: "Nuova scheda", icon: "plus" },
    { href: "/follow-up", label: "Follow-up", icon: "clock" },
    ...(isAdmin
      ? [
          { href: "/match-analysis", label: "Match analysis", icon: "play" },
          { href: "/impostazioni", label: "Impostazioni", icon: "cog" },
        ]
      : []),
  ];
  const active = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[15rem_1fr]">
      <a href="#contenuto" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-white focus:px-3 focus:py-2 focus:text-prama-900">
        Vai al contenuto
      </a>

      {/* Barra laterale (desktop) */}
      <aside className="no-print hidden bg-prama-900 text-white lg:flex lg:flex-col">
        <div className="flex items-center gap-3 px-5 py-5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon.svg" alt="" className="h-9 w-9" />
          <div>
            <p className="font-display text-lg font-bold leading-none tracking-[0.18em]">PRAMA</p>
            <p className="text-xs text-white/60">Scouting</p>
          </div>
        </div>
        <nav aria-label="Principale" className="flex-1 space-y-1 px-3">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active(item.href) ? "page" : undefined}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium ${active(item.href) ? "bg-white/15 text-white" : "text-white/75 hover:bg-white/10 hover:text-white"}`}
            >
              <Icon name={item.icon} />
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="border-t border-white/10 px-5 py-4 text-sm">
          <p className="font-semibold">{user.name}</p>
          <p className="text-xs text-white/60">
            {user.roleLabel}
            {user.zone ? ` · ${user.zone}` : ""}
          </p>
        </div>
      </aside>

      <div className="flex min-h-screen flex-col">
        <header className="no-print flex items-center justify-between gap-3 border-b border-prama-100 bg-white px-4 py-2.5 dark:border-prama-800 dark:bg-prama-900 lg:px-8">
          <div className="flex items-center gap-2 lg:hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icon.svg" alt="" className="h-8 w-8" />
            <span className="font-display font-bold tracking-[0.16em]">PRAMA</span>
          </div>
          <p className="muted hidden text-xs lg:block">Archivio riservato · vietata la condivisione esterna di dati e video</p>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <button type="button" className="btn-secondary btn-sm" onClick={() => signOut({ callbackUrl: "/login" })}>
              Esci
            </button>
          </div>
        </header>

        <main id="contenuto" className="mx-auto w-full max-w-6xl flex-1 px-4 pb-24 pt-5 lg:px-8 lg:pb-10">
          {children}
        </main>

        {/* Barra inferiore (smartphone) */}
        <nav aria-label="Principale" className="no-print fixed inset-x-0 bottom-0 z-40 flex border-t border-prama-100 bg-white pb-[env(safe-area-inset-bottom)] dark:border-prama-800 dark:bg-prama-900 lg:hidden">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active(item.href) ? "page" : undefined}
              className={`flex min-h-[56px] flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium ${active(item.href) ? "text-prama-800 dark:text-accent-400" : "text-prama-400 dark:text-prama-300"}`}
            >
              <Icon name={item.icon} />
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
}
