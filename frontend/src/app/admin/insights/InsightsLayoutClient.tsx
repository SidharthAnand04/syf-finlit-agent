"use client";

import type { ReactNode } from "react";
import { InsightsProvider, useInsights } from "./InsightsContext";
import { InsightActionDrawer } from "./components/InsightActionDrawer";

function DrawerHost() {
  const { activeAction, setActiveAction } = useInsights();
  return <InsightActionDrawer action={activeAction} onClose={() => setActiveAction(null)} />;
}

export function InsightsLayoutClient({ children }: { children: ReactNode }) {
  return (
    <InsightsProvider>
      {children}
      <DrawerHost />
    </InsightsProvider>
  );
}
