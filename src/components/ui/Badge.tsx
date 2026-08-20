import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const tones = {
  neutral: "border border-border-default bg-surface-card text-text-muted",
  accent: "border border-transparent bg-accent-soft text-accent",
  secondary: "border border-transparent bg-secondary-soft text-secondary",
  success: "border border-transparent bg-[rgba(107,203,119,0.14)] text-success",
  warning: "border border-transparent bg-[rgba(245,166,35,0.14)] text-warning",
  danger: "border border-transparent bg-danger-soft text-danger",
};

export interface BadgeProps {
  children: ReactNode;
  tone?: keyof typeof tones;
}

export function Badge({ children, tone = "neutral" }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-pill px-[9px] py-1 font-mono text-xs font-medium tracking-[0.04em] uppercase",
        tones[tone],
      )}
    >
      {children}
    </span>
  );
}
