import React from "react";

const tones = {
  neutral: { background: "var(--surface-card)", color: "var(--text-muted)", border: "1px solid var(--border-default)" },
  accent: { background: "var(--accent-soft)", color: "var(--accent)", border: "1px solid transparent" },
  secondary: { background: "var(--secondary-soft)", color: "var(--secondary)", border: "1px solid transparent" },
  success: { background: "rgba(107,203,119,0.14)", color: "var(--success)", border: "1px solid transparent" },
  warning: { background: "rgba(245,166,35,0.14)", color: "var(--warning)", border: "1px solid transparent" },
  danger: { background: "var(--danger-soft)", color: "var(--danger)", border: "1px solid transparent" },
};

export interface BadgeProps {
  children: React.ReactNode;
  tone?: keyof typeof tones;
}

export function Badge({ children, tone = "neutral" }: BadgeProps) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "4px",
        fontFamily: "var(--font-mono)",
        fontSize: "var(--text-xs)",
        fontWeight: 500,
        letterSpacing: "var(--tracking-wide)",
        textTransform: "uppercase",
        padding: "4px 9px",
        borderRadius: "var(--radius-pill)",
        ...tones[tone],
      }}
    >
      {children}
    </span>
  );
}
