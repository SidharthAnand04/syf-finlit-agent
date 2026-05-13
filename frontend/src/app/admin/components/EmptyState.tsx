import { EmptyState as BaseEmptyState } from "@/components/ui/state";

interface EmptyStateProps {
  title: string;
  description?: string;
  message?: string;
  action?: React.ReactNode;
  icon?: React.ReactNode;
}

export function EmptyState({ title, description, message, action }: EmptyStateProps) {
  return <BaseEmptyState title={title} description={description ?? message} action={action} />;
}
