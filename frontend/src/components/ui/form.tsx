import * as React from "react";
import { cn } from "@/lib/cn";

const control =
  "w-full rounded-2xl border border-white/25 bg-white/70 px-3.5 py-2.5 text-sm text-syf-charcoal shadow-inner outline-none backdrop-blur-xl transition focus:border-syf-gold focus:ring-2 focus:ring-syf-gold/25 disabled:cursor-not-allowed disabled:opacity-50";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => <input ref={ref} className={cn(control, className)} {...props} />
);
Input.displayName = "Input";

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => <textarea ref={ref} className={cn(control, "min-h-28 resize-y", className)} {...props} />
);
Textarea.displayName = "Textarea";

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, ...props }, ref) => <select ref={ref} className={cn(control, "cursor-pointer", className)} {...props} />
);
Select.displayName = "Select";

export function Field({
  label,
  hint,
  children,
  className,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("block", className)}>
      <span className="mb-1.5 block text-xs font-bold text-syf-charcoal">{label}</span>
      {children}
      {hint && <span className="mt-1.5 block text-[11px] leading-relaxed text-syf-muted">{hint}</span>}
    </label>
  );
}
