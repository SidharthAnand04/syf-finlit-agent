import { FONT } from "../../components/tokens";

export type BadgeVariant =
  | "high"
  | "medium"
  | "low"
  | "success"
  | "warning"
  | "info"
  | "neutral"
  | "noise"
  | "gap"
  | "partial"
  | "good";

const VARIANT_STYLES: Record<BadgeVariant, { color: string; bg: string; border: string }> = {
  high:    { color: "#991b1b", bg: "rgba(254,226,226,0.76)", border: "rgba(153,27,27,0.18)" },
  medium:  { color: "#92400e", bg: "rgba(254,243,199,0.78)", border: "rgba(146,64,14,0.18)" },
  low:     { color: "#1e40af", bg: "rgba(219,234,254,0.76)", border: "rgba(30,64,175,0.16)" },
  success: { color: "#065f46", bg: "rgba(209,250,229,0.76)", border: "rgba(6,95,70,0.18)" },
  warning: { color: "#92400e", bg: "rgba(254,243,199,0.78)", border: "rgba(146,64,14,0.18)" },
  info:    { color: "#1e40af", bg: "rgba(219,234,254,0.76)", border: "rgba(30,64,175,0.16)" },
  neutral: { color: "#4b5563", bg: "rgba(243,244,246,0.72)", border: "rgba(75,85,99,0.16)" },
  noise:   { color: "#6b7280", bg: "rgba(249,250,251,0.70)", border: "rgba(107,114,128,0.14)" },
  gap:     { color: "#991b1b", bg: "rgba(254,226,226,0.76)", border: "rgba(153,27,27,0.18)" },
  partial: { color: "#92400e", bg: "rgba(254,243,199,0.78)", border: "rgba(146,64,14,0.18)" },
  good:    { color: "#065f46", bg: "rgba(209,250,229,0.76)", border: "rgba(6,95,70,0.18)" },
};

interface StatusBadgeProps {
  label: string;
  variant: BadgeVariant;
  /** When true renders UPPERCASE text, default false */
  uppercase?: boolean;
  size?: "sm" | "md";
}

export function StatusBadge({ label, variant, uppercase = false, size = "sm" }: StatusBadgeProps) {
  const s = VARIANT_STYLES[variant];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: size === "sm" ? "3px 9px" : "5px 12px",
        borderRadius: 99,
        fontSize: size === "sm" ? 10 : 12,
        fontWeight: 700,
        fontFamily: FONT,
        whiteSpace: "nowrap" as const,
        textTransform: uppercase ? ("uppercase" as const) : "none",
        letterSpacing: uppercase ? "0.04em" : "normal",
        background: s.bg,
        color: s.color,
        border: `1px solid ${s.border}`,
        lineHeight: 1.35,
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
      }}
    >
      {label}
    </span>
  );
}

/** Map coverage status strings to badge variants */
export function coverageVariant(
  status: "Strong" | "Partial" | "Weak" | "Missing" | "Noise"
): BadgeVariant {
  switch (status) {
    case "Strong":  return "success";
    case "Partial": return "info";
    case "Weak":    return "warning";
    case "Missing": return "high";
    case "Noise":   return "noise";
  }
}

/** Map priority level strings to badge variants */
export function priorityVariant(level: "High" | "Medium" | "Low"): BadgeVariant {
  switch (level) {
    case "High":   return "high";
    case "Medium": return "medium";
    case "Low":    return "low";
  }
}

/** Map LLM coverage strings to badge variants */
export function llmCoverageVariant(coverage: "good" | "partial" | "gap"): BadgeVariant {
  switch (coverage) {
    case "good":    return "good";
    case "partial": return "partial";
    case "gap":     return "gap";
  }
}

