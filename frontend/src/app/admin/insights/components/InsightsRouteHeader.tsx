"use client";

import type { ReactNode } from "react";
import { PageHeader } from "@/components/ui/layout";

interface InsightsRouteHeaderProps {
  title: string;
  subtitle?: string;
  /** Center the title block in the content column (default true for Insights routes). */
  center?: boolean;
  actions?: ReactNode;
}

export function InsightsRouteHeader({ title, subtitle, center = true, actions }: InsightsRouteHeaderProps) {
  return (
    <PageHeader title={title} subtitle={subtitle} center={center} action={actions} />
  );
}
