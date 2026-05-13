import * as React from "react";
import { cn } from "@/lib/cn";

export function GlassPanel({
  className,
  children,
  as: Comp = "div",
  interactive = false,
  ...props
}: React.HTMLAttributes<HTMLElement> & {
  as?: React.ElementType;
  interactive?: boolean;
}) {
  return (
    <Comp
      className={cn(
        "glass-panel-base",
        interactive && "glass-interactive",
        className
      )}
      {...props}
    >
      {children}
    </Comp>
  );
}

export function Card({
  className,
  interactive,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { interactive?: boolean }) {
  return <GlassPanel interactive={interactive} className={cn("rounded-glass p-5", className)} {...props} />;
}
