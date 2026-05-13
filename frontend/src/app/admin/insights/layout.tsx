import type { ReactNode } from "react";
import { InsightsLayoutClient } from "./InsightsLayoutClient";

export default function InsightsLayout({ children }: { children: ReactNode }) {
  return <InsightsLayoutClient>{children}</InsightsLayoutClient>;
}
