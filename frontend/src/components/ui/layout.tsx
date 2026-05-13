import * as React from "react";
import { cn } from "@/lib/cn";
import { Badge } from "./badge";
import { Card } from "./panel";

export function PageHeader({
  title,
  subtitle,
  eyebrow,
  action,
  center = false,
  className,
}: {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  action?: React.ReactNode;
  center?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("mb-7 flex items-start justify-between gap-5", center && "text-center", className)}>
      <div className={cn("min-w-0", center && "mx-auto")}>
        {eyebrow && <div className="mb-2 text-[11px] font-black uppercase tracking-[0.14em] text-syf-gold">{eyebrow}</div>}
        <h1 className="m-0 text-3xl font-black tracking-tight text-syf-cream">{title}</h1>
        {subtitle && <p className={cn("mt-2 max-w-2xl text-sm leading-6 text-white/66", center && "mx-auto")}>{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function SectionHeader({
  title,
  note,
  badge,
  action,
  className,
}: {
  title: string;
  note?: string;
  badge?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-3 mt-7 flex items-center justify-between gap-3", className)}>
      <div className="flex min-w-0 items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-syf-gold shadow-[0_0_18px_rgba(251,198,0,0.55)]" />
        <h2 className="text-xs font-black uppercase tracking-[0.12em] text-white/70">{title}</h2>
        {badge && <Badge variant="gold">{badge}</Badge>}
        {note && <span className="text-xs text-white/45">{note}</span>}
      </div>
      {action}
    </div>
  );
}

export function MetricCard({
  label,
  value,
  sub,
  icon,
}: {
  label: string;
  value: React.ReactNode;
  sub?: string;
  icon?: React.ReactNode;
}) {
  return (
    <Card className="relative overflow-hidden p-5">
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-syf-gold via-syf-gold/40 to-transparent" />
      <div className="flex items-start gap-3">
        {icon && (
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-syf-gold/35 bg-syf-gold/18 text-syf-charcoal shadow-inner">
            {icon}
          </div>
        )}
        <div className="min-w-0">
          <div className="text-2xl font-black leading-none tracking-tight text-syf-charcoal">{value}</div>
          <div className="mt-1.5 text-[11px] font-black uppercase tracking-[0.08em] text-syf-muted">{label}</div>
          {sub && <div className="mt-1 text-[11px] text-syf-muted">{sub}</div>}
        </div>
      </div>
    </Card>
  );
}
