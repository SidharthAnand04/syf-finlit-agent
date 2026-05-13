import { MetricCard } from "@/components/ui/layout";

interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  icon?: React.ReactNode;
}

export function StatCard({ label, value, sub, icon }: StatCardProps) {
  return (
    <MetricCard
      label={label}
      value={typeof value === "number" ? value.toLocaleString() : value}
      sub={sub}
      icon={icon}
    />
  );
}
