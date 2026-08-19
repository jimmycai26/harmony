"use client";
import React from "react";

export interface StepBarProps {
  steps: string[];
  activeIndex: number;
  unlockedCount: number;
  onStepClick?: (i: number) => void;
}

export function StepBar({ steps, activeIndex, unlockedCount, onStepClick }: StepBarProps) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0", fontFamily: "var(--font-display)" }}>
      {steps.map((label, i) => {
        const unlocked = i <= unlockedCount;
        const isActive = i === activeIndex;
        return (
          <React.Fragment key={label}>
            <button
              disabled={!unlocked}
              onClick={() => unlocked && onStepClick?.(i)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                border: "none",
                background: "transparent",
                cursor: unlocked ? "pointer" : "not-allowed",
                padding: "6px 4px",
                opacity: unlocked ? 1 : 0.35,
              }}
            >
              <span
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontFamily: "var(--font-mono)",
                  fontSize: "var(--text-xs)",
                  fontWeight: 600,
                  background: isActive ? "var(--accent)" : "var(--surface-card)",
                  color: isActive ? "#0E0C0A" : unlocked ? "var(--text-heading)" : "var(--text-faint)",
                  border: isActive ? "none" : "1px solid var(--border-strong)",
                }}
              >
                {i + 1}
              </span>
              <span style={{ fontSize: "var(--text-sm)", fontWeight: 600, color: isActive ? "var(--text-heading)" : "var(--text-muted)" }}>
                {label}
              </span>
            </button>
            {i < steps.length - 1 && <span style={{ width: 28, height: 1, background: "var(--border-strong)", margin: "0 4px" }} />}
          </React.Fragment>
        );
      })}
    </div>
  );
}
