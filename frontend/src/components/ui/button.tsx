import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/cn";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-full font-bold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-syf-gold/70 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas-950 disabled:pointer-events-none disabled:opacity-50 motion-reduce:transition-none",
  {
    variants: {
      variant: {
        primary:
          "bg-gradient-to-b from-syf-gold to-syf-goldDark text-syf-charcoal shadow-glow hover:-translate-y-0.5 hover:brightness-105 active:translate-y-0",
        secondary:
          "border border-white/15 bg-white/[0.09] text-syf-cream shadow-glass-soft backdrop-blur-xl hover:-translate-y-0.5 hover:border-syf-gold/40 hover:bg-white/[0.14]",
        ghost:
          "border border-white/18 bg-white/[0.08] text-syf-cream backdrop-blur-xl hover:-translate-y-0.5 hover:border-syf-gold/35 hover:bg-white/[0.14]",
        surface:
          "border border-black/5 bg-white/70 text-syf-charcoal shadow-glass-soft backdrop-blur-xl hover:-translate-y-0.5 hover:bg-white/85",
        danger:
          "bg-red-600 text-white shadow-lg shadow-red-950/20 hover:-translate-y-0.5 hover:bg-red-700",
      },
      size: {
        sm: "h-8 px-3 text-xs",
        md: "h-10 px-5 text-sm",
        lg: "h-12 px-6 text-sm",
        icon: "h-10 w-10 p-0",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "md",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />
  )
);
Button.displayName = "Button";

export { buttonVariants };
