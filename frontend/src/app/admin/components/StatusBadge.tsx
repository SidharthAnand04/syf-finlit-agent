import { Badge } from "@/components/ui/badge";

type StatusKey = "ok" | "error" | "pending" | "unindexed" | "disabled";

const STATUS: Record<string, { bg: string; color: string; border: string; label: string }> = {
  ok:        { bg: "rgba(220,252,231,0.78)", color: "#166534", border: "rgba(22,101,52,0.18)", label: "OK"        },
  error:     { bg: "rgba(254,226,226,0.80)", color: "#991b1b", border: "rgba(153,27,27,0.18)", label: "Error"     },
  pending:   { bg: "rgba(254,243,199,0.82)", color: "#92400e", border: "rgba(146,64,14,0.18)", label: "Pending"   },
  unindexed: { bg: "rgba(241,245,249,0.80)", color: "#475569", border: "rgba(71,85,105,0.16)", label: "Unindexed" },
  disabled:  { bg: "rgba(243,244,246,0.76)", color: "#6b7280", border: "rgba(107,114,128,0.16)", label: "Disabled"  },
};

export function StatusBadge({ status }: { status: string | null | undefined }) {
  const key = (status ?? "unindexed").toLowerCase() as StatusKey;
  const cfg = STATUS[key] ?? { bg: "rgba(241,245,249,0.80)", color: "#475569", border: "rgba(71,85,105,0.16)", label: key };
  return (
    <Badge variant="light" style={{ background: cfg.bg, color: cfg.color, borderColor: cfg.border }}>
      {cfg.label}
    </Badge>
  );
}
