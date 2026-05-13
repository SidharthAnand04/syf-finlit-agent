import { C, FONT } from "../../components/tokens";

export interface SectionBadge {
  label: string;
  /** Tailwind-like semantic color name */
  color: "red" | "green" | "yellow" | "blue" | "neutral" | "gold";
}

const BADGE_STYLES: Record<SectionBadge["color"], { color: string; bg: string }> = {
  red:     { color: "#991b1b", bg: "#fee2e2" },
  green:   { color: "#065f46", bg: "#d1fae5" },
  yellow:  { color: "#92400e", bg: "#fef3c7" },
  blue:    { color: "#1e40af", bg: "#dbeafe" },
  neutral: { color: "#4b5563", bg: "rgba(255,252,245,0.88)" },
  gold:    { color: "#92400e", bg: "#fffbeb" },
};

interface SectionHeaderProps {
  title: string;
  badges?: SectionBadge[];
  note?: string;
  action?: React.ReactNode;
  /** Additional bottom margin override (default 12) */
  mb?: number;
}

export function SectionHeader({ title, badges, note, action, mb = 12 }: SectionHeaderProps) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginTop: 0,
        marginBottom: mb,
        gap: 10,
        flexWrap: "wrap" as const,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" as const }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: C.muted,
            textTransform: "uppercase" as const,
            letterSpacing: "0.06em",
            fontFamily: FONT,
          }}
        >
          {title}
        </div>

        {badges?.map((badge, i) => {
          const s = BADGE_STYLES[badge.color];
          return (
            <span
              key={i}
              style={{
                display: "inline-block",
                padding: "1px 7px",
                borderRadius: 99,
                fontSize: 10,
                fontWeight: 700,
                background: s.bg,
                color: s.color,
                fontFamily: FONT,
                whiteSpace: "nowrap" as const,
              }}
            >
              {badge.label}
            </span>
          );
        })}

        {note && (
          <span style={{ fontSize: 11, color: C.muted, fontFamily: FONT }}>
            {note}
          </span>
        )}
      </div>

      {action && <div style={{ flexShrink: 0 }}>{action}</div>}
    </div>
  );
}
