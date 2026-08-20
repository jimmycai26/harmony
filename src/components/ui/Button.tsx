import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const sizes = {
  sm: "px-3.5 py-2 text-sm",
  md: "px-5 py-[11px] text-base",
  lg: "px-[26px] py-3.5 text-md",
};

const variants = {
  primary: "border border-transparent bg-accent text-[#0E0C0A] hover:bg-accent-hover active:bg-accent-press",
  secondary: "border border-border-strong bg-surface-card text-text-heading hover:bg-surface-card-hover",
  ghost: "border border-transparent bg-transparent text-text-heading",
  danger: "border border-transparent bg-danger text-[#0E0C0A]",
};

export interface ButtonProps {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
  disabled?: boolean;
  icon?: ReactNode;
  children: ReactNode;
  onClick?: () => void;
}

export function Button({ variant = "primary", size = "md", disabled = false, icon, children, onClick }: ButtonProps) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-2 rounded-sm font-display font-semibold tracking-[-0.02em] transition-[background,opacity,transform] duration-[120ms] ease-[cubic-bezier(0.16,1,0.3,1)] active:scale-[0.97]",
        disabled ? "cursor-not-allowed opacity-40" : "cursor-pointer",
        sizes[size],
        variants[variant],
      )}
    >
      {icon}
      {children}
    </button>
  );
}
