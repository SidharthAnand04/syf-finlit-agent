import * as React from "react";
import { cn } from "@/lib/cn";
import { GlassPanel } from "./panel";

export function TableShell({ className, children }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <GlassPanel className={cn("overflow-hidden rounded-glass", className)}>
      <div className="overflow-x-auto">{children}</div>
    </GlassPanel>
  );
}

export function Table({ className, ...props }: React.TableHTMLAttributes<HTMLTableElement>) {
  return <table className={cn("admin-table min-w-full", className)} {...props} />;
}
