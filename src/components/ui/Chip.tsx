import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface ChipProps {
  children: ReactNode;
  selected?: boolean;
  onClick?: () => void;
}

export function Chip({ children, selected = false, onClick }: ChipProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "cursor-pointer rounded-pill border px-4 py-2 font-body text-sm font-medium transition-all duration-[120ms] ease-[cubic-bezier(0.16,1,0.3,1)]",
        selected
          ? "border-accent bg-accent-soft text-accent"
          : "border-border-strong bg-surface-card text-text-body hover:bg-surface-card-hover",
      )}
    >
      {children}
    </button>
  );
}
