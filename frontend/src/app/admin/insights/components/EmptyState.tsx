import { C, FONT } from "../../components/tokens";

interface EmptyStateProps {
  message: string;
  subtext?: string;
  action?: React.ReactNode;
  /** Padding around the message; default 40px top/bottom */
  py?: number;
}

export function EmptyState({ message, subtext, action, py = 40 }: EmptyStateProps) {
  return (
    <div
      style={{
        padding: `${py}px 24px`,
        textAlign: "center",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 10,
      }}
    >
      <div style={{
        width: 38,
        height: 38,
        borderRadius: "50%",
        background: C.goldGlass,
        border: `1px solid ${C.goldGlassBorder}`,
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.36)",
      }} />
      <div style={{ fontSize: 14, fontWeight: 800, color: C.charcoal, fontFamily: FONT, lineHeight: 1.45 }}>
        {message}
      </div>
      {subtext && (
        <div style={{ fontSize: 11, color: C.muted, fontFamily: FONT, opacity: 0.75 }}>
          {subtext}
        </div>
      )}
      {action && <div style={{ marginTop: 4 }}>{action}</div>}
    </div>
  );
}
