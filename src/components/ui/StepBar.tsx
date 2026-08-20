import { Fragment } from "react";
import { cn } from "@/lib/utils";

export interface StepBarProps {
  steps: string[];
  activeIndex: number;
  unlockedCount: number;
  onStepClick?: (i: number) => void;
}

export function StepBar({ steps, activeIndex, unlockedCount, onStepClick }: StepBarProps) {
  return (
    <div className="flex items-center font-display">
      {steps.map((label, i) => {
        const unlocked = i <= unlockedCount;
        const isActive = i === activeIndex;
        return (
          <Fragment key={label}>
            <button
              disabled={!unlocked}
              onClick={() => unlocked && onStepClick?.(i)}
              className={cn(
                "flex items-center gap-2 border-none bg-transparent px-1 py-1.5",
                unlocked ? "cursor-pointer opacity-100" : "cursor-not-allowed opacity-35",
              )}
            >
              <span
                className={cn(
                  "flex h-[26px] w-[26px] items-center justify-center rounded-full font-mono text-xs font-semibold",
                  isActive
                    ? "border-none bg-accent text-[#0E0C0A]"
                    : cn("border border-border-strong bg-surface-card", unlocked ? "text-text-heading" : "text-text-faint"),
                )}
              >
                {i + 1}
              </span>
              <span className={cn("text-sm font-semibold", isActive ? "text-text-heading" : "text-text-muted")}>{label}</span>
            </button>
            {i < steps.length - 1 && <span className="mx-1 h-px w-7 bg-border-strong" />}
          </Fragment>
        );
      })}
    </div>
  );
}
