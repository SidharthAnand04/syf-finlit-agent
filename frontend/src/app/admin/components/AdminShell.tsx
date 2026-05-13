"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { useAdmin } from "../context";
import { cn } from "@/lib/cn";

function IconGrid({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" stroke="none" aria-hidden="true">
      <rect x="3" y="3" width="7.5" height="7.5" rx="1.5"/>
      <rect x="13.5" y="3" width="7.5" height="7.5" rx="1.5"/>
      <rect x="3" y="13.5" width="7.5" height="7.5" rx="1.5"/>
      <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.5"/>
    </svg>
  );
}

function IconDatabase({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 12c0 1.66 4.03 3 9 3s9-1.34 9-3"/><path d="M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5"/>
    </svg>
  );
}

function IconSliders({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/><circle cx="9" cy="6" r="2.5"/><circle cx="16" cy="12" r="2.5"/><circle cx="11" cy="18" r="2.5"/>
    </svg>
  );
}

function IconChat({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
    </svg>
  );
}

function IconGear({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="3"/><path d="M12 2v2m0 16v2M4.22 4.22l1.42 1.42m12.72 12.72 1.42 1.42M2 12h2m16 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
    </svg>
  );
}

function IconChart({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/>
    </svg>
  );
}

function IconLogout({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
    </svg>
  );
}

function IconChevron({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="6 9 12 15 18 9"/>
    </svg>
  );
}

const NAV = [
  { href: "/admin/overview", label: "Overview", Icon: IconGrid },
  { href: "/admin/sources", label: "Knowledge Sources", Icon: IconDatabase },
  { href: "/admin/personality", label: "Personality", Icon: IconSliders },
  { href: "/admin/faqs", label: "FAQs", Icon: IconChat },
  { href: "/admin/settings", label: "Settings", Icon: IconGear },
];

const INSIGHT_NAV = [
  { href: "/admin/insights", label: "Dashboard" },
  { href: "/admin/insights/questions", label: "Questions & Gaps" },
  { href: "/admin/insights/risk", label: "Risk" },
  { href: "/admin/insights/sources", label: "Sources" },
  { href: "/admin/insights/operations", label: "Operations" },
  { href: "/admin/insights/reports", label: "AI Reports" },
] as const;

function NavLink({
  href,
  label,
  active,
  icon,
  nested = false,
}: {
  href: string;
  label: string;
  active: boolean;
  icon?: React.ReactNode;
  nested?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "admin-nav-item group flex items-center gap-3 rounded-2xl border px-3 text-sm font-semibold text-white/66 no-underline transition-all duration-200 hover:translate-x-0.5 hover:border-white/16 hover:bg-white/[0.10] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-syf-gold/70",
        nested ? "ml-3 min-h-9 py-2 pl-4 text-xs" : "min-h-11 py-2.5",
        active
          ? "active border-syf-gold/40 bg-syf-gold/18 text-white shadow-glass-soft"
          : "border-transparent"
      )}
    >
      {icon && <span className="shrink-0 text-syf-gold/85">{icon}</span>}
      <span className="truncate">{label}</span>
    </Link>
  );
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { signOut } = useAdmin();
  const [insightsOpen, setInsightsOpen] = useState(true);
  const insightsActive = pathname === "/admin/insights" || pathname.startsWith("/admin/insights/");

  return (
    <div className="app-canvas fixed inset-0 overflow-hidden font-sans">
      <div className="premium-grid pointer-events-none absolute inset-0 opacity-70" />
      <div className="pointer-events-none absolute -left-24 -top-28 h-96 w-96 rounded-full bg-syf-gold/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-36 right-0 h-[32rem] w-[32rem] rounded-full bg-accent-cyan/12 blur-3xl" />

      <div className="relative z-10 flex h-full flex-col gap-3 p-3 lg:flex-row lg:p-4">
        <aside className="glass-panel-dark flex max-h-[42vh] shrink-0 flex-col overflow-hidden rounded-glass lg:h-[calc(100vh-2rem)] lg:max-h-none lg:w-64">
          <div className="flex min-h-20 items-center gap-3 border-b border-white/12 px-4">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-syf-gold/40 bg-canvas-950/80 text-base font-black text-syf-gold shadow-glass-soft">
              S
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-black tracking-tight text-syf-cream">Synchrony</div>
              <div className="mt-0.5 text-[10px] font-black uppercase tracking-[0.14em] text-white/48">Admin Console</div>
            </div>
          </div>

          <nav className="flex-1 space-y-1 overflow-y-auto p-2.5">
            {NAV.map(({ href, label, Icon }) => {
              const active = pathname === href || pathname.startsWith(`${href}/`);
              return <NavLink key={href} href={href} label={label} active={active} icon={<Icon />} />;
            })}

            <button
              type="button"
              aria-expanded={insightsOpen}
              onClick={() => setInsightsOpen((open) => !open)}
              className={cn(
                "admin-nav-item group mt-3 flex min-h-11 w-full items-center gap-3 rounded-2xl border border-transparent bg-transparent px-3 py-2.5 text-left text-sm font-bold text-white transition-all duration-200 hover:translate-x-0.5 hover:border-white/16 hover:bg-white/[0.10] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-syf-gold/70",
                insightsActive && "border-syf-gold/30 bg-syf-gold/12 shadow-glass-soft"
              )}
            >
              <span className="shrink-0 text-syf-gold/90"><IconChart /></span>
              <span className="min-w-0 flex-1 truncate">Insights</span>
              <span
                className={cn(
                  "shrink-0 text-white/55 transition-transform duration-200",
                  insightsOpen && "rotate-180"
                )}
              >
                <IconChevron size={14} />
              </span>
            </button>

            {insightsOpen && (
              <div className="space-y-1">
                {INSIGHT_NAV.map(({ href, label }) => (
                  <NavLink key={href} href={href} label={label} active={pathname === href} nested />
                ))}
              </div>
            )}
          </nav>

          <div className="border-t border-white/12 p-2.5">
            <button
              onClick={signOut}
              className="admin-nav-item flex min-h-11 w-full items-center gap-3 rounded-2xl border border-transparent bg-transparent px-3 py-2.5 text-left text-sm font-semibold text-white/60 transition-all hover:translate-x-0.5 hover:bg-white/[0.10] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-syf-gold/70"
            >
              <IconLogout />
              Sign out
            </button>
          </div>
        </aside>

        <main className="min-w-0 flex-1 overflow-y-auto rounded-glass px-2 py-4 lg:px-8 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
