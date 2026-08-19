"use client";
import React from "react";
import type { Vote } from "@/lib/api/types";

export interface VotePillProps {
  axis: string;
  value?: Vote;
  onVote?: (v: Vote) => void;
  leftColor?: string;
  rightColor?: string;
  leftLabel?: string;
  rightLabel?: string;
}

export function VotePill({
  axis,
  value,
  onVote,
  leftColor = "var(--accent)",
  rightColor = "var(--accent)",
  leftLabel = "A",
  rightLabel = "B",
}: VotePillProps) {
  const opts: { key: Vote; label: string }[] = [
    { key: "left", label: leftLabel },
    { key: "tie", label: "Tie" },
    { key: "right", label: rightLabel },
  ];
  const colorFor = (k: Vote) => (k === "tie" ? "var(--secondary)" : k === "left" ? leftColor : rightColor);
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", fontFamily: "var(--font-body)" }}>
      <span style={{ fontSize: "var(--text-sm)", color: "var(--text-muted)" }}>{axis}</span>
      <div
        style={{
          display: "flex",
          gap: "4px",
          background: "var(--surface-card)",
          padding: "3px",
          borderRadius: "var(--radius-pill)",
          border: "1px solid var(--border-default)",
        }}
      >
        {opts.map((o) => {
          const active = value === o.key;
          return (
            <button
              key={o.key}
              onClick={() => onVote?.(o.key)}
              style={{
                border: "none",
                cursor: "pointer",
                padding: "6px 14px",
                borderRadius: "var(--radius-pill)",
                fontFamily: "var(--font-mono)",
                fontSize: "var(--text-xs)",
                fontWeight: 600,
                letterSpacing: "var(--tracking-wide)",
                minWidth: 34,
                background: active ? colorFor(o.key) : "transparent",
                color: active ? "#0E0C0A" : "var(--text-muted)",
                boxShadow: active ? `0 0 18px ${colorFor(o.key)}55` : "none",
                transition: "all var(--duration-fast) var(--ease-out)",
              }}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
