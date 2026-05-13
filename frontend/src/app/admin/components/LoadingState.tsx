import { LoadingState as BaseLoadingState } from "@/components/ui/state";

export function LoadingState({ label, message }: { label?: string; message?: string }) {
  return <BaseLoadingState label={label ?? message ?? "Loading..."} />;
}
