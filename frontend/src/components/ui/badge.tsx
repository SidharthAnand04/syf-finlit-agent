import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/cn";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-extrabold leading-none tracking-[0.02em] backdrop-blur-md",
  {
    variants: {
      variant: {
        neutral: "border-white/20 bg-white/14 text-syf-cream",
        gold: "border-syf-gold/40 bg-syf-gold/18 text-syf-cream",
        success: "border-emerald-400/25 bg-emerald-400/16 text-emerald-100",
        warning: "border-amber-300/30 bg-amber-300/16 text-amber-100",
        danger: "border-red-400/30 bg-red-400/16 text-red-100",
        info: "border-accent-cyan/35 bg-accent-cyan/14 text-cyan-100",
        light: "border-black/5 bg-white/70 text-syf-charcoal",
      },
    },
    defaultVariants: {
      variant: "neutral",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
