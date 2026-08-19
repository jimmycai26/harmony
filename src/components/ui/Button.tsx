"use client";
import React from "react";

const sizes = {
  sm: { padding: "8px 14px", fontSize: "var(--text-sm)" },
  md: { padding: "11px 20px", fontSize: "var(--text-base)" },
  lg: { padding: "14px 26px", fontSize: "var(--text-md)" },
};
const variants = {
  primary: { background: "var(--accent)", color: "#0E0C0A", border: "1px solid transparent" },
  secondary: { background: "var(--surface-card)", color: "var(--text-heading)", border: "1px solid var(--border-strong)" },
  ghost: { background: "transparent", color: "var(--text-heading)", border: "1px solid transparent" },
  danger: { background: "var(--danger)", color: "#0E0C0A", border: "1px solid transparent" },
};

export interface ButtonProps {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
  disabled?: boolean;
  icon?: React.ReactNode;
  children: React.ReactNode;
  onClick?: () => void;
}

export function Button({ variant = "primary", size = "md", disabled = false, icon, children, onClick }: ButtonProps) {
  const [hover, setHover] = React.useState(false);
  const [active, setActive] = React.useState(false);
  const v = variants[variant] || variants.primary;
  let bg: string = v.background;
  if (!disabled && variant === "primary") bg = active ? "var(--accent-press)" : hover ? "var(--accent-hover)" : v.background;
  if (!disabled && variant === "secondary") bg = hover ? "var(--surface-card-hover)" : v.background;
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => {
        setHover(false);
        setActive(false);
      }}
      onMouseDown={() => setActive(true)}
      onMouseUp={() => setActive(false)}
      style={{
        fontFamily: "var(--font-display)",
        fontWeight: 600,
        letterSpacing: "var(--tracking-tight)",
        borderRadius: "var(--radius-sm)",
        cursor: disabled ? "not-allowed" : "pointer",
        display: "inline-flex",
        alignItems: "center",
        gap: "8px",
        transition:
          "transform var(--duration-fast) var(--ease-out), background var(--duration-base) var(--ease-out), opacity var(--duration-base) var(--ease-out)",
        opacity: disabled ? 0.4 : 1,
        transform: active && !disabled ? "scale(var(--press-scale))" : "scale(1)",
        ...sizes[size],
        ...v,
        background: bg,
      }}
    >
      {icon}
      {children}
    </button>
  );
}
