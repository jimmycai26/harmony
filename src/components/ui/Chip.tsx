"use client";
import React from "react";

export interface ChipProps {
  children: React.ReactNode;
  selected?: boolean;
  onClick?: () => void;
}

export function Chip({ children, selected = false, onClick }: ChipProps) {
  const [hover, setHover] = React.useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        fontFamily: "var(--font-body)",
        fontSize: "var(--text-sm)",
        fontWeight: 500,
        padding: "8px 16px",
        borderRadius: "var(--radius-pill)",
        cursor: "pointer",
        border: selected ? "1px solid var(--accent)" : "1px solid var(--border-strong)",
        background: selected ? "var(--accent-soft)" : hover ? "var(--surface-card-hover)" : "var(--surface-card)",
        color: selected ? "var(--accent)" : "var(--text-body)",
        transition: "all var(--duration-fast) var(--ease-out)",
      }}
    >
      {children}
    </button>
  );
}
