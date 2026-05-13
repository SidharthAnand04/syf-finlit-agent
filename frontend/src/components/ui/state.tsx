import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function LoadingState({ label = "Loading..." }: { label?: string }) {
  return (
    <div className="flex min-h-40 items-center justify-center gap-3 p-8 text-sm font-medium text-syf-muted">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-syf-gold/30 border-t-syf-gold" />
      {label}
    </div>
  );
}

export function EmptyState({
  title = "No data yet",
  description,
  action,
  className,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex min-h-44 flex-col items-center justify-center p-8 text-center", className)}>
      <div className="mb-4 grid h-12 w-12 place-items-center rounded-full border border-syf-gold/35 bg-syf-gold/16 shadow-inner">
        <span className="h-2.5 w-2.5 rounded-full bg-syf-gold shadow-[0_0_18px_rgba(251,198,0,0.55)]" />
      </div>
      <div className="text-base font-black text-syf-charcoal">{title}</div>
      {description && <p className="mt-2 max-w-md text-sm leading-6 text-syf-muted">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
